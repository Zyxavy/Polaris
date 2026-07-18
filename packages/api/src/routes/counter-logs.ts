import { Hono } from "hono";
import { requireAuth } from "../middleware/require-auth";
import { getOwnedInstance } from "../lib/ownership";
import type { User, Session } from "better-auth/types";

const app = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { user: User; session: Session };
}>();

app.use('/*', requireAuth);

app.post('/instances/:instance_id/counter-logs', async (c) => {
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
    if (typeof body.value !== 'number' || !Number.isInteger(body.value)) {
        return c.json({ error: 'invalid_input', message: 'value must be an integer.' }, 400);
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
        INSERT INTO counter_logs (id, workspace_id, widget_id, instance_id, value, unit_label, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, ws.id, body.widget_id, instanceId, body.value, body.unit_label ?? null, now).run();

    const row = await db.prepare('SELECT * FROM counter_logs WHERE id = ?').bind(id).first<any>();
    return c.json(row, 201);

});

app.get('/widgets/:widget_id/counter-logs', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const widgetId = c.req.param('widget_id');
    const from = c.req.query('from');
    const to = c.req.query('to');

    const conditions: string[] = [
        'cl.widget_id = ?',
        's.user_id = ?',
    ];
    const params: any[] = [widgetId, userId];

    if (from) { conditions.push('cl.created_at >= ?'); params.push(from); }
    if (to) { conditions.push('cl.created_at <= ?'); params.push(to); }

    const { results } = await db.prepare(`
        SELECT cl.* FROM counter_logs cl
        JOIN workspaces w ON cl.workspace_id = w.id
        JOIN systems s ON w.system_id = s.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY cl.created_at DESC
    `).bind(...params).all<any>();

    return c.json({ counter_logs: results });
});

app.delete('/counter-logs/:id', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const logId = c.req.param('id');

    const existing = await db.prepare(`
        SELECT cl.* FROM counter_logs cl
        JOIN workspaces w ON cl.workspace_id = w.id
        JOIN systems s ON w.system_id = s.id
        WHERE cl.id = ? AND s.user_id = ?
    `).bind(logId, userId).first<any>();

    if (!existing) {
        return c.json({ error: 'not_found', message: 'Counter log not found.' }, 404);
    }

    await db.prepare('DELETE FROM counter_logs WHERE id = ?').bind(logId).run();
    return c.json({ id: logId, deleted: true });
});

export default app;