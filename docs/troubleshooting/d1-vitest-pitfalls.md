# D1 + Vitest + Better Auth Pitfalls

**Implementation status:** Current

Troubleshooting notes from Slices 2–3 (D1 schema, smoke tests, Better Auth integration). Each entry covers a concrete error, why it happened, and what the fix was.

---

## 1. `defineWorkersConfig`, imported from a non-existent sub-path

### Error

```
Cannot find module '@cloudflare/vitest-pool-workers/config'
```

### Why

`testing-strategy.md` S2.2 referenced `defineWorkersConfig` from `@cloudflare/vitest-pool-workers/config`. This API existed in older versions of the pool (pre-0.16.x) but was removed in v0.17.0. The installed version (`^0.17.0`) does not export this sub-path.

### Fix

Use the actual v0.17.0 API: `cloudflareTest` (a Vite plugin) + `readD1Migrations` (reads `.sql` files into `D1Migration[]`).

```typescript
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: { d1Databases: { DB: 'test-db' } },
      }),
    ],
    test: {
      provide: { migrations },
    },
  };
});
```

`readD1Migrations` runs in Node.js (the config context), not the Worker runtime. Use Vitest's `provide`/`inject` bridge to pass `D1Migration[]` from config to test.

---

## 2. `test:integration` key outside `"scripts"` in `package.json`

### Error

```
pnpm run test:integration
 ERR  Missing script: test:integration
```

### Why

The `test:integration` field was placed at the top level of `package.json` alongside `"name"` and `"type"`, not inside the `"scripts"` object. npm/pnpm only reads executable scripts from `"scripts"`, top-level keys are ignored.

### Fix

```json
"scripts": {
  "dev": "wrangler dev",
  "deploy": "wrangler d1 migrations apply DB && wrangler deploy",
  "cf-typegen": "wrangler types --env-interface CloudflareBindings",
  "test:integration": "vitest"
}
```

---

## 3. `PRAGMA foreign_keys = OFF` doesn't bypass FK checks in D1

### Error

```
D1_ERROR: no such table: main.user: SQLITE_ERROR
```

Even after running `env.DB.exec("PRAGMA foreign_keys = OFF")`, inserts into `systems` (which has `user_id REFERENCES user(id)`) still failed.

### Why

D1's API uses a connection pool internally. `exec()` and `prepare().run()` may not share the same connection/session. `PRAGMA foreign_keys` is a per-connection setting, setting it OFF with `exec()` doesn't guarantee it's OFF for the subsequent `prepare().run()` calls.

### Fix

Don't disable FK enforcement. Instead, create a stub `user` table that matches Better Auth's expected shape:

```typescript
async function seedUserStub(db: D1Database) {
  await db.exec("CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, email TEXT NOT NULL DEFAULT '', emailVerified INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL DEFAULT (datetime('now')), updatedAt TEXT NOT NULL DEFAULT (datetime('now')))");
  await db.prepare("INSERT OR IGNORE INTO user (id, name) VALUES (?, ?)")
    .bind('fake_user_abc', 'Test User')
    .run();
}
```

This keeps FK enforcement ON (matching production), tests the FK cascade behavior alongside your other assertions, and avoids the connection-pool problem entirely.

---

## 4. `db.exec()` splits on newlines, not semicolons

### Error

```
D1_EXEC_ERROR: Error in line 1: CREATE TABLE IF NOT EXISTS user (: incomplete input: SQLITE_ERROR
```

### Why

D1's `exec()` splits the input string on **newline characters** and executes each line as a separate statement. A multi-line CREATE TABLE like:

```sql
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  ...
```

is split at the newline after `(`, so `exec()` tries to execute `CREATE TABLE IF NOT EXISTS user (` in isolation, which is syntactically incomplete.

### Fix

Two options:

**A. Collapse to one line** (for `exec()`):

```typescript
await db.exec("CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, ...)");
```

