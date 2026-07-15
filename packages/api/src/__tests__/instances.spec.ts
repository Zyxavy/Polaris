import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { describe, it, expect, beforeEach, afterEach, vi, inject } from 'vitest';
import { Hono } from 'hono';
import { generateTodayInstances } from '../services/instances';
import dashboardRoutes from '../routes/dashboard';
import { instanceRoutes } from '../routes/instances';

const migrations = inject('migrations');

const USER_ID = 'fake_user_abc';

async function seedUserStub(db: D1Database) {
    const now = new Date().toISOString();
    await db.prepare(
        `INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(USER_ID, 'Test User', 'test@test.com', 1, now, now).run();
}

function getAuthedApp(userId = USER_ID) {
    const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: any; session: any } }>();
    app.use('/api/*', async (c, next) => {
        c.set('user', { id: userId, email: 'test@test.com' });
        c.set('session', { id: crypto.randomUUID(), userId });
        await next();
    });
    app.route('/api/dashboard', dashboardRoutes);
    app.route('/api/instances', instanceRoutes);
    return app;
}

async function seedActiveSystem(db: D1Database, overrides?: {
    days_of_week?: number;
    time_window_start?: string;
}): Promise<string> {
    const systemId = crypto.randomUUID();
    const scheduleId = crypto.randomUUID();
    const now = new Date().toISOString();
    const dow = overrides?.days_of_week ?? 127;
    const tws = overrides?.time_window_start ?? '00:00';

    await db.prepare(
        `INSERT INTO systems (id, user_id, name, domain, floor_action, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(systemId, USER_ID, 'Test System', 'health', 'Do the thing', 'active', now, now).run();

    await db.prepare(
        `INSERT INTO schedules (id, system_id, days_of_week, time_window_start, time_window_end, recurrence, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(scheduleId, systemId, dow, tws, '23:59', 'weekly', now, now).run();

    return systemId;
}

async function countInstances(db: D1Database): Promise<number> {
    const row = await db.prepare('SELECT COUNT(*) as cnt FROM instances').first<{ cnt: number }>();
    return row!.cnt;
}

// Suite 1: Idempotency

describe('generateTodayInstances idempotency', () => {
    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
        await seedUserStub(env.DB);
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-15T06:00:00.000Z'));
    });
    afterEach(() => { vi.useRealTimers(); });

    it('does not create duplicate Instances on second call (service function)', async () => {
        await seedActiveSystem(env.DB);

        await generateTodayInstances(env.DB, USER_ID);
        expect(await countInstances(env.DB)).toBe(1);

        await generateTodayInstances(env.DB, USER_ID);
        expect(await countInstances(env.DB)).toBe(1);
    });

    it('does not create duplicates via the dashboard route', async () => {
        await seedActiveSystem(env.DB);
        const app = getAuthedApp();

        const res1 = await app.fetch(new Request('http://localhost/api/dashboard'), env);
        expect(res1.status).toBe(200);
        const body1 = await res1.json() as any;
        expect(body1.instances).toHaveLength(1);

        const res2 = await app.fetch(new Request('http://localhost/api/dashboard'), env);
        expect(res2.status).toBe(200);
        const body2 = await res2.json() as any;
        expect(body2.instances).toHaveLength(1);
        expect(body2.instances[0].id).toBe(body1.instances[0].id);
    });
});

// Suite 2: State transition

describe('PATCH /api/instances/:id', () => {
    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
        await seedUserStub(env.DB);
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-15T06:00:00.000Z'));
    });
    afterEach(() => { vi.useRealTimers(); });

    it('transitions pending to full and updates updated_at', async () => {
        const systemId = await seedActiveSystem(env.DB);
        const now = new Date().toISOString();
        const instanceId = crypto.randomUUID();
        await env.DB.prepare(
            `INSERT INTO instances (id, system_id, date, state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(instanceId, systemId, '2026-07-15', 'pending', now, now).run();

        const app = getAuthedApp();
        const res = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: 'full' }),
        }), env);

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.state).toBe('full');
        expect(body.updated_at).not.toBe(now);
    });

    it('rejects setting state to pending', async () => {
        const systemId = await seedActiveSystem(env.DB);
        const instanceId = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare(
            `INSERT INTO instances (id, system_id, date, state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(instanceId, systemId, '2026-07-15', 'pending', now, now).run();

        const app = getAuthedApp();
        const res = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: 'pending' }),
        }), env);

        expect(res.status).toBe(422);
        const body = await res.json() as any;
        expect(body.error).toBe('invalid_transition');
    });

    it('returns 400 for empty body', async () => {
        const systemId = await seedActiveSystem(env.DB);
        const instanceId = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare(
            `INSERT INTO instances (id, system_id, date, state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(instanceId, systemId, '2026-07-15', 'pending', now, now).run();

        const app = getAuthedApp();
        const res = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        }), env);

        expect(res.status).toBe(400);
    });

    it('returns 404 for non-owned instance', async () => {
        const otherUserId = 'other_user_xyz';
        await env.DB.prepare(
            `INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(otherUserId, 'Other', 'other@test.com', 1, new Date().toISOString(), new Date().toISOString()).run();

        const systemId = await seedActiveSystem(env.DB);
        const instanceId = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare(
            `INSERT INTO instances (id, system_id, date, state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(instanceId, systemId, '2026-07-15', 'pending', now, now).run();

        const app = getAuthedApp(otherUserId);
        const res = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: 'full' }),
        }), env);

        expect(res.status).toBe(404);
    });
});

// Suite 3: Window-gated filter

describe('GET /api/dashboard window gate', () => {
    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
        await seedUserStub(env.DB);
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-15T06:00:00.000Z'));
    });
    afterEach(() => { vi.useRealTimers(); });

    it('excludes systems whose time window has not opened yet', async () => {
        await seedActiveSystem(env.DB, { time_window_start: '06:00' });
        await seedActiveSystem(env.DB, { time_window_start: '23:59' });

        const app = getAuthedApp();
        const res = await app.fetch(new Request('http://localhost/api/dashboard'), env);
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.instances).toHaveLength(1);

        const total = await countInstances(env.DB);
        expect(total).toBe(2);
    });
});
