import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { describe, it, expect, vi, beforeEach, inject } from 'vitest';
import { Hono } from 'hono';
import { upgradeLayout } from '../lib/workspace';
import workspaceRoutes from '../routes/workspace';
import counterLogRoutes from '../routes/counter-logs';
import timerSessionRoutes from '../routes/timer-sessions';
import checklistRoutes from '../routes/checklist';

const migrations = inject('migrations');

async function seedUser(db: D1Database, userId: string) {
    const now = new Date().toISOString();
    await db.prepare(
        `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
         VALUES (?, ?, ?, 1, ?, ?)`
    ).bind(userId, 'Test User', `${userId}@test.com`, now, now).run();
}

function getAuthedApp(userId: string) {
    const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: any; session: any } }>();
    app.use('/api/*', async (c, next) => {
        c.set('user', { id: userId, email: 'test@test.com' });
        c.set('session', { id: crypto.randomUUID(), userId });
        await next();
    });
    app.route('/api/systems/:system_id/workspace', workspaceRoutes);
    app.route('/api', counterLogRoutes);
    app.route('/api', timerSessionRoutes);
    app.route('/api', checklistRoutes);
    return app;
}

async function seedSystem(db: D1Database, userId: string): Promise<string> {
    const systemId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare(
        `INSERT INTO systems (id, user_id, name, domain, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(systemId, userId, 'WS Test', 'health', 'active', now, now).run();
    return systemId;
}

async function seedSchedule(db: D1Database, systemId: string): Promise<string> {
    const scheduleId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare(
        `INSERT INTO schedules (id, system_id, days_of_week, time_window_start, time_window_end, recurrence, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(scheduleId, systemId, 127, '00:00', '23:59', 'weekly', now, now).run();
    return scheduleId;
}

async function seedInstance(db: D1Database, systemId: string, date: string): Promise<string> {
    const instanceId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare(
        `INSERT INTO instances (id, system_id, date, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(instanceId, systemId, date, 'pending', now, now).run();
    return instanceId;
}

async function seedWorkspace(db: D1Database, systemId: string, layout: any): Promise<void> {
    const now = new Date().toISOString();
    await db.prepare(
        `INSERT INTO workspaces (id, system_id, layout, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), systemId, JSON.stringify(layout), now, now).run();
}

// Unit: upgradeLayout()

describe('upgradeLayout', () => {
    it('returns v:1 empty layout for null input', () => {
        const result = upgradeLayout(null);
        expect(result.v).toBe(1);
        expect(result.widgets).toEqual([]);
    });

    it('returns v:1 empty layout for undefined input', () => {
        const result = upgradeLayout(undefined);
        expect(result.v).toBe(1);
        expect(result.widgets).toEqual([]);
    });

    it('returns v:1 empty layout for non-object input', () => {
        const result = upgradeLayout('bad');
        expect(result.v).toBe(1);
        expect(result.widgets).toEqual([]);
    });

    it('preserves widgets array for v:1 input', () => {
        const widgets = [
            { id: 'w1', type: 'timer', x: 0, y: 0, w: 1, h: 1, config: {} },
        ];
        const result = upgradeLayout({ v: 1, widgets });
        expect(result.v).toBe(1);
        expect(result.widgets).toEqual(widgets);
    });

    it('defaults missing widgets to empty array', () => {
        const result = upgradeLayout({ v: 1 });
        expect(result.widgets).toEqual([]);
    });

    it('bumps v:0 to CURRENT_LAYOUT_VERSION', () => {
        const result = upgradeLayout({ v: 0, widgets: [] });
        expect(result.v).toBe(1);
    });

    it('round-trips JSON serialize then parse then upgradeLayout', () => {
        const original = { v: 1, widgets: [{ id: 'w1', type: 'counter', x: 0, y: 0, w: 1, h: 1, config: {} }] };
        const json = JSON.stringify(original);
        const parsed = JSON.parse(json);
        const result = upgradeLayout(parsed);
        expect(result).toEqual(original);
    });
});

// Integration: Workspace routes

describe('workspace routes', () => {
    let userId: string;
    let systemId: string;
    let app: ReturnType<typeof getAuthedApp>;

    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
        userId = crypto.randomUUID();
        await seedUser(env.DB, userId);
        systemId = await seedSystem(env.DB, userId);
        app = getAuthedApp(userId);
    });

    it('GET returns 404 when no workspace saved yet', async () => {
        const res = await app.fetch(new Request(`http://localhost/api/systems/${systemId}/workspace`), env);
        expect(res.status).toBe(404);
    });

    it('PUT creates workspace, GET returns same layout', async () => {
        const layout = { v: 1, widgets: [{ id: 'w1', type: 'timer', x: 0, y: 0, w: 1, h: 1, config: {} }] };

        const putRes = await app.fetch(new Request(`http://localhost/api/systems/${systemId}/workspace`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout }),
        }), env);
        expect(putRes.status).toBe(200);
        const putBody = await putRes.json() as any;
        expect(putBody.layout.v).toBe(1);
        expect(putBody.layout.widgets).toHaveLength(1);
        expect(putBody.layout.widgets[0].type).toBe('timer');

        const getRes = await app.fetch(new Request(`http://localhost/api/systems/${systemId}/workspace`), env);
        expect(getRes.status).toBe(200);
        const getBody = await getRes.json() as any;
        expect(getBody.layout).toEqual(putBody.layout);
    });

    it('PUT upserts: second PUT updates existing workspace', async () => {
        const firstLayout = { v: 1, widgets: [] };
        await app.fetch(new Request(`http://localhost/api/systems/${systemId}/workspace`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout: firstLayout }),
        }), env);

        const secondLayout = { v: 1, widgets: [{ id: 'w2', type: 'counter', x: 0, y: 0, w: 1, h: 1, config: {} }] };
        const putRes = await app.fetch(new Request(`http://localhost/api/systems/${systemId}/workspace`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout: secondLayout }),
        }), env);
        expect(putRes.status).toBe(200);
        const putBody = await putRes.json() as any;
        expect(putBody.layout.widgets).toHaveLength(1);

        const getRes = await app.fetch(new Request(`http://localhost/api/systems/${systemId}/workspace`), env);
        const getBody = await getRes.json() as any;
        expect(getBody.layout.widgets[0].type).toBe('counter');
    });

    it('PUT rejects missing layout body', async () => {
        const res = await app.fetch(new Request(`http://localhost/api/systems/${systemId}/workspace`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        }), env);
        expect(res.status).toBe(400);
    });

    it('rejects request for non-existent system', async () => {
        const res = await app.fetch(new Request('http://localhost/api/systems/non-existent/workspace'), env);
        expect(res.status).toBe(404);
    });
});