**B. Use `prepare().run()`** (which sends the full SQL string as-is):

```typescript
await db.prepare("CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, email TEXT NOT NULL DEFAULT '', ...)").run();
```

Option B also avoids the `exec()` newline trap and stays consistent with how every other D1 call in the project works. Use `exec()` only for single-line PRAGMA statements.

---

## 5. `applyD1Migrations` takes `D1Migration[]`, not a path

### Error

TypeScript error or runtime failure when calling:

```typescript
await applyD1Migrations(env.DB, './migrations');
```

### Why

The `applyD1Migrations` function from `cloudflare:test` has this signature:

```typescript
export function applyD1Migrations(
    db: D1Database,
    migrations: D1Migration[],      // Array of { name: string, queries: string[] }
    migrationsTableName?: string
): Promise<void>;
```

The second parameter is a `D1Migration[]` with pre-parsed queries, not a directory path. The function runs inside the Worker runtime (Miniflare) where filesystem access is unavailable.

### Fix

Read the migrations in the **config file** (Node.js context) and pass them to the test via Vitest's `provide`/`inject`:

```typescript
// vitest.config.ts
export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    // ...
    test: { provide: { migrations } },
  };
});

// smoke.spec.ts
import { inject } from 'vitest';
const migrations = inject<D1Migration[]>('migrations');

beforeEach(async () => {
  await applyD1Migrations(env.DB, migrations);
});
```

`readD1Migrations` reads the `.sql` files, splits them into statements correctly (handling multi-line DDL), and returns `D1Migration[]`. `provide` serializes it across the Node.js → Worker boundary. `inject` deserializes it in the test.

---

## 6. `describe`, `it`, `expect`, `beforeEach`, not defined

### Error

```
ReferenceError: describe is not defined
```

### Why

Vitest v4 does not set test globals by default. To use `describe`, `it`, `expect`, `beforeEach` without imports, you need `globals: true` in the config. Without it, they must be imported explicitly.

### Fix

```typescript
import { describe, it, expect, beforeEach, inject } from 'vitest';
```

The `inject` import is also from `vitest`, it retrieves values provided by the config's `test.provide`.

---

## 7. Missing semicolon on `PRAGMA foreign_keys` in migration file

### Error

```
[ERROR] near "INSERT": syntax error at offset 33: SQLITE_ERROR
```

Seen when running `wrangler d1 migrations apply DB --local`.

### Why

The `0001_enable_foreign_keys.sql` file contained:

```sql
PRAGMA foreign_keys = ON
```

without a trailing semicolon. Wrangler's migration runner concatenates statements sequentially. A missing semicolon leaves the SQL parser in an unterminated state, subsequent statements (including wrangler's own INSERT into the `d1_migrations` tracking table) inherit the broken parse context, causing the `"near INSERT"` error.

### Fix

```sql
PRAGMA foreign_keys = ON;
```

Every statement in every migration file must end with a semicolon. This is not optional, SQLite's parser requires explicit statement termination for correctness.

---

## 8. `useSession().data` does not exist — use `getSession()` for load/redirect guards

### Error

```
Property 'data' does not exist on type 'Atom<{ data: ... }>'
```

### Why

Better Auth's `useSession()` returns a Svelte 5 `Atom` (reactive rune), not a plain object with a `.data` property. The `sveltekit-route-architecture.md` §3.4 showed `authClient.useSession()` being used with `$session.data` in a layout guard — this API doesn't exist in Better Auth v1.6's Svelte client.

`useSession()` is intended for reactive component usage (template bindings, `$effect` watchers). Its atom API is not compatible with `throw redirect()` inside a `$effect()` in SvelteKit (redirects need to happen in load functions or synchronously in layout components, not from async callbacks).

### Fix

Use `getSession()` instead — it returns a plain `Promise<{ data, error }>`:

