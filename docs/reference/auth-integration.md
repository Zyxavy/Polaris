# Auth Integration

**Project:** *Polaris*

**Document type:** Integration reference; the actual wiring between Better Auth, the Hono API Worker, and the SvelteKit frontend. Companion to the [Tech Stack ADR](../ADRs/001-tech-stack-adr.md) S5.6 (owns the decision to use Better Auth over Clerk) and the [API Route Design](api-routes.md) (owns everything under `/api/*` except `/api/auth/*`, which this document owns). This document owns the actual server config, middleware, and hand-built UI structure.

**Status:** Draft, v1 scope

**Last updated:** July 1, 2026

---

## 1. Server-Side Config

### 1.1 Better Auth instance

```typescript
// packages/api/src/auth.ts
import { betterAuth } from 'better-auth';
import { d1 } from '@better-auth/d1';   // confirm exact adapter package name against Better Auth's current docs before scaffolding; package naming for D1 adapters has shifted across Better Auth versions

export function createAuth(env: CloudflareBindings) {
  return betterAuth({
    database: d1({ db: env.DB }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,   // no verification wall, per PRD S6.0
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,      // 30 days
      updateAge: 60 * 60 * 24,           // refresh the cookie if used within the last day
    },
    trustedOrigins: [
      'http://localhost:5173',                          // Vite dev server
      'https://polaris.kelpselp.workers.dev',       // production frontend origin
    ],
  });
}
```