// Integration: Counter-log routes

describe('counter-log routes', () => {
    let userId: string;
    let systemId: string;
    let instanceId: string;
    let app: ReturnType<typeof getAuthedApp>;

    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
        userId = crypto.randomUUID();
        await seedUser(env.DB, userId);
        systemId = await seedSystem(env.DB, userId);
        instanceId = await seedInstance(env.DB, systemId, '2026-07-18');
        // Seed a workspace (counter-logs require one)
        await seedWorkspace(env.DB, systemId, { v: 1, widgets: [{ id: 'counter-widget', type: 'counter', x: 0, y: 0, w: 1, h: 1, config: {} }] });
        app = getAuthedApp(userId);
    });

    it('POST creates a counter log, GET returns it', async () => {
        const postRes = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/counter-logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widget_id: 'counter-widget', value: 5 }),
        }), env);
        expect(postRes.status).toBe(201);
        const postBody = await postRes.json() as any;
        expect(postBody.value).toBe(5);

        const getRes = await app.fetch(new Request('http://localhost/api/widgets/counter-widget/counter-logs'), env);
        expect(getRes.status).toBe(200);
        const getBody = await getRes.json() as any;
        expect(getBody.counter_logs).toHaveLength(1);
        expect(getBody.counter_logs[0].value).toBe(5);
    });

    it('multiple POSTs → GET returns all logs', async () => {
        await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/counter-logs`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widget_id: 'counter-widget', value: 3 }),
        }), env);
        await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/counter-logs`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widget_id: 'counter-widget', value: 7 }),
        }), env);

        const getRes = await app.fetch(new Request('http://localhost/api/widgets/counter-widget/counter-logs'), env);
        const getBody = await getRes.json() as any;
        expect(getBody.counter_logs).toHaveLength(2);
        const sum = getBody.counter_logs.reduce((s: number, l: any) => s + l.value, 0);
        expect(sum).toBe(10);
    });

    it('GET with from/to filter returns only matching logs', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'));

        await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/counter-logs`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widget_id: 'counter-widget', value: 1 }),
        }), env);

        vi.useRealTimers();

        const getRes = await app.fetch(new Request('http://localhost/api/widgets/counter-widget/counter-logs?from=2026-07-18&to=2026-07-18'), env);
        expect(getRes.status).toBe(200);
        const getBody = await getRes.json() as any;
        expect(getBody.counter_logs).toHaveLength(1);
    });

    it('DELETE removes a counter log', async () => {
        const postRes = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/counter-logs`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widget_id: 'counter-widget', value: 9 }),
        }), env);
        const postBody = await postRes.json() as any;
        const logId = postBody.id;

        const delRes = await app.fetch(new Request(`http://localhost/api/counter-logs/${logId}`, {
            method: 'DELETE',
        }), env);
        expect(delRes.status).toBe(200);

        const getRes = await app.fetch(new Request('http://localhost/api/widgets/counter-widget/counter-logs'), env);
        const getBody = await getRes.json() as any;
        expect(getBody.counter_logs).toHaveLength(0);
    });

    it('rejects POST with missing widget_id', async () => {
        const res = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/counter-logs`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: 1 }),
        }), env);
        expect(res.status).toBe(400);
    });
});

// Integration: Timer-session routes

describe('timer-session routes', () => {
    let userId: string;
    let systemId: string;
    let instanceId: string;
    let app: ReturnType<typeof getAuthedApp>;

    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
        userId = crypto.randomUUID();
        await seedUser(env.DB, userId);
        systemId = await seedSystem(env.DB, userId);
        instanceId = await seedInstance(env.DB, systemId, '2026-07-18');
        await seedWorkspace(env.DB, systemId, { v: 1, widgets: [{ id: 'timer-widget', type: 'timer', x: 0, y: 0, w: 1, h: 1, config: {} }] });
        app = getAuthedApp(userId);
    });

    it('POST creates a timer session, GET returns it', async () => {
        const postRes = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/timer-sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                widget_id: 'timer-widget',
                duration_secs: 150,
                started_at: '2026-07-18T10:00:00Z',
                ended_at: '2026-07-18T10:02:30Z',
            }),
        }), env);
        expect(postRes.status).toBe(201);
        const postBody = await postRes.json() as any;
        expect(postBody.duration_secs).toBe(150);

        const getRes = await app.fetch(new Request('http://localhost/api/widgets/timer-widget/timer-sessions'), env);
        expect(getRes.status).toBe(200);
        const getBody = await getRes.json() as any;
        expect(getBody.timer_sessions).toHaveLength(1);
        expect(getBody.timer_sessions[0].duration_secs).toBe(150);
    });

    it('DELETE removes a timer session', async () => {
        const postRes = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/timer-sessions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                widget_id: 'timer-widget', duration_secs: 60,
                started_at: '2026-07-18T10:00:00Z', ended_at: '2026-07-18T10:01:00Z',
            }),
        }), env);
        const postBody = await postRes.json() as any;

        const delRes = await app.fetch(new Request(`http://localhost/api/timer-sessions/${postBody.id}`, {
            method: 'DELETE',
        }), env);
        expect(delRes.status).toBe(200);

        const getRes = await app.fetch(new Request('http://localhost/api/widgets/timer-widget/timer-sessions'), env);
        const getBody = await getRes.json() as any;
        expect(getBody.timer_sessions).toHaveLength(0);
    });
});