```typescript
// ✅ For auth guards (load functions, layout redirects)
const { data: session } = await authClient.getSession();
if (!session) throw redirect(302, '/sign-in');

// ❌ Not this — atom not compatible with redirect guards
const session = authClient.useSession();  // returns Atom, not usable with throw redirect
```

For the `(auth)` layout (pre-auth, redirects signed-in users away), use `getSession()` in a `$effect` with a `ready` gate:

```svelte
<script lang="ts">
  let ready = $state(false);
  $effect(() => {
    authClient.getSession().then(({ data: session }) => {
      if (session) throw redirect(302, '/guides');
      ready = true;
    });
  });
</script>

{#if ready}
  {@render children()}
{/if}
```

This avoids both the atom issue and the flash-of-form-before-redirect problem.

## 9. `@better-auth/d1` package does not exist (404 on npm)

### Error

```
pnpm add @better-auth/d1
[ERR_PNPM_FETCH_404] GET https://registry.npmjs.org/@better-auth%2Fd1: Not Found - 404
```

### Why

The `@better-auth/d1` package was never published to npm. The `auth-integration.md` doc referenced it as `import { d1 } from '@better-auth/d1'` based on an early draft of Better Auth's D1 support that never shipped as a separate adapter package.

Better Auth v1.5+ has **native D1 support** — you pass the D1 binding directly as `database: env.DB`. No adapter package is needed.

### Fix

Remove the `@better-auth/d1` import. Use native D1:

```typescript
import { betterAuth } from 'better-auth';

export function createAuth(env: CloudflareBindings) {
  return betterAuth({
    database: env.DB,  // native D1, no adapter
    // ...
  });
}
```

---

## 9. `auth.api.hashPassword` is not a public API

### Error

```
Property 'hashPassword' does not exist on type 'InferAPI<...>'
```

### Why

The `auth-integration.md` §5.2 recovery route snippet referenced `auth.api.hashPassword({ password: new_password })`. This method does not exist on the `auth.api` object in Better Auth v1.6. The password hashing function is an internal that is not exposed as an API endpoint.

### Fix

Import `hashPassword` directly from the `better-auth/crypto` sub-path:

```typescript
const { hashPassword } = await import('better-auth/crypto');
const hashedPassword = await hashPassword(new_password);
```

`better-auth/crypto` exports `hashPassword` and `verifyPassword` as standalone functions that match Better Auth's internal hashing (scrypt). Use this in any server-side context that needs to hash or verify passwords without going through the auth API (e.g. the recovery route`.

---

## 10. Better Auth CLI can't generate migrations for D1

### Error / Blockage

```
npx @better-auth/cli generate --config packages/api/src/auth.ts ...
```

### Why

Better Auth's CLI (`npx auth generate`, `npx @better-auth/cli generate`) needs to connect to a database to introspect existing tables and generate migration SQL. However, Cloudflare D1 bindings (`env.DB`) are only available inside a Worker request handler — they cannot be accessed at the command line.

Additionally, `createAuth` is a factory function that takes `env` as a parameter (called per-request), not a module-level `export const auth` — the CLI expects the latter to read `auth.options`.

### Fix

Two valid approaches, both used in this project:

**A. Manual SQL migration** (chosen for Slice 3): Define the core Better Auth tables (`user`, `session`, `account`, `verification`) as a standard D1 migration file. Copy the SQL schema from Better Auth's [database documentation](https://www.better-auth.com/docs/concepts/database#core-schema), adjusting types for SQLite (e.g. `INTEGER` for booleans, `TEXT` for dates). Tracked in `packages/api/migrations/0014_better_auth_core.sql`.

**B. Programmatic migration at runtime**: Use `getMigrations()` from `better-auth/db/migration` in a one-shot endpoint or test to auto-create missing tables. Better Auth's docs include a [Cloudflare D1 example](https://www.better-auth.com/docs/concepts/database#example-cloudflare-d1) for this approach.

---

