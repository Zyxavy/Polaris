import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { describe, it, expect, beforeEach, inject } from 'vitest';
import { Hono } from 'hono';
import { createAuth } from '../auth';
import { requireAuth } from '../middleware/require-auth';
import systemsRoutes from '../routes/systems';

const migrations = inject('migrations');

async function getAuthedApp() {
    const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: any; session: any} }>();

    app.use('/api/*', async (c, next) => {
        if (c.req.path.startsWith('/api/auth/')) return next();
        return requireAuth(c, next);
    });
    app.route('/api/systems', systemsRoutes);
    return app;
}

async function signUpAndGetCookie(auth: ReturnType<typeof createAuth>, email: string) {
    const { token } = await (auth.api.signUpEmail({
        body: { email, password: 'password123', name: 'Test User' },
    }) as Promise<{ user: any; token: string }>);
    return `better-auth.session_token=${token}`;
}

describe('systems routes', () => {
    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
    });

    it('POST /api/systems creates a system', async () => {
        const auth = createAuth({
            DB: env.DB as D1Database,
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
        });

        const app = await getAuthedApp();
        const cookie = await signUpAndGetCookie(auth, 'sys1@test.com');

        const res = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie},
            body: JSON.stringify({ name: 'Reading System', domain: 'Study' }),
        }), env);

        expect(res.status).toBe(201);
        const body = await res.json() as any;
        expect(body.name).toBe('Reading System');
        expect(body.domain).toBe('Study');
        expect(body.status).toBe('active');
        expect(Array.isArray(body.barrier_list)).toBe(true);
    });

    it('POST /api/systems rejects missing name', async () => {
        const auth = createAuth({
            DB: env.DB as D1Database,
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
        });
        const app = await getAuthedApp();
        const cookie = await signUpAndGetCookie(auth, 'user2@test.com');

        const res = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({}),
        }), env);

        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.error).toBe('invalid_input');
    });

    it('GET /api/systems lists owned systems', async () => {
        const auth = createAuth({
            DB: env.DB as D1Database,
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
        });
        const app = await getAuthedApp();
        const cookie = await signUpAndGetCookie(auth, 'list@test.com');

        await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ name: 'System A' }),
        }), env);

        await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ name: 'System B' }),
        }), env);

        const res = await app.fetch(new Request('http://localhost/api/systems', {
            headers: { Cookie: cookie },
        }), env);

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.systems).toHaveLength(2);
        expect(body.systems[0].name).toBe('System A');
    });

    it('GET /api/systems/?status= filters', async () => {
        const auth = createAuth({
            DB: env.DB as D1Database,
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
        });
        const app = await getAuthedApp();
        const cookie = await signUpAndGetCookie(auth, 'user3@test.com');

        await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ name: 'Active System' }),
        }), env);

        const res = await app.fetch(new Request('http://localhost/api/systems?status=archived', {
            headers: { Cookie: cookie },
        }), env);

        const body = await res.json() as any;
        expect(body.systems).toHaveLength(0);
    });

    it('GET /api/systems/:id returns owned system', async () => {
        const auth = createAuth({
            DB: env.DB as D1Database,
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
        });
        const app = await getAuthedApp();
        const cookie = await signUpAndGetCookie(auth, 'user4@test.com');

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ name: 'My System' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}`, {
            headers: { Cookie: cookie },
        }), env);

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.id).toBe(created.id);
    });

    it('GET /api/systems/:id returns 404 for non-owned', async () => {
        const auth = createAuth({
            DB: env.DB as D1Database,
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
        });
        const app = await getAuthedApp();
        const cookie1 = await signUpAndGetCookie(auth, 'owner@test.com');
        const cookie2 = await signUpAndGetCookie(auth, 'other@test.com');

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
            body: JSON.stringify({ name: 'Secret System' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}`, {
            headers: { Cookie: cookie2 },
        }), env);

        expect(res.status).toBe(404);
    });

    it('PATCH /api/systems/:id partial update', async () => {
        const auth = createAuth({
            DB: env.DB as D1Database,
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
        });
        const app = await getAuthedApp();
        const cookie = await signUpAndGetCookie(auth, 'user5@test.com');

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ name: 'Original', purpose: 'Old purpose' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ purpose: 'New purpose' }),
        }), env);

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.name).toBe('Original');
        expect(body.purpose).toBe('New purpose');
    });

    it('PATCH accepts floor_action: "" (autosave-safe)', async () => {
        const auth = createAuth({
            DB: env.DB as D1Database,
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
        });
        const app = await getAuthedApp();
        const cookie = await signUpAndGetCookie(auth, 'user6@test.com');

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ name: 'Draft System' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ floor_action: '' }),
        }), env);

        expect(res.status).toBe(200);
    });

    it('POST /confirm returns 422 when floor_action is empty', async () => {
        const auth = createAuth({
            DB: env.DB as D1Database,
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
        });
        const app = await getAuthedApp();
        const cookie = await signUpAndGetCookie(auth, 'user7@test.com');

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ name: 'Incomplete System' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}/confirm`, {
            method: 'POST',
            headers: { Cookie: cookie },
        }), env);

        expect(res.status).toBe(422);
        const body = await res.json() as any;
        expect(body.error).toBe('floor_action_required');
    });

    it('POST /confirm returns 200 when floor_action is set', async () => {
        const auth = createAuth({
            DB: env.DB as D1Database,
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
        });
        const app = await getAuthedApp();
        const cookie = await signUpAndGetCookie(auth, 'user8@test.com');

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ name: 'Complete System', floor_action: 'Open the book' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}/confirm`, {
            method: 'POST',
            headers: { Cookie: cookie },
        }), env);

        expect(res.status).toBe(200);
    });

    it('POST /archive returns 200 and status=archived', async () => {
        const auth = createAuth({
            DB: env.DB as D1Database,
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
        });
        const app = await getAuthedApp();
        const cookie = await signUpAndGetCookie(auth, 'user9@test.com');

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ name: 'To Archive' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}/archive`, {
            method: 'POST',
            headers: { Cookie: cookie },
        }), env);

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.status).toBe('archived');
    });

    it('POST /archive returns 409 if already archived', async () => {
        const auth = createAuth({
            DB: env.DB as D1Database,
            BETTER_AUTH_SECRET: 'polaris-test-secret-32-characters-min!',
            BETTER_AUTH_URL: 'http://localhost:8787',
        });
        const app = await getAuthedApp();
        const cookie = await signUpAndGetCookie(auth, 'user10@test.com');

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({ name: 'Already Archived' }),
        }), env);
        const created = await createRes.json() as any;

        await app.fetch(new Request(`http://localhost/api/systems/${created.id}/archive`, {
            method: 'POST',
            headers: { Cookie: cookie },
        }), env);

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}/archive`, {
            method: 'POST',
            headers: { Cookie: cookie },
        }), env);

        expect(res.status).toBe(409);
        const body = await res.json() as any;
        expect(body.error).toBe('already_archived');
    });

    it('returns 401 without session', async () => {
        const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: any; session: any } }>();
        app.use('/api/*', requireAuth);
        app.route('/api/systems', systemsRoutes);

        const res = await app.fetch(new Request('http://localhost/api/systems'), env);
        expect(res.status).toBe(401);
    });

})