// Integration: Checklist routes

describe('checklist routes', () => {
    let userId: string;
    let systemId: string;
    let instanceId: string;
    let app: ReturnType<typeof getAuthedApp>;

    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
        userId = crypto.randomUUID();
        await seedUser(env.DB, userId);
        systemId = await seedSystem(env.DB, userId);
        instanceId = await seedInstance(env.DB, systemId, '2026-07-18');
        await seedWorkspace(env.DB, systemId, { v: 1, widgets: [{ id: 'checklist-widget', type: 'checklist', x: 0, y: 0, w: 2, h: 1, config: {} }] });
        app = getAuthedApp(userId);
    });

    it('GET returns 404 when checklist not yet saved', async () => {
        const res = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/checklist/checklist-widget`), env);
        expect(res.status).toBe(404);
    });

    it('PUT creates checklist, GET returns it', async () => {
        const steps = [
            { label: 'Step A', checked: false },
            { label: 'Step B', checked: true },
        ];

        const putRes = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/checklist/checklist-widget`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps }),
        }), env);
        expect(putRes.status).toBe(201);
        const putBody = await putRes.json() as any;
        expect(putBody.data.steps).toEqual(steps);

        const getRes = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/checklist/checklist-widget`), env);
        expect(getRes.status).toBe(200);
        const getBody = await getRes.json() as any;
        expect(getBody.data.steps).toEqual(steps);
    });

    it('PUT replaces checklist for same instance+widget (not append)', async () => {
        const firstSteps = [
            { label: 'Old', checked: false },
        ];

        await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/checklist/checklist-widget`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps: firstSteps }),
        }), env);

        const secondSteps = [
            { label: 'New Step', checked: true },
        ];

        const putRes = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/checklist/checklist-widget`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps: secondSteps }),
        }), env);
        expect(putRes.status).toBe(200);
        const putBody = await putRes.json() as any;
        expect(putBody.data.steps).toEqual(secondSteps);

        const getRes = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/checklist/checklist-widget`), env);
        const getBody = await getRes.json() as any;
        expect(getBody.data.steps).toHaveLength(1);
        expect(getBody.data.steps[0].label).toBe('New Step');
    });

    it('rejects PUT with non-array steps', async () => {
        const res = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/checklist/checklist-widget`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps: 'bad' }),
        }), env);
        expect(res.status).toBe(400);
    });

    it('rejects PUT with invalid step shape', async () => {
        const res = await app.fetch(new Request(`http://localhost/api/instances/${instanceId}/checklist/checklist-widget`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps: [{ label: 'only label' }] }),
        }), env);
        expect(res.status).toBe(400);
    });
});