## 11. `CloudflareBindings` type not found

### Error

```
Cannot find name 'CloudflareBindings'.
```

### Why

The `CloudflareBindings` interface is generated from `wrangler.jsonc` by `wrangler types --env-interface CloudflareBindings` (the `cf-typegen` script). The generated `worker-configuration.d.ts` file was never created.

### Fix

Run the type generation script from `packages/api`:

```bash
pnpm cf-typegen
```

This reads all bindings (D1, R2, etc.) from `wrangler.jsonc` and emits `worker-configuration.d.ts` with the correct `CloudflareBindings` interface.

Also install `@types/node` — required when `nodejs_compat` is enabled:

```bash
pnpm add -D @types/node
```

The generated types are picked up automatically since `tsconfig.json` has `skipLibCheck: true` and TypeScript resolves `.d.ts` files in the project root without an explicit `include`.

---

## 12. `signUpEmail` returns flat `{user, token}`, not `{data, error}`

### Error

```
expect(error).toBeNull(); // error is undefined
expect(data).toBeDefined(); // data is undefined
```

### Why

Better Auth's `auth.api.signUpEmail()` returns `{ user, token }` directly — there is no `data` or `error` wrapper. The `{ data, error }` pattern applies to the client SDK (`authClient.signUp.email()`), not the server API.

### Fix

Destructure directly from the response:

```typescript
const { user, token } = await auth.api.signUpEmail({ body: { email, password, name } });
expect(user.email).toBe(email);
expect(token).toBeDefined();
```

---

## 13. Recovery handler extracted for testability (Option A)

### Why inline testing was blocked

The recovery logic was embedded in a Hono route handler in `index.ts`. This made it impossible to test in isolation — you'd need to make real HTTP requests through a Hono app instance, which is fragile and slow.

### Fix

Extract the core logic into a reusable function `handleRecovery(db, email, code, newPassword)` in `lib/recovery.ts`. The route handler becomes a thin wrapper. Both unit tests and integration tests call `handleRecovery` directly without an HTTP layer.

---

## 14. Guarded route test needs explicit `env` passthrough

### Error

```
app.fetch(request) -> middleware reads c.env.DB, crashes because env is undefined
```

### Why

Hono's `app.fetch(request)` is overloaded — the second parameter is `env`, not optional in Workers. If omitted, `c.env` inside the middleware is `undefined`.

### Fix

Pass the `cloudflare:test` `env` object as the second argument, and type the Hono app correctly:

```typescript
const testApp = new Hono<{ Bindings: CloudflareBindings }>();
testApp.use('/api/*', requireAuth);
testApp.get('/api/stub', (c) => c.json({ ok: true }));
const res = await testApp.fetch(new Request('http://localhost/api/stub'), env);
```

The `cloudflare:test` `env` includes all bindings defined in `vitest.config.ts` (DB, BETTER_AUTH_SECRET, BETTER_AUTH_URL).

---

## 15. Playwright E2E needs both API and web servers running

### Why the old config was insufficient

The old `playwright.config.ts` started only the web preview server (`npm run build && npm run preview`). The API (needed for sign-up/sign-in/sign-out) was not running. The static preview server has no Vite proxy, so `/api/*` calls go to a server that isn't listening.

### Fix

Use Playwright's array `webServer` config (available v1.57+):

```typescript
webServer: [
  { command: 'npx wrangler dev --port 8787', port: 8787, cwd: '../api' },
  { command: 'npm run build && npm run preview', port: 4173, env: { VITE_API_BASE_URL: 'http://localhost:8787' } },
]
```

Also added `dev:e2e` script to `packages/api/package.json` for manual runs:

```bash
pnpm dev:e2e  # applies migrations + starts wrangler dev on port 8787
```

---

## 16. Invalid `...` spread in `auth.ts`

### Error

