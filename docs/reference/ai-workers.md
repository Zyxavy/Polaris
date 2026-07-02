# AI Workers - Implementation Reference

**Project:** *Polaris*
**Document type:** AI feature implementation reference - covers model selection, prompt design, response parsing, system prompt versioning, free-tier budget, and the Hono route implementation.
**Status:** Draft - v1 scope
**Last updated:** July 2, 2026

---

## 0. Foundational Constraint

All server-side computation must fit within Cloudflare Workers' free-tier 10ms CPU time per request (I/O wait excluded). This is the single non-negotiable constraint on every design decision in this document. See ADR 001 S2 (Constraint #1).

---

## 1. Feature Summary

AI assist is a **single, optional action** inside the System Creator: the user writes a short description of what they want to build, clicks "Draft with AI," and receives a pre-filled draft of their System blueprint. Nothing is saved automatically. The output lands in the same editable form fields as manual creation.

This is the complete scope of AI in v1. The AI does not:

- Generate Instances.
- Run in any background or scheduled job.

---

## 2. Model

**Model ID:** `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`

**Why this model:**

- Available natively on Cloudflare Workers AI - no external API key, no second billing surface, no additional latency from a cross-network call.
- A 32B reasoning model distilled from DeepSeek-R1. Distilled reasoning models produce better structured output than same-size base instruction models because the reasoning process (encoded in the `<think>` block) works through the problem before committing to a JSON response.
- Confirmed available on the Workers AI free tier as of July 2026.
- Supports OpenAI-compatible chat message format, which Workers AI exposes via `env.AI.run()`.

**How it's called:**

```typescript
// packages/api/src/routes/ai.ts
const response = await env.AI.run(
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_V1 },
      { role: 'user', content: userInput }
    ],
    max_tokens: 1024,
  }
);
```

The `env.AI` binding is declared in `packages/api/wrangler.toml`:

```toml
[ai]
binding = "AI"
```

---

## 3. System Prompt

The system prompt is the most important maintainable asset in the AI feature. It encodes the five-step framework from `docs/core/systems-framework.md` and tells the model exactly what schema to return. It lives as a versioned constant in the codebase - **not** inlined in the route handler.

**Location:** `packages/api/src/ai/prompts/system-prompt.v1.ts`

**Version tracking:** the prompt file is suffixed with its version (`.v1.ts`, `.v2.ts`) so git history shows exactly when and why the prompt changed. The active version is re-exported from `packages/api/src/ai/prompts/index.ts` as `SYSTEM_PROMPT_CURRENT`.

**Current prompt (v1):**

```typescript
// packages/api/src/ai/prompts/system-prompt.v1.ts
export const SYSTEM_PROMPT_V1 = `
You are a system design assistant helping a user build a personal system using the five-step framework below. 

THE FIVE-STEP FRAMEWORK:
1. FLOOR ACTION (Minimum Viable Action): The smallest possible version of the system that counts as a win. Must be so small it can be done on the absolute worst day - exhausted, busy, zero motivation. This is the floor, not the ceiling. Example: "Read one paragraph" not "Read 30 pages."
2. FRICTION REDUCTION: What obstacles stand between the user and doing this? List the 2-3 most likely barriers they will face.
3. TRIGGER (Habit Stack): Attach the new system to an existing daily habit. Format: "After I [existing habit], I will [new system]."
4. PROTOCOL: The full version of the system when the user has normal energy. Step-by-step, specific, actionable.
5. PURPOSE + PHILOSOPHY: Why does this system matter? What identity is the user building? This is their cognitive anchor on bad days - the reason they do it even when they don't feel like it.

YOUR TASK:
Given the user's description of what they want to build, return a JSON object with the following fields. Return ONLY the JSON object - no preamble, no explanation, no markdown fences.

REQUIRED JSON SCHEMA:
{
  "name": "Short, specific name for this system (e.g. 'Daily Reading System', 'Morning Workout System')",
  "purpose": "1-2 sentences: why this system exists and what outcome it produces",
  "philosophy": "2-3 sentences: the identity-level reason to do this system even on bad days. Written as if the user is saying it to themselves.",
  "protocol": "The full version - 3 to 6 numbered steps, specific and actionable",
  "floor_action": "The absolute minimum. One sentence. Must be completable in under 5 minutes with zero energy.",
  "trigger": "After I [specific existing habit], I will [first step of this system].",
  "barrier_list": ["barrier 1", "barrier 2", "barrier 3"]
}

RULES:
- floor_action must be genuinely minimal. If the user's description implies a big action, make the floor action a dramatically smaller version.
- trigger must reference a specific, daily existing habit (brushing teeth, making coffee, sitting at a desk), not a vague one ("when I have time").
- barrier_list must be realistic obstacles, not generic advice. Think about what actually gets in the way of this specific system.
- All text fields are written in second person ("you" / "your") or first person ("I") - not third person.
- Return valid JSON only. No trailing commas. No comments inside the JSON.
`.trim();
```

