# Definition of Done

**Project:** *Polaris*

**Document type:** Process checklist -- explicit gate each task or PR must clear before it's considered complete. Not a style guide or a code review rubric. Derived from the test layers in [testing-strategy.md](testing-strategy.md), the constraints in the [Tech Stack ADR](../ADRs/001-tech-stack-adr.md), and the documentation conventions established across the project.

**Status:** v1

**Implementation status:** Current

**Last updated:** July 2, 2026

---

## Checklist

Every task, branch, or PR must satisfy all of the following before it is considered done. Exceptions are possible but require an explicit note in the PR description stating which item is skipped and why.

### 1. Unit tests pass

```bash
pnpm test:unit      # ⚠ not yet in root package.json
```

Runs Vitest in both packages (`api`, `web`). Covers pure functions, Svelte components in isolation, and Hono route handlers with mocked bindings (testing-strategy.md S2.1). If the task adds new logic that can be unit-tested, corresponding tests must be included.

### 2. Integration tests pass

```bash
pnpm test:integration     # ⚠ not yet in root package.json
```

Runs route-level tests against a real D1/R2 Miniflare instance (testing-strategy.md S2.2). If the task touches a route, query, or binding that the integration suite covers, confirm the suite still passes. If the task adds a new route or data access path, add appropriate integration coverage.

### 3. Lint clean

```bash
pnpm lint           # ⚠ not yet in root package.json
```

Both packages must pass with zero warnings (not just zero errors). Warnings are treated as violations -- the lint config should be strict enough that a warning is actionable.

### 4. E2E tests pass (if P0 flow affected)

```bash
pnpm test:e2e
```

Required only if the task touches a P0 user flow (sign-up, system creation, review submission, dashboard load -- testing-strategy.md S3.3). If no P0 flow was touched, state that explicitly in the PR description rather than skipping silently.

### 5. 10ms CPU budget respected

For every change to the API Worker (`packages/api`), document how you verified the change stays within the 10ms CPU budget per request (ADR 001 S2, Constraint #1). Acceptable forms of verification:

- **No new loops or in-memory aggregation:** the change pushes filtering/aggregation into D1 SQL rather than JavaScript (best).
- **Batch DML confirmed:** multiple writes use `D1.batch()` instead of per-row `prepare().run()`.
- **`wrangler tail` CPU field inspected:** run the action against a real or local Worker and note the CPU time in the PR description.
- **Static analysis:** for trivial changes (a single indexed lookup, a field rename), a statement like "one indexed SELECT, no loop, no batch needed" is sufficient.

A PR that adds a new loop over D1 results, a per-row DML pattern, or client-side aggregation of fetched data without explicit justification in the PR description is not done.

### 6. API contract or schema changed? Update relevant ADR

If the task changes:

- A route path, method, payload shape, or status code: update [api-routes.md](api-routes.md).
- A D1 table, column, constraint, or index: update [D1 Schema](../ADRs/002-d1-schema.md).
- The MongoDB collection shape or index: update [MongoDB Schema](../ADRs/003-mongodb-schema.md).
- The auth flow or session config: update [auth-integration.md](auth-integration.md).
- The AI request/response contract: update [ai-workers.md](ai-workers.md).

The documentation update is part of the task, not a follow-up.

### 7. Cross-doc stale references checked

Search the docs directory for any reference to the changed file, field, route, or concept. If the search turns up stale mentions (old paths, old field names, old status codes, old constraint values), update them in the same PR.

This is explicitly scoped to **references**, not full document rewrites -- if a downstream doc has an example that happens to use a field you renamed, update the field name in the example; you're not expected to rewrite the doc's structure or reasoning.

---

## When to Skip Which Items

| Item | Typical exception |
|---|---|
| Integration tests | Infra-only change (wrangler.jsonc, workflow YAML) with no new or modified route |
| E2E tests | Non-P0 change (configuration, documentation, helper utility) |
| 10ms CPU verification | Task touches only `packages/web` (frontend has no CPU budget) |
| ADR update | Internal refactor with no contract change (rename a variable, extract a function) |

If an item is skipped, state which one and why in the PR description -- a single sentence is sufficient.
