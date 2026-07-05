# D1 + Vitest Pitfalls

**Implementation status:** Current

Troubleshooting notes from Slice 2 (D1 schema + smoke integration tests). Each entry covers a concrete error, why it happened, and what the fix was.

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