```typescript
return betterAuth({
  database: env.DB,
  secret: '...',
  baseURL: '...',
  ...  // <-- SyntaxError: unexpected token
});
```

### Why

The `...` was a placeholder left by the original author indicating "more config options go here," but it's not valid JavaScript/TypeScript — a spread operator (`...`) must spread an object, not stand alone.

### Fix

Replace with the full config object:

```typescript
return betterAuth({
  database: env.DB,
  secret: env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET || '',
  baseURL: env.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || 'http://localhost:8787',
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  trustedOrigins: ['http://localhost:5173', 'https://paragon.kelpselp.workers.dev'],
});
```

---

## 18. `env` deprecated from `cloudflare:test`, `inject('migrations')` type error, `res.json()` returns `unknown`

### Errors

```
'env' is deprecated ts(6385) — import { env } from "cloudflare:test"
Argument of type '"migrations"' is not assignable to parameter of type 'never'
'body' is of type 'unknown'
```

### Why

**`env` deprecation:** `@cloudflare/vitest-pool-workers` v0.17+ deprecated importing `env` from `cloudflare:test` in favor of `cloudflare:workers`. The `cloudflare:workers` module provides the same bindings at runtime, but the `@cloudflare/workers-types` package doesn't declare the `env` export yet, causing a missing-type error when switching.

**`inject('migrations')` type error:** Vitest 4's `inject()` is typed as `inject<T extends keyof ProvidedContext & string>(key: T): ProvidedContext[T]`. The `ProvidedContext` interface is empty by default, so `keyof ProvidedContext` resolves to `never` unless the interface is augmented. Passing `'migrations'` directly fails type-checking.

**`body` is `unknown`:** `Response.json()` returns `Promise<unknown>`. Accessing `.error` on an `unknown` value is not allowed without a type assertion.

### Fix

**`env.d.ts`** — add two module augmentations:

```typescript
/// <reference path="../../node_modules/@cloudflare/vitest-pool-workers/types/cloudflare-test.d.ts" />

import type { D1Migration } from "cloudflare:test";

declare module "cloudflare:workers" {
  const env: Cloudflare.Env;
  export { env };
}

declare module "vitest" {
  interface ProvidedContext {
    migrations: D1Migration[];
  }
}
```

- The `cloudflare:workers` augmentation adds the `env` named export that the runtime provides but the workers-types package doesn't declare.
- The `vitest` augmentation adds `migrations` to `ProvidedContext`, making `inject('migrations')` resolve to `D1Migration[]` instead of `never`.

**Test files** — update imports and types:

```typescript
// Before
import { env, applyD1Migrations } from 'cloudflare:test';
const migrations = inject('migrations') as D1Migration[];
const body = await res.json();

// After
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
const migrations = inject('migrations');       // no cast needed
const body = await res.json() as { error: string };  // explicit type
```

`applyD1Migrations` and `D1Migration` remain imported from `cloudflare:test` — only `env` moves to `cloudflare:workers`.

---

## 17. `seedUserStub` INSERT fails after `0014_better_auth_core.sql` migration

### Error

```
INSERT OR IGNORE INTO user (id, name) VALUES ('fake_user_abc', 'Test User')
```

appears to succeed (no crash) but `fake_user_abc` is never actually inserted because `email` is `TEXT NOT NULL` without a default.

### Why

The `0014_better_auth_core.sql` migration creates the `user` table with `email TEXT NOT NULL` (no default). The stub used `INSERT OR IGNORE INTO user (id, name)` — which inserts `NULL` for `email`, violating NOT NULL. With `OR IGNORE`, the row is silently skipped. Subsequent FK-dependent tests (system insert) fail because `fake_user_abc` doesn't exist in `user`.

### Fix

Include all NOT NULL columns in the INSERT:

```typescript
const now = new Date().toISOString();
await db.prepare(
  "INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
).bind('fake_user_abc', 'Test User', 'fake@test.com', 1, now, now).run();
```