`createAuth` is a function, not a module-level singleton, because `env.DB` is only available inside a request handler in the Workers runtime (bindings aren't accessible at module load time); it's called once per request from the Hono middleware in S1.2, not instantiated globally.

**Confirm before scaffolding:** the exact Better Auth D1 adapter import path and config shape against Better Auth's current documentation. Better Auth's D1 support and package structure have moved between versions; this snippet is the shape as of this document's writing, not a copy-paste guarantee. Same caution applies to `session.updateAge`/`expiresIn` field names; verify against the installed version's types before relying on them.

### 1.2 Mounting into Hono

```typescript
// packages/api/src/index.ts
import { Hono } from 'hono';
import { createAuth } from './auth';

const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: User | null; session: Session | null } }>();

app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});
```

This one route block is the entirety of `/api/auth/*`; sign-up, sign-in, sign-out, session lookup, and password-reset-token handling (if built, see S5) are all dispatched internally by Better Auth's own handler based on the sub-path. Nothing here needs to be hand-written; the API Route Design doc correctly left this tree undesigned.

### 1.3 Auth guard middleware for everything else

```typescript
// packages/api/src/middleware/require-auth.ts
import type { MiddlewareHandler } from 'hono';
import { createAuth } from '../auth';

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: 'unauthorized', message: 'Sign in required.' }, 401);
  }

  c.set('user', session.user);
  c.set('session', session.session);
  await next();
};

// packages/api/src/index.ts
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth/')) return next();   // Better Auth's own routes, no guard
  return requireAuth(c, next);
});
```

Every route handler downstream reads `c.get('user').id` for the `user_id` scoping and ownership-check pattern established in API Route Design S1.5; that document assumes this middleware has already run and rejected unauthenticated requests before any handler-specific logic executes, which is why none of its route definitions repeat an auth check.

---

## 2. Session Cookie Configuration

Better Auth manages the cookie itself (name, `httpOnly`, `sameSite`, expiry) based on the `session` config in S1.1; this section covers the parts that need explicit attention for this specific deployment shape (two separate Workers, `*.workers.dev`, no custom domain).

| Setting | Value | Why |
|---|---|---|
| `httpOnly` | `true` (Better Auth default) | Session token never touchable from frontend JS, irrelevant attack surface for XSS to exploit |
| `secure` | `true` in production, relaxed in dev | `*.workers.dev` and `localhost` both need to work; Better Auth typically infers this from the request's protocol, confirm this against the installed version rather than hardcoding |
| `sameSite` | `lax` | The frontend (`packages/web`, static assets) and the API (`packages/api`, Worker) are **separate deployments on separate subdomains** even though both are `*.workers.dev`; this is a cross-origin request from the cookie's point of view, so `sameSite: strict` would silently break every authenticated request. `lax` is the correct default for a same-site-navigation-friendly, cross-subdomain-fetch setup; `none` is unnecessary here since both origins share the `workers.dev` registrable domain in most cookie-scoping implementations, but if cookies aren't being sent as expected in testing, `sameSite: none` + `secure: true` is the fallback, not `strict`. |
| domain scope | not explicitly set | Do not set an explicit cookie `domain` of `.workers.dev`; that's a public suffix, and browsers reject cookies scoped to a public suffix outright. Leave it unset so the cookie defaults to the exact issuing subdomain. |

**Frontend fetch requirement:** every API call from SvelteKit must include `credentials: 'include'`; without it, the session cookie is never sent, and every request looks unauthenticated regardless of server config. This applies to the hand-rolled fetch wrapper (S4.1) and to `authClient` calls alike; Better Auth's client SDK handles this internally for its own calls, but any direct `fetch()` to `/api/*` (i.e. everything in API Route Design) must set it explicitly.

---

## 3. CSRF and the Vite Dev Proxy

ADR 001 S8's open risk table flags "Better Auth CSRF blocks Vite proxy in dev" with the stated mitigation "configured `trustedOrigins` for `localhost:5173`"; S1.1 above implements that. Two things worth being explicit about beyond just listing the origin:

1. **Vite's dev proxy must forward the `Origin` header unmodified.** If `vite.config.ts`'s proxy config rewrites or strips headers on the way to the API Worker (some proxy configs do this by default for `changeOrigin: true` setups), Better Auth's origin check sees the proxy's origin, not the browser's, and rejects the request even with `trustedOrigins` correctly set. Confirm the proxy config preserves the original `Origin` header; this is a common, easy-to-miss dev-only failure mode that won't reproduce in production (no proxy there).
2. **`trustedOrigins` in production must exactly match the deployed frontend's origin**, including scheme. A mismatch here (e.g. an `http://` entry left over from a testing pass, or a trailing slash) fails closed; every sign-in attempt in production would `403` at the Better Auth layer before ever reaching application code, which is a nasty one to debug from a Worker's log output alone; worth adding an explicit request log line if this is throwing away requests silently in v1.

---

## 4. Frontend Integration

### 4.1 Auth client setup

```typescript
// packages/web/src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,   // e.g. https://polaris-api.kelpselp.workers.dev in prod, proxied path in dev
});

export const { useSession, signIn, signOut, signUp } = authClient;
```

`useSession()` returns a Svelte 5 runes-compatible store (ADR 001 S5.6), usable directly in `$derived`/`$effect` in any component or in a root layout to gate rendering. This is the primitive the [SvelteKit Route Architecture doc](sveltekit-route-architecture.md) builds the auth-guarded layout around; this document stops at "the store exists and is reactive," not "here is the route tree that consumes it."

### 4.2 Hand-built forms, what's actually custom

ADR 001 S5.6 already names the tradeoff ("sign-up/sign-in UI is hand-built... form fields, validation, error handling, loading states are all custom"). Concretely, per form:

**Sign-up:**

```typescript
async function handleSignUp(email: string, password: string, name: string) {
  const { data, error } = await authClient.signUp.email({ email, password, name });
  if (error) {
    // Better Auth returns a structured error - map error.message to inline form feedback
    // Common cases to handle explicitly: "user already exists", password policy violations
    return;
  }
  // success: session cookie is already set by this call - redirect to Guides tab per PRD S6.0 step 3
  goto('/guides');
}
```

**Sign-in:** same shape via `authClient.signIn.email({ email, password })`, redirect target is the Dashboard (PRD S6.0 flow: "signs back in -> lands on Dashboard"; note this differs from the *first* sign-up redirect target, which is the Guides tab, not the Dashboard; these are two different post-auth destinations by design, worth keeping distinct in the route logic rather than collapsing to one "post-login redirect" constant).

**Sign-out:** `authClient.signOut()`, redirect to the pre-auth landing page.

**What's not built in v1:** email verification UI (disabled server-side per S1.1), OAuth buttons (not in scope per ADR 001 S5.6), remember-me toggle (Better Auth's session expiry in S1.1 is already a flat 30 days for every session, no shorter-lived option offered).

---

## 5. Open Gap: Password Reset Has No Email Delivery Path

