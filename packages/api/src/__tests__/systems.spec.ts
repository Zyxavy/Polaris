import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { describe, it, expect, beforeEach, inject } from 'vitest';
import { Hono } from 'hono';
import { createAuth } from '../auth';
import { requireAuth } from '../middleware/require-auth';
import systemsRoutes from '../routes/systems';

const migrations = inject('migrations');

async function getAuthedApp(userId: string) {
    const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: any; session: any} }>();
    app.use('/api/*', async (c, next) => {
        c.set('user', { id: userId, email: 'test@example.com' });
        c.set('session', { id: crypto.randomUUID(), userId });
        await next();
    });
    app.route('/api/systems', systemsRoutes);
    return app;
}

async function signUpAndGetUserId(email: string) {
    const auth = createAuth({
        DB: env.DB as D1Database,
        BETTER_AUTH_SECRET: 'paragon-test-secret-32-characters-min!',
        BETTER_AUTH_URL: 'http://localhost:8787',
    });
    const { user } = await (auth.api.signUpEmail({
        body: { email, password: 'password123', name: 'Test User' },
    }) as Promise<{ user: { id: string }; token: string }>);
    return user.id;
}

describe('systems routes', () => {
    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
    });

    it('POST /api/systems creates a system', async () => {
        const userId = await signUpAndGetUserId('sys1@test.com');
        const app = await getAuthedApp(userId);

        const res = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const userId = await signUpAndGetUserId('user2@test.com');
        const app = await getAuthedApp(userId);

        const res = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        }), env);

        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.error).toBe('invalid_input');
    });

    it('GET /api/systems lists owned systems', async () => {
        const userId = await signUpAndGetUserId('list@test.com');
        const app = await getAuthedApp(userId);

        await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'System A' }),
        }), env);

        await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'System B' }),
        }), env);

        const res = await app.fetch(new Request('http://localhost/api/systems', {
            headers: { 'Content-Type': 'application/json' },
        }), env);

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.systems).toHaveLength(2);
        expect(body.systems[0].name).toBe('System A');
    });

    it('GET /api/systems/?status= filters', async () => {
        const userId = await signUpAndGetUserId('user3@test.com');
        const app = await getAuthedApp(userId);

        await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Active System' }),
        }), env);

        const res = await app.fetch(new Request('http://localhost/api/systems?status=archived', {
            headers: { 'Content-Type': 'application/json' },
        }), env);

        const body = await res.json() as any;
        expect(body.systems).toHaveLength(0);
    });

    it('GET /api/systems/:id returns owned system', async () => {
        const userId = await signUpAndGetUserId('user4@test.com');
        const app = await getAuthedApp(userId);

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'My System' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}`, {
            headers: { 'Content-Type': 'application/json' },
        }), env);

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.id).toBe(created.id);
    });

    it('GET /api/systems/:id returns 404 for non-owned', async () => {
        const ownerId = await signUpAndGetUserId('owner@test.com');
        const otherId = await signUpAndGetUserId('other@test.com');
        const ownerApp = await getAuthedApp(ownerId);
        const otherApp = await getAuthedApp(otherId);

        const createRes = await ownerApp.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Secret System' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await otherApp.fetch(new Request(`http://localhost/api/systems/${created.id}`, {
            headers: { 'Content-Type': 'application/json' },
        }), env);

        expect(res.status).toBe(404);
    });

    it('PATCH /api/systems/:id partial update', async () => {
        const userId = await signUpAndGetUserId('user5@test.com');
        const app = await getAuthedApp(userId);

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Original', purpose: 'Old purpose' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ purpose: 'New purpose' }),
        }), env);

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.name).toBe('Original');
        expect(body.purpose).toBe('New purpose');
    });

    it('PATCH accepts floor_action: "" (autosave-safe)', async () => {
        const userId = await signUpAndGetUserId('user6@test.com');
        const app = await getAuthedApp(userId);

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Draft System' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ floor_action: '' }),
        }), env);

        expect(res.status).toBe(200);
    });

    it('PATCH /api/systems/:id returns 404 for non-owned', async () => {
        const ownerId = await signUpAndGetUserId('owner6@test.com');
        const otherId = await signUpAndGetUserId('other6@test.com');
        const ownerApp = await getAuthedApp(ownerId);
        const otherApp = await getAuthedApp(otherId);

        const createRes = await ownerApp.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Not Yours' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await otherApp.fetch(new Request(`http://localhost/api/systems/${created.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ purpose: 'Hacked' }),
        }), env);

        expect(res.status).toBe(404);
    });

    it('POST /confirm returns 422 when floor_action is empty', async () => {
        const userId = await signUpAndGetUserId('user7@test.com');
        const app = await getAuthedApp(userId);

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Incomplete System' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }), env);

        expect(res.status).toBe(422);
        const body = await res.json() as any;
        expect(body.error).toBe('floor_action_required');
    });

    it('POST /confirm returns 200 when floor_action is set', async () => {
        const userId = await signUpAndGetUserId('user8@test.com');
        const app = await getAuthedApp(userId);

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Complete System', floor_action: 'Open the book' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }), env);

        expect(res.status).toBe(200);
    });

    it('POST /confirm returns 404 for non-owned', async () => {
        const ownerId = await signUpAndGetUserId('owner9@test.com');
        const otherId = await signUpAndGetUserId('other9@test.com');
        const ownerApp = await getAuthedApp(ownerId);
        const otherApp = await getAuthedApp(otherId);

        const createRes = await ownerApp.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Not Yours' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await otherApp.fetch(new Request(`http://localhost/api/systems/${created.id}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }), env);

        expect(res.status).toBe(404);
    });

    it('POST /archive returns 200 and status=archived', async () => {
        const userId = await signUpAndGetUserId('user10@test.com');
        const app = await getAuthedApp(userId);

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'To Archive' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }), env);

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.status).toBe('archived');
    });

    it('POST /archive returns 409 if already archived', async () => {
        const userId = await signUpAndGetUserId('user11@test.com');
        const app = await getAuthedApp(userId);

        const createRes = await app.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Already Archived' }),
        }), env);
        const created = await createRes.json() as any;

        await app.fetch(new Request(`http://localhost/api/systems/${created.id}/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }), env);

        const res = await app.fetch(new Request(`http://localhost/api/systems/${created.id}/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }), env);

        expect(res.status).toBe(409);
        const body = await res.json() as any;
        expect(body.error).toBe('already_archived');
    });

    it('POST /archive returns 404 for non-owned', async () => {
        const ownerId = await signUpAndGetUserId('owner12@test.com');
        const otherId = await signUpAndGetUserId('other12@test.com');
        const ownerApp = await getAuthedApp(ownerId);
        const otherApp = await getAuthedApp(otherId);

        const createRes = await ownerApp.fetch(new Request('http://localhost/api/systems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Not Yours' }),
        }), env);
        const created = await createRes.json() as any;

        const res = await otherApp.fetch(new Request(`http://localhost/api/systems/${created.id}/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        }), env);

        expect(res.status).toBe(404);
    });

    it('returns 401 without session', async () => {
        const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: any; session: any } }>();
        app.use('/api/*', requireAuth);
        app.route('/api/systems', systemsRoutes);

        const res = await app.fetch(new Request('http://localhost/api/systems'), env);
        expect(res.status).toBe(401);
    });
})