---

## 4. Response Parsing

DeepSeek R1 distill models produce a `<think>...</think>` block containing their reasoning before the actual response. This block must be stripped before JSON parsing.

**Parsing pipeline (`packages/api/src/ai/parse.ts`):**

```typescript
export function stripThinkTokens(raw: string): string {
  const closeTag = '</think>';
  const idx = raw.indexOf(closeTag);
  if (idx === -1) {
    // No think block found - treat the whole string as content
    return raw.trim();
  }
  return raw.slice(idx + closeTag.length).trim();
}

export interface SystemDraft {
  name: string;
  purpose: string;
  philosophy: string;
  protocol: string;
  floor_action: string;
  trigger: string;
  barrier_list: string[];
}

export function parseSystemDraft(raw: string): SystemDraft {
  const cleaned = stripThinkTokens(raw);
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AIParseError('AI response was not valid JSON after stripping think tokens', cleaned);
  }

  // Validate required fields
  const required: (keyof SystemDraft)[] = [
    'name', 'purpose', 'philosophy', 'protocol', 'floor_action', 'trigger', 'barrier_list'
  ];
  for (const field of required) {
    if (!(field in (parsed as object))) {
      throw new AIParseError(`AI response missing required field: ${field}`, cleaned);
    }
  }

  return parsed as SystemDraft;
}

export class AIParseError extends Error {
  constructor(message: string, public readonly rawResponse: string) {
    super(message);
    this.name = 'AIParseError';
  }
}
```

**What to log on parse failure:** log the `rawResponse` (trimmed to 500 chars to avoid bloating logs) and the parse error message to Cloudflare Workers' built-in logging. Do not surface the raw model output to the client.

---

## 5. The Hono Route

**Route:** `POST /api/ai/draft-system`

**Auth:** required (session cookie). An unauthenticated request returns 401 before the AI binding is ever called.

**Request body:**

```json
{ "prompt": "I want to build a daily reading habit before bed" }
```

**Response (success, 200):**

```json
{
  "draft": {
    "name": "Daily Reading System",
    "purpose": "...",
    "philosophy": "...",
    "protocol": "...",
    "floor_action": "Open the book and read one paragraph",
    "trigger": "After I brush my teeth, I will open my book",
    "barrier_list": ["Phone on nightstand is easier to reach", "Falling asleep before starting", "No specific book chosen"]
  }
}
```

**Response (neuron quota exceeded, 503):**

```json
{
  "error": "ai_unavailable",
  "message": "AI assist is unavailable today. You can still create your system manually - all fields are editable."
}
```

**Response (parse failure, 502):**

```json
{
  "error": "ai_parse_failed",
  "message": "AI returned an unexpected response. Try again, or create your system manually."
}
```

**Full route implementation:**

```typescript
// packages/api/src/routes/ai.ts
import { Hono } from 'hono';
import { SYSTEM_PROMPT_CURRENT } from '../ai/prompts/index.js';
import { parseSystemDraft, AIParseError } from '../ai/parse.js';

const aiRouter = new Hono<{ Bindings: CloudflareBindings }>();

aiRouter.post('/draft-system', async (c) => {
  // Auth guard handled by middleware before this route

  const body = await c.req.json<{ prompt: string }>();
  if (!body.prompt || body.prompt.trim().length < 5) {
    return c.json({ error: 'invalid_input', message: 'Prompt is too short.' }, 400);
  }

  let aiRawResponse: string;
  try {
    const result = await c.env.AI.run(
      '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
      {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_CURRENT },
          { role: 'user', content: body.prompt.trim() }
        ],
        max_tokens: 1024,
      }
    ) as { response: string };
    aiRawResponse = result.response;
  } catch (err: unknown) {
    // Cloudflare throws when neuron quota is exceeded (error code 4006)
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('4006') || message.includes('neuron')) {
      return c.json({
        error: 'ai_unavailable',
        message: 'AI assist is unavailable today. You can still create your system manually - all fields are editable.'
      }, 503);
    }
    console.error('[AI] Workers AI call failed:', message);
    return c.json({ error: 'ai_error', message: 'AI call failed. Try again.' }, 502);
  }

  try {
    const draft = parseSystemDraft(aiRawResponse);
    return c.json({ draft });
  } catch (err) {
    if (err instanceof AIParseError) {
      console.error('[AI] Parse failed:', err.message, '| raw (500ch):', err.rawResponse.slice(0, 500));
    }
    return c.json({
      error: 'ai_parse_failed',
      message: 'AI returned an unexpected response. Try again, or create your system manually.'
    }, 502);
  }
});

export { aiRouter };
```