ADR 001 S5.6 lists password reset as a known cost of leaving Clerk ("Password reset flow requires explicit configuration and UI... Clerk handled it automatically") but the tech stack (ADR 001 S3) has **no email-sending service** in it at all; no SendGrid, Resend, Postmark, or equivalent. Better Auth's password reset flow works by emailing a reset token/link; without an email provider, that flow cannot function regardless of how much Hono/UI code is written for it.

This wasn't resolved by anything upstream of this document and needs an explicit decision before password reset can ship:

1. **Add an email provider.** A transactional email service (Resend has a workable free tier and a straightforward HTTP API, which fits the Workers-first shape of this stack better than an SMTP-based provider would) becomes a new stack dependency, with its own free-tier ceiling to check and its own entry in ADR 001 S3 and S8.
2. **Skip password reset in v1, with a real (verified) manual recovery path.** This is a single-user personal app; if the one account holder forgets their password, a manual fix is workable, but it's more involved than a plain SQL `UPDATE`. See S5.1 below for what actually works and what doesn't.
3. **A lightweight self-service fallback that doesn't need email**, e.g. a recovery code generated and shown once at sign-up, which the user is expected to store themselves (password manager, physical note). No delivery infrastructure needed, but it's a UX pattern the user has to opt into remembering, and Better Auth doesn't have this as a first-class flow (would need custom implementation on top of it, not a config flag).

**Recommendation:** Option 3 for v1, revisit Option 1 if this ever stops being a single-operator personal tool. See S5.2 for implementation.

### 5.1 What manual recovery would require (for reference -- not the chosen path)

Two tempting shortcuts both turn out to be wrong:

- **Plain `UPDATE account SET password = 'newpassword' WHERE userId = ...`** doesn't work; `account.password` stores a hash, not plaintext, so this would just make the account permanently unauthenticatable with the "new" value instead of resetting it to something usable.
- **`DELETE FROM account WHERE userId = ...` followed by signing up again with the same email** also doesn't work as a simple fix, for a different reason than the hashing problem: Better Auth's sign-up flow checks email uniqueness against the `user` table, not `account`; so with the `user` row still intact, a repeat sign-up is very likely rejected as "user already exists" before a new `account` row is ever created. And if the `user` row were deleted instead (to work around that), `ON DELETE CASCADE` on `systems.user_id -> user(id)` (D1 Schema S2, S3.1) would take every System, Instance, and Review down with it; the "recovery" would erase the entire dataset password reset was supposed to get you back into.

