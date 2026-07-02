# Observability

**Project:** *Polaris*

**Document type:** Operational reference -- debugging tools, logging conventions, and triage paths for each runtime component. Companion to the [Tech Stack ADR](../ADRs/001-tech-stack-adr.md) (owns the component architecture this document observes) and the [Deploy and CI/CD doc](cicd-deploy.md) (owns the environments this document debugs against).

**Status:** Draft -- v1 scope

**Last updated:** July 2, 2026

---

## 0. Scope

This is a small document for a small app. There is no observability platform in v1 (no Datadog, no Sentry, no Grafana). What exists instead is a set of lightweight, zero-cost practices that match the app's actual debugging needs and are consistent with the "proportionality" principle already established in [security-review.md](security-review.md) S0 and [disaster-recovery.md](disaster-recovery.md) S0.

---

## 1. Primary Debugging Tool: `wrangler tail`

`wrangler tail` streams live logs from any deployed Worker directly to your terminal. This is the single most useful debugging tool for the API Worker, the Cron handler, and the Queue consumer -- everything that runs on Cloudflare's runtime is observable through it.

### 1.1 Basic usage

```bash
# Stream all logs from the API Worker (the one you'll use most often)
wrangler tail --format=pretty

# Filter to a specific environment (if preview/deployment channels exist)
wrangler tail --env=production

# Pipe to grep to isolate a specific request or error
wrangler tail --format=json | Select-String "error|500|exception"
```

`--format=pretty` is the default and is fine for interactive debugging. `--format=json` is better when you're piping to grep or saving to a file for later inspection.

### 1.2 What `wrangler tail` shows

Every invocation of the Worker (HTTP request, Cron trigger, Queue message) produces a log line. The output includes:

- **Event type** (`http`, `cron`, `queue`, `alarm`)
- **Request method and path** (for HTTP events)
- **Status code** (for HTTP responses)
- **CPU time and wall time** -- useful for catching 10ms CPU budget violations before they cause 503s
- **`console.log` output** (see S3 for what to log)
- **Uncaught exceptions** with stack traces

---

## 2. No Sentry (or Any Error-Tracking Platform) in v1

**Decision: no Sentry, no Datadog, no error-tracking service in v1**

**Why not:** this is a personal app. There is no user base submitting error reports, no SLA to monitor against, and no revenue at stake. An error-tracing platform adds:

- A monthly bill (Sentry's free tier is generous but not unlimited; a meaningful upgrade costs money per ADR 001 S2's "Free" constraint)
- A Worker integration (another SDK, another initialization path, another thing to configure per environment)
- Noise (a personal app's error volume is so low that the signal-to-noise ratio of a dashboard is worse than just checking `wrangler tail` when you suspect something is wrong)

The equivalent capability exists for free, on demand, and with no always-on surface: `wrangler tail` plus structured logging (S3) plus the 4006 error path in [ai-workers.md](ai-workers.md) S6 for the one third-party API call that has meaningful failure modes.

**When to revisit:** if the app is ever hits consistent monthly active users, or if a recurring bug pattern emerges that `wrangler tail` can't easily isolate across time. At that point, Sentry's free tier (or a similarly lightweight alternative) becomes proportional -- but not before.

---

## 3. Structured Logging Conventions

`console.log` output appears in `wrangler tail` automatically. The goal of these conventions is to make that output **grep-friendly and actionable**, not verbose.

### 3.1 What to log

| Situation | What to log | Example |
|---|---|---|
| Request received | Method, path, authenticated user ID | `[api] POST /api/systems user=usr_abc123` |
| Database operation | Operation type, table, row ID | `[d1] INSERT instances id=inst_def456` |
| External API call (AI) | Model, prompt length, response status | `[ai] draft-system prompt=412 chars status=200` |
| Failure (expected) | Error code, context, no stack trace | `[api] 400 upload: unsupported_file_type` |
| Failure (unexpected) | Error code, brief context, stack trace | `[api] 500 review:confirm user_id missing stack=<trace>` |
| Queue operation | Action, message ID, retry count | `[queue] journal-retry msg=m01abc attempt=2` |

### 3.2 What not to log

- **Every SQL query.** D1 operations are fast (I/O wait is excluded from the 10ms CPU budget) and the Worker's `console.log` calls cost CPU time inside that budget. Logging every `SELECT` or `INSERT` burns budget on observability, not work. Log only mutations and errors.
- **Request body contents for large uploads.** Log the file name and size, not the bytes. This is a practical constraint (free-tier log output limits) as much as a security one.
- **Full stack traces for expected errors.** A 400 response from validation is not exceptional. Log just the error key and the field that failed.

### 3.3 Prefix convention

Prefix every log line with a component tag in brackets so `wrangler tail` output is scannable at a glance:

| Tag | Component |
|---|---|
| `[api]` | HTTP route handler (request lifecycle) |
| `[d1]` | D1 query or write (only mutations + errors, S3.2) |
| `[mongo]` | MongoDB query or write (only errors -- journal writes are the only Mongo operation) |
| `[ai]` | Workers AI inference call |
| `[queue]` | Queue consumer handler |
| `[cron]` | Scheduled Cron trigger handler |

A well-formed log line follows this shape:

```
[component] action context key=value key=value
```

Examples:

```
[api] POST /api/systems user=usr_abc123 status=201
[d1] INSERT instances system_id=sys_def456 count=7
[ai] draft-system prompt=412 chars model=deepseek-r1 status=200
[queue] journal-retry msg=m01abc attempt=2 status=202
```

### 3.4 Request ID propagation

The Hono Worker generates a `requestId` (UUID v4) at the start of each HTTP request. This ID should be:

1. Included on every log line within that request's lifecycle via a simple context object or closure variable.
2. **Not** included in responses (it's for debugging, not for the frontend to consume).

If a request triggers a Queue message (journal entry retry per ADR 001 S5.5), the `requestId` should be included in the queued payload so the consumer's log lines (prefixed `[queue]`) can be correlated back to the original HTTP request that enqueued the work.

---

## 4. Where to Look First When Something Breaks

### 4.1 API Worker: endpoint returns wrong status or data

```bash
wrangler tail --format=pretty
```

Reproduce the failing action in the browser. The live stream shows the request, the `console.log` output from the handler, the response status, and any uncaught exceptions with stack traces. If the issue is a 500 with no log output, check for an uncaught exception before the handler started (e.g. a binding isn't configured correctly -- `wrangler tail` will show the runtime error).

### 4.2 Cron job: nightly Instance pre-generation didn't run

The Cron trigger runs once nightly (ADR 001 S5.8). To check whether it ran and what it did:

```bash
wrangler tail --format=json | Select-String "cron"
```

Look for `[cron]` tagged lines. If nothing appears, either the Cron trigger isn't configured correctly in `wrangler.toml` (check `reference/cicd-deploy.md` S2.2), or the Worker failed to start (check `wrangler tail` for any startup-time errors first).

### 4.3 Queue consumer: journal entries not being written

If the direct Mongo write fails (ADR 001 S5.5), the entry is enqueued to `polaris-journal-retry`. To check whether the consumer is processing the queue:

```bash
wrangler tail --format=json | Select-String "queue"
```

Look for `[queue]` tagged lines. If messages are being received but repeatedly failing, the dead-letter queue (DLQ) captures them after the retry budget is exhausted -- check the DLQ via the Cloudflare Dashboard (Queues > `polaris-journal-retry` > Dead-letter queue) or `wrangler queues` commands.

### 4.4 Frontend: UI issue with no visible API error

Open the browser's developer tools (F12 > Console / Network tab). The SPA runs entirely on the client -- it does not log to `wrangler tail`. Look for:

- **Network tab:** failed API requests (4xx/5xx), CORS errors, cookie issues (cross-subdomain session cookie per [auth-integration.md](auth-integration.md) S2)
- **Console tab:** uncaught exceptions in Svelte components, the `apiFetch` wrapper's error handling per [sveltekit-route-architecture.md](sveltekit-route-architecture.md) S4
- **Application tab > Cookies:** session cookie presence and expiry for the `polaris.kelpselp.workers.dev` domain

---

## 5. Local Development Logging

During local development (`wrangler dev`), `console.log` output appears in the terminal where `wrangler dev` is running, interleaved with the dev server's own output. The same structured logging conventions (S3) apply -- using them consistently in development means the same grep patterns work against local logs and against `wrangler tail` output from production.
