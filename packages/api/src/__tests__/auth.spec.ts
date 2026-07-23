import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { describe, it, expect, beforeEach, inject } from 'vitest';
import { Hono } from 'hono';
import { createAuth } from '../auth';
import { requireAuth } from '../middleware/require-auth';
import { generateRecoveryCode, handleRecovery } from '../lib/recovery';

const migrations = inject('migrations');

describe('auth integration', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, migrations);
  });

  it('sign-up returns user and token', async () => {
    const auth = createAuth({
      DB: env.DB as D1Database,
      BETTER_AUTH_SECRET: 'paragon-test-secret-32-characters-min!',
      BETTER_AUTH_URL: 'http://localhost:8787',
    });
    const { user, token } = await (auth.api.signUpEmail({
      body: { email: 'test@example.com', password: 'password123', name: 'Test' },
    }) as Promise<{ user: { email: string; id: string }; token: string | null }>);
    expect(user.email).toBe('test@example.com');
    expect(token).toBeDefined();
  });

  it('guarded route returns 401 without session', async () => {
    const testApp = new Hono<{ Bindings: CloudflareBindings }>();
    testApp.use('/api/*', requireAuth);
    testApp.get('/api/stub', (c) => c.json({ ok: true }));

    const res = await testApp.fetch(new Request('http://localhost/api/stub'), env);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('unauthorized');
  });

  it('recovery flow: code resets password and cannot be reused', async () => {
    const auth = createAuth({
      DB: env.DB as D1Database,
      BETTER_AUTH_SECRET: 'paragon-test-secret-32-characters-min!',
      BETTER_AUTH_URL: 'http://localhost:8787',
    });

    const { user } = await (auth.api.signUpEmail({
      body: { email: 'recover@test.com', password: 'oldpass123', name: 'Recovery' },
    }) as Promise<{ user: { email: string; id: string }; token: string | null }>);
    const userId = user.id;

    const code = generateRecoveryCode();
    await env.DB.prepare(
      "INSERT INTO recovery_codes (id, user_id, code, created_at) VALUES (?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), userId, code, new Date().toISOString()).run();

    const result = await handleRecovery(env.DB, 'recover@test.com', code, 'newpass456');
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);

    const reuse = await handleRecovery(env.DB, 'recover@test.com', code, 'anotherpass789');
    expect(reuse.success).toBe(false);
    expect(reuse.status).toBe(401);
  });
});