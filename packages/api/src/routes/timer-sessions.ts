import { Hono } from "hono";
import { requireAuth } from "../middleware/require-auth";
import { getOwnedInstance } from "../lib/ownership";
import type { User, Session } from "better-auth/types";

const app = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { user: User; session: Session };
}>();

app.use('/*', requireAuth);

app.post('/instances/:instance_id/timer-sessions', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const instanceId = c.req.param('instance_id');

    const instance = await getOwnedInstance(db, instanceId, userId);
    if (!instance) {
        return c.json({ error: 'not_found', message: 'Instance not found.' }, 404);
    }

    const body = await c.req.json<any>();
    if (!body.widget_id || typeof body.widget_id !== 'string') {
        return c.json({ error: 'invalid_input', message: 'widget_id is required.' }, 400);
    }
    if (typeof body.duration_secs !== 'number' || !Number.isInteger(body.duration_secs) || body.duration_secs <= 0) {
        return c.json({ error: 'invalid_input', message: 'duration_secs must be a positive integer.' }, 400);
    }
    if (!body.started_at || typeof body.started_at !== 'string') {
        return c.json({ error: 'invalid_input', message: 'started_at is required.' }, 400);
    }
    if (!body.ended_at || typeof body.ended_at !== 'string') {
        return c.json({ error: 'invalid_input', message: 'ended_at is required.' }, 400);
    }

    const ws = await db.prepare(
        'SELECT id FROM workspaces WHERE system_id = (SELECT system_id FROM instances WHERE id = ?)'
    ).bind(instanceId).first<{ id: string }>();

    if (!ws) {
        return c.json({ error: 'not_found', message: 'Workspace not found.' }, 404);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.prepare(`
        INSERT INTO timer_sessions (id, workspace_id, widget_id, instance_id, duration_secs, started_at, ended_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, ws.id, body.widget_id, instanceId, body.duration_secs, body.started_at, body.ended_at, now).run();

    const row = await db.prepare('SELECT * FROM timer_sessions WHERE id = ?').bind(id).first<any>();
    return c.json(row, 201);

});

app.get('/widgets/:widget_id/timer-sessions', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const widgetId = c.req.param('widget_id');
    const from = c.req.query('from');
    const to = c.req.query('to');

    const conditions: string[] = [
        'ts.widget_id = ?',
        's.user_id = ?',
    ];
    const params: any[] = [widgetId, userId];

    if (from) { conditions.push('ts.created_at >= ?'); params.push(from); }
    if (to) { conditions.push('ts.created_at <= ?'); params.push(to); }

    const { results } = await db.prepare(`
        SELECT ts.* FROM timer_sessions ts
        JOIN workspaces w ON ts.workspace_id = w.id
        JOIN systems s ON w.system_id = s.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY ts.created_at DESC
    `).bind(...params).all<any>();

    return c.json({ timer_sessions: results });
});

app.delete('/timer-sessions/:id', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const sessionId = c.req.param('id');

    const existing = await db.prepare(`
        SELECT ts.* FROM timer_sessions ts
        JOIN workspaces w ON ts.workspace_id = w.id
        JOIN systems s ON w.system_id = s.id
        WHERE ts.id = ? AND s.user_id = ?
    `).bind(sessionId, userId).first<any>();

    if (!existing) {
        return c.json({ error: 'not_found', message: 'Timer session not found.' }, 404);
    }

    await db.prepare('DELETE FROM timer_sessions WHERE id = ?').bind(sessionId).run();
    return c.json({ id: sessionId, deleted: true });
});

export default app;