**Better Auth does have an admin-facing `setUserPassword` method** (`auth.api.setUserPassword({ body: { userId, newPassword } })`, via the `admin` plugin) that sets a password by `userId` directly, correctly hashed, with no email flow required. The catch: it's gated behind `sessionMiddleware`; it requires the caller to already hold a valid admin session, which is exactly what a fully locked-out user doesn't have. This is a known, still-open gap in Better Auth itself (tracked as [better-auth/better-auth#4454](https://github.com/better-auth/better-auth/issues/4454), requesting an unauthenticated-by-session, `userId`-only variant for exactly this kind of ad-hoc admin recovery). As of this document's writing, there is no built-in path that is simultaneously session-free and produces a correctly-hashed password without custom code.

**The actual recovery procedure, if Option 2 is chosen:** a one-off local script (run with `wrangler d1 execute` or a small Node/`tsx` script against the D1 binding, not an HTTP route, never deployed) that imports Better Auth's own password-hashing function (exported from the library; confirm the exact import path against the installed version, this has moved between releases) to compute a real hash for the new password, then issues `UPDATE account SET password = ? WHERE userId = ?` with that computed hash. This preserves `user.id` and therefore every FK-linked row, and never touches the sign-up flow or the session system at all. This is more setup than "run one UPDATE," so it's worth writing and testing this script once, ahead of time, while you still have access, not improvising it for the first time during an actual lockout.

---

### 5.2 Recovery code implementation

**Approach:** 3 recovery codes, generated at sign-up, stored plaintext in D1, displayed to the user with a "Save these somewhere safe" notice. Settings page shows them with a hide/show toggle.

**`recovery_codes` table (defined in ADR 002 S2):**

```sql
CREATE TABLE recovery_codes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,   -- plaintext, for settings display
  created_at  TEXT NOT NULL,
  used_at     TEXT
);

CREATE INDEX idx_recovery_codes_user_id ON recovery_codes(user_id);
```

**Code format:** `POLARIS-XXXX-XXXX` where each `X` is a random alphanumeric char (uppercase + digits). Generated with `crypto.randomUUID()` truncated to 8 chars per segment -- no external dependencies.

**Sign-up flow:**

1. Frontend calls `authClient.signUp.email({ email, password, name })` -- unchanged.
2. On success, frontend calls `POST /api/recovery-codes/generate` (authenticated) which:
   - Deletes any existing unused codes for this user (safety net for re-generation).
   - Generates 3 codes, inserts into `recovery_codes`.
   - Returns `{ "codes": ["POLARIS-XXXX-XXXX", ...] }`.
3. Frontend displays all 3 codes in a green banner with a "I've saved these" button.
4. User acknowledges; codes are never shown in full again outside settings.

**Settings display:**

`GET /api/recovery-codes` (authenticated) returns all unused codes for the user. Settings page renders them with a hide/show toggle (toggles between `POLARIS-****-****` and the full plaintext). A "Regenerate" button calls `POST /api/recovery-codes/generate` again.

**Recovery route (`POST /api/auth/recover`):**

Registered in Hono BEFORE the Better Auth catch-all handler so it takes precedence:

```typescript
// packages/api/src/index.ts
import { createAuth } from './auth';

app.post('/api/auth/recover', async (c) => {
  const { email, recovery_code, new_password } = await c.req.json();

  // Validate inputs
  if (!email || !recovery_code || !new_password) {
    return c.json({ error: 'validation_error', message: 'Email, recovery code, and new password are required.' }, 400);
  }
  if (new_password.length < 8) {
    return c.json({ error: 'validation_error', message: 'Password must be at least 8 characters.' }, 400);
  }

  const db = c.env.DB as D1Database;

  // Find the user by email
  const user = await db.prepare('SELECT id FROM user WHERE email = ?').bind(email).first<{ id: string }>();
  if (!user) {
    return c.json({ error: 'invalid_credentials', message: 'Invalid email or recovery code.' }, 401);
  }

  // Find a matching unused recovery code -- constant-time comparison not needed for personal app
  const codes = await db.prepare(
    "SELECT id, code FROM recovery_codes WHERE user_id = ? AND used_at IS NULL"
  ).bind(user.id).all<{ id: string; code: string }>();

  const match = codes.results?.find(row => row.code === recovery_code);
  if (!match) {
    return c.json({ error: 'invalid_credentials', message: 'Invalid email or recovery code.' }, 401);
  }

  // Mark code as used
  await db.prepare("UPDATE recovery_codes SET used_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), match.id).run();

  // Hash the new password using Better Auth's hashing function
  const auth = createAuth(c.env);
  const hashedPassword = await auth.api.hashPassword({ password: new_password });

  // Update the account password
  await db.prepare("UPDATE account SET password = ? WHERE userId = ?")
    .bind(hashedPassword, user.id).run();

  return c.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
});

// Better Auth catch-all handler -- registered AFTER the recovery route
app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});
```

Note: the guard middleware (`app.use('/api/*', ...)`) already passes `/api/auth/*` through without authentication, so `POST /api/auth/recover` is reachable by a locked-out user without needing any middleware change.

**Recovery codes are not backed up:** The codes are stored in D1, which is backed up as part of D1's natural backup strategy (same DB as everything else). If the user loses both password AND recovery codes, the manual CLI procedure from S5.1 remains available as a last-resort option.

---

## 6. What This Document Does Not Cover

- **The SvelteKit route tree and auth-guarded layout** (which pages redirect to sign-in, where `useSession()` is consulted), that's covered in the [SvelteKit Route Architecture doc](sveltekit-route-architecture.md).
- **Account deletion**, not mentioned anywhere in the PRD's scope (S3 Non-Goals doesn't list it either way); if it's needed, it's a Better Auth-provided flow (`authClient.deleteUser`) plus the `ON DELETE CASCADE` behavior already specified from `user` down through every table in the D1 Schema doc S2/S3; the cascade is already correct for this, nothing here would need to change, only a route and a confirmation UI would need to be added.