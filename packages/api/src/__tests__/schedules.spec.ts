import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { describe, it, expect, beforeEach, inject } from 'vitest';
import { Hono } from 'hono';
import schedulesRoutes from '../routes/schedules';
import systemsRoutes from '../routes/systems';

const migrations = inject('migrations');

async function getAuthedApp(userId: string) {
    const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: any; session: any } }>();
    app.use('/api/*', async (c, next) => {
        c.set('user', { id: userId, email: 'test@example.com' });
        c.set('session', { id: crypto.randomUUID(), userId });
        await next();
    });
    app.route('/api/systems', systemsRoutes);
    app.route('/api/systems/:system_id/schedules', schedulesRoutes);
    app.route('/api/schedules', schedulesRoutes);
    return app;
}

async function signUpAndGetUserId(email: string) {
    const { createAuth } = await import('../auth');
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

describe('schedules routes', () => {
    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
    });

    describe('POST /api/systems/:system_id/schedules', () => {
        it('creates a schedule', async () => {
            const userId = await signUpAndGetUserId('sch1@test.com');
            const app = await getAuthedApp(userId);

            const createRes = await app.fetch(new Request('http://localhost/api/systems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test System' }),
            }), env);
            const system = await createRes.json() as any;

            const res = await app.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_of_week: 21, time_window_start: '06:00', time_window_end: '08:00' }),
            }), env);

            expect(res.status).toBe(201);
            const body = await res.json() as any;
            expect(body.days_of_week).toBe(21);
            expect(body.time_window_start).toBe('06:00');
            expect(body.time_window_end).toBe('08:00');
            expect(body.recurrence).toBe('weekly');
            expect(body.system_id).toBe(system.id);
        });

        it('rejects invalid window (end <= start)', async () => {
            const userId = await signUpAndGetUserId('sch2@test.com');
            const app = await getAuthedApp(userId);

            const createRes = await app.fetch(new Request('http://localhost/api/systems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test System' }),
            }), env);
            const system = await createRes.json() as any;

            const res = await app.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_of_week: 1, time_window_start: '08:00', time_window_end: '06:00' }),
            }), env);

            expect(res.status).toBe(422);
            const body = await res.json() as any;
            expect(body.error).toBe('invalid_window');
        });

        it('rejects missing days_of_week', async () => {
            const userId = await signUpAndGetUserId('sch3@test.com');
            const app = await getAuthedApp(userId);

            const createRes = await app.fetch(new Request('http://localhost/api/systems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test System' }),
            }), env);
            const system = await createRes.json() as any;

            const res = await app.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ time_window_start: '06:00', time_window_end: '08:00' }),
            }), env);

            expect(res.status).toBe(400);
        });

        it('rejects out-of-range days_of_week (>127)', async () => {
            const userId = await signUpAndGetUserId('sch4@test.com');
            const app = await getAuthedApp(userId);

            const createRes = await app.fetch(new Request('http://localhost/api/systems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test System' }),
            }), env);
            const system = await createRes.json() as any;

            const res = await app.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_of_week: 255, time_window_start: '06:00', time_window_end: '08:00' }),
            }), env);

            expect(res.status).toBe(400);
        });

        it('returns 404 for non-owned system', async () => {
            const ownerId = await signUpAndGetUserId('sch5a@test.com');
            const otherId = await signUpAndGetUserId('sch5b@test.com');
            const ownerApp = await getAuthedApp(ownerId);
            const otherApp = await getAuthedApp(otherId);

            const createRes = await ownerApp.fetch(new Request('http://localhost/api/systems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test System' }),
            }), env);
            const system = await createRes.json() as any;

            const res = await otherApp.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_of_week: 1, time_window_start: '06:00', time_window_end: '08:00' }),
            }), env);

            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/systems/:system_id/schedules', () => {
        it('lists schedules for a system', async () => {
            const userId = await signUpAndGetUserId('sch6@test.com');
            const app = await getAuthedApp(userId);

            const createRes = await app.fetch(new Request('http://localhost/api/systems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test System' }),
            }), env);
            const system = await createRes.json() as any;

            await app.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_of_week: 1, time_window_start: '06:00', time_window_end: '08:00' }),
            }), env);

            const res = await app.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`), env);

            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.schedules).toHaveLength(1);
        });

        it('returns 404 for non-owned system', async () => {
            const ownerId = await signUpAndGetUserId('sch7a@test.com');
            const otherId = await signUpAndGetUserId('sch7b@test.com');
            const ownerApp = await getAuthedApp(ownerId);
            const otherApp = await getAuthedApp(otherId);

            const createRes = await ownerApp.fetch(new Request('http://localhost/api/systems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test System' }),
            }), env);
            const system = await createRes.json() as any;

            const res = await otherApp.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`), env);

            expect(res.status).toBe(404);
        });
    });

    describe('PATCH /api/schedules/:id', () => {
        it('updates a schedule', async () => {
            const userId = await signUpAndGetUserId('sch8@test.com');
            const app = await getAuthedApp(userId);

            const sysRes = await app.fetch(new Request('http://localhost/api/systems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test System' }),
            }), env);
            const system = await sysRes.json() as any;

            const createRes = await app.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_of_week: 1, time_window_start: '06:00', time_window_end: '08:00' }),
            }), env);
            const created = await createRes.json() as any;

            const res = await app.fetch(new Request(`http://localhost/api/schedules/${created.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_of_week: 3, time_window_start: '07:00' }),
            }), env);

            expect(res.status).toBe(200);
            const body = await res.json() as any;
            expect(body.days_of_week).toBe(3);
            expect(body.time_window_start).toBe('07:00');
            expect(body.time_window_end).toBe('08:00');
        });

        it('rejects patch with invalid window', async () => {
            const userId = await signUpAndGetUserId('sch9@test.com');
            const app = await getAuthedApp(userId);

            const sysRes = await app.fetch(new Request('http://localhost/api/systems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test System' }),
            }), env);
            const system = await sysRes.json() as any;

            const createRes = await app.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_of_week: 1, time_window_start: '06:00', time_window_end: '08:00' }),
            }), env);
            const created = await createRes.json() as any;

            const res = await app.fetch(new Request(`http://localhost/api/schedules/${created.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ time_window_start: '09:00', time_window_end: '08:00' }),
            }), env);

            expect(res.status).toBe(422);
        });

        it('returns 404 for non-owned schedule', async () => {
            const ownerId = await signUpAndGetUserId('sch10a@test.com');
            const otherId = await signUpAndGetUserId('sch10b@test.com');
            const ownerApp = await getAuthedApp(ownerId);
            const otherApp = await getAuthedApp(otherId);

            const sysRes = await ownerApp.fetch(new Request('http://localhost/api/systems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test System' }),
            }), env);
            const system = await sysRes.json() as any;

            const createRes = await ownerApp.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_of_week: 1, time_window_start: '06:00', time_window_end: '08:00' }),
            }), env);
            const created = await createRes.json() as any;

            const res = await otherApp.fetch(new Request(`http://localhost/api/schedules/${created.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_of_week: 63 }),
            }), env);

            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/schedules/:id', () => {
        it('deletes a schedule', async () => {
            const userId = await signUpAndGetUserId('sch11@test.com');
            const app = await getAuthedApp(userId);

            const sysRes = await app.fetch(new Request('http://localhost/api/systems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test System' }),
            }), env);
            const system = await sysRes.json() as any;

            const createRes = await app.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_of_week: 1, time_window_start: '06:00', time_window_end: '08:00' }),
            }), env);
            const created = await createRes.json() as any;

            const delRes = await app.fetch(new Request(`http://localhost/api/schedules/${created.id}`, {
                method: 'DELETE',
            }), env);

            expect(delRes.status).toBe(200);
            const body = await delRes.json() as any;
            expect(body.deleted).toBe(true);

            // Verify it's gone
            const listRes = await app.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`), env);
            const listBody = await listRes.json() as any;
            expect(listBody.schedules).toHaveLength(0);
        });

        it('returns 404 for non-owned schedule', async () => {
            const ownerId = await signUpAndGetUserId('sch12a@test.com');
            const otherId = await signUpAndGetUserId('sch12b@test.com');
            const ownerApp = await getAuthedApp(ownerId);
            const otherApp = await getAuthedApp(otherId);

            const sysRes = await ownerApp.fetch(new Request('http://localhost/api/systems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test System' }),
            }), env);
            const system = await sysRes.json() as any;

            const createRes = await ownerApp.fetch(new Request(`http://localhost/api/systems/${system.id}/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_of_week: 1, time_window_start: '06:00', time_window_end: '08:00' }),
            }), env);
            const created = await createRes.json() as any;

            const res = await otherApp.fetch(new Request(`http://localhost/api/schedules/${created.id}`, {
                method: 'DELETE',
            }), env);

            expect(res.status).toBe(404);
        });
    });
});