---

## 6. Free-Tier Budget Analysis

Workers AI provides **10,000 Neurons/day** on the free tier. Limits reset daily at 00:00 UTC.

**Neuron cost estimate for one AI-assist call:**

Based on published neuron rates and DeepSeek R1 distill 32B's parameter count (~half of Llama 3.1-70B which costs ~26,668 neurons/M input tokens):

| Component | Tokens (est.) | Neurons (est.) |
|---|---|---|
| System prompt | ~450 tokens | ~6 neurons |
| User prompt | ~50 tokens | <1 neuron |
| Output (system draft JSON) | ~400 tokens | ~20-40 neurons |
| **Total per call** | ~900 tokens | **~30-50 neurons** |

Even at the high end of 100 neurons/call (accounting for reasoning tokens in the think block), 10,000 neurons/day supports **100 AI-assist calls per day** - an order of magnitude more than any realistic personal-app usage.

**When the quota is hit:** the Workers AI runtime throws an error containing `4006`. The Hono route catches this and returns a `503` with a user-friendly message. The System Creator frontend must handle `error: 'ai_unavailable'` by hiding the "Draft with AI" button and showing an inline notice that AI is unavailable today. Manual creation is always available.

---

## 7. Prompt Versioning and Maintenance

The system prompt is the primary mechanism by which the five-step framework is encoded into the AI feature. Changes to the framework (e.g. adding a new required field to the System blueprint, or changing the floor action guidance) require a corresponding prompt update.

**Version bump checklist:**

1. Create `packages/api/src/ai/prompts/system-prompt.v{N+1}.ts` with the new prompt.
2. Update `packages/api/src/ai/prompts/index.ts` to export the new version as `SYSTEM_PROMPT_CURRENT`.
3. Update the `SystemDraft` interface in `packages/api/src/ai/parse.ts` if the JSON schema changed.
4. Update the unit test fixtures in `packages/api/src/ai/__tests__/parse.test.ts` with a new sample response using the new schema.
5. Document the reason for the change in a comment at the top of the new prompt file.

**Old prompt files are kept** (not deleted) so git blame gives a complete history of what the AI was instructed to do and when it changed. They can be deleted once a subsequent version has been stable for a few weeks.

---

## 8. Hard Constraint: Why AI Stays Single-Call in v1

The Workers free tier caps CPU time at **10ms per request**. I/O wait time (network, database queries) does not count toward this limit, but everything else does, JSON parsing, response transformation, control flow, and critically, model inference orchestration.

A single-call AI pattern (user prompt -> one inference -> parse -> return) fits within 10ms CPU because it spends almost all its time waiting on the `env.AI.run()` I/O. An **agentic loop**, where the model reasons, picks a tool, the Worker executes it (D1 read/write), feeds the result back, and the model reasons again, would require multiple sequential turns through the runtime. Even a minimal two-step loop (inference -> D1 read -> inference -> D1 write) would comfortably exceed 10ms CPU time.

**This is not a neuron-quota problem.** The 10,000 neurons/day cap is generous. The constraint is the free tier's 10ms CPU budget per invocation, which makes multi-turn agentic loops infeasible without upgrading to the Workers Paid plan (30-second CPU limit).

**Implications for AI features beyond v1:**

| Capability | Pattern | Free-tier feasible? | Blocked by |
|---|---|---|---|
| Draft a system from scratch | Single inference, no tools | Yes | - |
| Edit an existing system | Inference + D1 read + D1 write | Borderline, tight, single turn | 10ms CPU |
| Review systems (read history + infer + write) | Inference + D1 read + inference + D1 write | No | 10ms CPU on second inference |
| Multi-step mentor loop | N inference calls, N tool executions | No | Multiple sequential turns |
| MCP tool orchestration | Inner loop of tool dispatch per inference | No | Per-turn CPU budget |

The agentic assistant vision (edit systems, assign dates, act as a mentor, expose MCP tools) is architecturally sound and would work on the Workers Paid plan. It is documented in Appendix A as a deferred milestone, the data model and API surface should be designed to make this addition straightforward when the time comes.

## 9. Model Swap

If `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` is deprecated or a better structured-output model becomes available on Workers AI, the swap is one line change in `wrangler.toml` + a regression test of the parsing pipeline. The `stripThinkTokens` and `parseSystemDraft` functions are the single point of adaptation for model output format changes. The versioned system prompt means any change to model behaviour is auditable through git history.

---

## Appendix A: Agentic Assistant, Tool Manifest (Deferred)

This appendix documents the full catalog of tools an agentic AI assistant would expose. It is **not implemented in v1**. It exists so the architecture stays forward-compatible, the tool definitions below are the target shape for an MCP-style integration on Workers Paid (or equivalent).

