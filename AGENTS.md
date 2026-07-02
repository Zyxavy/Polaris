# AGENTS.md — Polaris Coding Conventions

This file defines the conventions an AI coding assistant should follow when writing or editing code in this project. Read it at session start before any implementation work.

## Branch Strategy

- `main` is the stable branch. All development happens on feature branches.
- No direct pushes to `main` — every merge goes through a PR (even if self-reviewed).
- Feature branch naming: `feat/<short-description>`, `fix/<short-description>`, `docs/<short-description>`.

## Commit Messages

```bash
type(scope): short description
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.  
Scope: the package or area changed (`api`, `web`, `d1`, `infra`, `docs`).  
Description: imperative tense, lowercase, no period.

Examples:

```bash
feat(api): add recovery code verification route
fix(web): prevent double-submit on system creator
docs: update ADR 002 with hybrid service layer
```

## Tooling

| Tool | Purpose | Key commands |
|---|---|---| |
| **pnpm** | Package manager (not npm, not yarn) | `pnpm install`, `pnpm -r build`, `pnpm -r deploy` |
| **Vitest** | Unit + integration test runner | `pnpm test:unit`, `pnpm test:integration` |
| **Playwright** | E2E tests | `pnpm test:e2e` |
| **Svelte 5** | Frontend framework (runes mode) | Use `$state`, `$derived`, `$effect` — not Svelte 4 stores or `onMount` |
| **Tailwind CSS** | Styling — no CSS modules or styled-components |
| **Hono** | API framework (TypeScript) | `c.req.param()`, `c.req.json()`, `c.json()` |

### Svelte 5 runes conventions

- Use `let x = $state(...)` for reactive state, not `let x = ...` or `writable()` stores.
- Use `$derived(expression)` for computed values, not `$:` labels.
- Use `$effect(() => {...})` for side effects, not `onMount` / `afterUpdate`.
- Use `{#each}` blocks over array `.map()` in templates.
- Use `{#if}` blocks over ternary `&&` in templates for conditional rendering.

## Architecture Patterns

### Monorepo structure

```text
polaris/
├── packages/
│   ├── api/          Hono Worker (Cloudflare Workers)
│   │   └── src/
│   │       ├── auth.ts            Better Auth instance
│   │       ├── index.ts           Hono app + route registration
│   │       ├── services/          Business logic service functions
│   │       └── utils/             Shared utilities
│   └── web/          SvelteKit SPA (CSR only, SSR disabled)
│       └── src/
│           ├── lib/
│           │   ├── api/           Frontend service modules (apiFetch wrapper)
│           │   ├── stores/        $state-based stores (DashboardStore, etc.)
│           │   └── components/    UI components
│           └── routes/            SvelteKit file-based routing
└── docs/             All project documentation
```

### Hybrid service layer

Three rules from ADR 002 S7:

1. **Simple CRUD inline** — a single `SELECT` or `INSERT` in a route handler does not need a service function wrapper.
2. **Business logic in service functions** — any operation with conditional branching, multi-step validation, or coordination across tables belongs in `packages/api/src/services/`.
3. **Frontend service modules always** — every API call from the SPA goes through a typed module in `packages/web/src/lib/api/`, never through raw `fetch()` in a component.

### apiFetch pattern

The frontend does not call `fetch()` directly. Every API call goes through a typed wrapper that:

- Sets `credentials: 'include'` (cross-subdomain session cookie)
- Parses JSON responses
- Throws a typed `ApiError` on non-2xx responses (with `error` and optional `message` fields)
- Does not handle toasts or user-facing errors — that responsibility lives at the component/page layer (see sveltekit-route-architecture.md S4)

### $state stores

Shared application state lives in `packages/web/src/lib/stores/` as Svelte 5 runes modules exporting `$state()` variables, not Svelte 4 stores or contexts. Files:

| Store file | Holds |
|---|---|
| `dashboard-store.ts` | Dashboard systems list, period info |
| `workspace-editor-store.ts` | Active workspace layout, dirty state |
| `toast-store.ts` | Toast notification queue |

### Auth

- Better Auth instance is created once in `packages/api/src/auth.ts` using the D1 adapter.
- Session cookie: `sameSite: lax`, `httpOnly`, `secure`, no explicit domain scope (cross-origin between `polaris.kelpselp.workers.dev` and `polaris-api.kelpselp.workers.dev`).
- Frontend auth guard: `authClient.getSession()` in the root layout load function — not `useSession()` with an effect.
- Recovery codes flow: 3 codes generated at sign-up, stored in D1 `recovery_codes` table, displayed with hide/show in `/account` settings. Password reset via `POST /api/auth/recover` (custom route registered before Better Auth's catch-all handler).

### The 10ms CPU constraint

**This is the single most important constraint in the project.** Cloudflare Workers free tier caps CPU time at 10ms per request (I/O wait excluded). Every server-side change must fit within this budget. Concretely:

- Push filtering into SQL (`WHERE` clauses, not JS loops over results).
- Use `D1.batch()` for multiple writes, not per-row `prepare().run()`.
- Use SQL aggregation (`SUM`, `COUNT`, `GROUP BY`) instead of JS `reduce()`/`map()` over fetched rows.
- No in-memory data processing beyond trivial transformations.

## Dependencies

**Ask before adding any new dependency.** This includes npm packages, wrangler plugins, Tailwind plugins, and dev dependencies. The project runs on the free tier and every dependency adds bundle size, config surface, and potential breakage. A new dependency needs a documented justification (in the PR description or a comment) before it's installed.

Pre-existing dependencies are allowed without re-asking: `hono`, `better-auth`, `@better-auth/d1`, `vitest`, `@cloudflare/vitest-pool-workers`, `playwright`, `svelte`, `svelte-dnd-action`, `tailwindcss`, `mongodb` driver.

## Documentation

- Architecture decisions (with alternatives considered) go in `docs/ADRs/` — currently 001 (Tech Stack), 002 (D1 Schema), 003 (MongoDB Schema).
- Operational specs and design references go in `docs/reference/` — currently: `ai-workers.md`, `api-routes.md`, `auth-integration.md`, `cicd-deploy.md`, `disaster-recovery.md`, `observability.md`, `security-review.md`, `sveltekit-route-architecture.md`, `testing-strategy.md`, `definition-of-done.md`.
- If a change modifies an API contract, schema, or documented behavior, update the relevant doc in the same PR.
- Cross-reference search: after any rename or structural change, grep `docs/` for stale references to the old name.