**Deployment trigger:** upgrade to Workers Paid plan (or equivalent where CPU time > 10ms per request).

### A.1 Tool Catalog

#### system.read

Read one or more of the user's systems, with optional filtering.

```
Input:
  filter?: { status?: 'active' | 'paused' | 'archived'; domain?: string; ids?: string[] }
  include_fields?: ('purpose' | 'philosophy' | 'protocol' | 'floor_action' | 'schedule' | 'workspace')[]

Output:
  systems: System[]
```

Used for: mentor mode (AI reads your systems to give advice), review assistance (AI reads a system's history before suggesting changes), barrier analysis.

#### system.create

Create a new system from scratch. Same schema as the manual form, every field is provided by the AI after reasoning with the user.

```
Input:
  system: {
    name: string
    purpose: string
    philosophy: string
    protocol: string
    floor_action: string
    trigger: string
    barrier_list: string[]
    schedule: ScheduleInput  // { days_of_week, time_window_start, time_window_end }
  }

Output:
  system: System
```

**Pre-flight confirmation required.** The system is not created until the user reviews and approves the AI's proposed schema.

Used for: "Create a workout system for me" conversations.

#### system.edit

Edit specific fields of an existing system. Only the provided fields are updated (partial PATCH semantics).

```
Input:
  system_id: string
  edits: Partial<{
    name, purpose, philosophy, protocol, floor_action, trigger, barrier_list, schedule, status
  }>

Output:
  system: System  // post-update
```

**Pre-flight confirmation required.** The AI must present a diff of what changed before the edit is applied.

Used for: adjusting floor actions, updating protocols after review, pausing/archiving systems.

#### instance.read

Read Instance history for a system or date range.

```
Input:
  system_id?: string
  date_from?: string  // ISO date
  date_to?: string
  state?: 'full' | 'floor' | 'missed' | 'pending'

Output:
  instances: Instance[]
```

Used for: review assistance, pattern analysis ("you've missed 3 of the last 5 weekdays, what changed?"), trend spotting.

#### instance.mark

Mark an Instance as full, floor, or missed.

```
Input:
  instance_id: string
  state: 'full' | 'floor' | 'missed'
  notes?: string

Output:
  instance: Instance
```

Used for: backfilling missed days, correcting accidental marks. Intentionally does not support `pending` -> `pending` (no-op) or `full` -> `pending` (historical state is preserved per PRD S6.5).

#### review.read

Read review history for a system.

```
Input:
  system_id: string
  limit?: number  // default 10

Output:
  reviews: Review[]
```

Used for: mentor mode analysing how a system has evolved over time, identifying recurring barriers.

#### review.create

Create a review entry with write-back.

```
Input:
  system_id: string
  what_worked: string
  what_broke: string
  worst_day_check: boolean
  change_applied: Partial<{
    protocol, floor_action, trigger, schedule, barrier_list
  }>

Output:
  review: Review
  updated_system: System  // after change_applied is written back
```

**Pre-flight confirmation required.** The `change_applied` diff must be shown to the user before execution.

Used for: AI-facilitated weekly reviews ("I read your week's data, here's what I noticed. Ready to update the system?").

#### schedule.next

Get the next N scheduled dates for a system, taking into account its `days_of_week` and `recurrence`, without modifying any data.

```
Input:
  system_id: string
  count?: number  // default 7

Output:
  dates: string[]  // ISO dates
```

Used for: planning conversations ("when will this system run next week?"), helping the user understand their schedule at a glance.

### A.2 Orchestration Model

```
User message
  -> AI reasons about intent
  -> AI calls tool (e.g. system.read to load current systems)
  -> Worker executes tool against D1/R2
  -> Tool result returned to AI
  -> AI reasons + decides next action
  -> AI calls next tool or generates final response
  -> Response shown to user
```

Each `->` is a round-trip through the Worker runtime. Every tool execution and every model inference call incurs CPU time. On the free tier (10ms CPU limit), even two sequential tool calls risk timeout. On the Workers Paid plan (30s CPU limit), this loop is practical for conversations of 5-15 turns.

All mutation tools (`system.create`, `system.edit`, `instance.mark`, `review.create`) require explicit user confirmation. The AI proposes; the user approves before any data changes. This mirrors the confirmation model in S1 of this document.

### A.3 When This Becomes Viable

- Workers Paid plan (or equivalent platform upgrade) is active
- MCP server or equivalent tool-dispatch endpoint is deployed as a separate Worker or as a new route in the existing Hono API
- Frontend provides a chat-style interface alongside (or replacing) the current "Draft with AI" button

Until then, the single-call "Draft with AI" pattern in v1 remains the correct scope for free-tier AI.
