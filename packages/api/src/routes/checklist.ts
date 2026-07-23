import { Hono } from "hono";
import { requireAuth } from "../middleware/require-auth";
import { getOwnedInstance } from "../lib/ownership";
import type { User, Session } from "better-auth/types";

const ENTRY_TYPE = 'checklist_state';

const app = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { user: User; session: Session };
}>();

app.use('/*', requireAuth);

app.put('/instances/:instance_id/checklist/:widget_id', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const instanceId = c.req.param('instance_id');
    const widgetId = c.req.param('widget_id')

    const instance = await getOwnedInstance(db, instanceId, userId);
    if (!instance) {
        return c.json({ error: 'not_found', message: 'Instance not found.' }, 404);
    }

    const body = await c.req.json<any>();
    if (!Array.isArray(body.steps)) {
        return c.json({ error: 'invalid_input', message: 'steps must be an array.' }, 400);
    }

    for (let i = 0; i < body.steps.length; i++) {
        const step = body.steps[i];
        if (typeof step.label !== 'string' || typeof step.checked !== 'boolean') {
            return c.json({ error: 'invalid_input', message: `steps[${i}] must have label (string) and checked (boolean).` }, 400);
        }
    }

    const ws = await db.prepare(
        'SELECT id FROM workspaces WHERE system_id = (SELECT system_id FROM instances WHERE id = ?)'
    ).bind(instanceId).first<{ id: string }>();

    if (!ws) {
        return c.json({ error: 'not_found', message: 'Workspace not found.' }, 404);
    }

    const existing = await db.prepare(
        `SELECT id FROM widget_entries
        WHERE instance_id = ? AND widget_id = ? AND entry_type = ?`
    ).bind(instanceId, widgetId, ENTRY_TYPE).first<{ id: string }>();

    const now = new Date().toISOString();
    const data = JSON.stringify({ steps: body.steps });

    if (existing) {
        await db.prepare(
            `UPDATE widget_entries SET data = ?, created_at = ? WHERE id = ?`
        ).bind(data, now, existing.id).run();

        const row = await db.prepare('SELECT * FROM widget_entries WHERE id = ?').bind(existing.id).first<any>();
        return c.json({ ...row, data: JSON.parse(row.data) });
    } else {
        const id = crypto.randomUUID();
        await db.prepare(
            `INSERT INTO widget_entries (id, workspace_id, widget_id, instance_id, entry_type, data, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, ws.id, widgetId, instanceId, ENTRY_TYPE, data, now).run();

        const row = await db.prepare('SELECT * FROM widget_entries WHERE id = ?').bind(id).first<any>();
        return c.json({ ...row, data: JSON.parse(row.data) }, 201);
    }

});

app.get('/instances/:instance_id/checklist/:widget_id', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const instanceId = c.req.param('instance_id');
    const widgetId = c.req.param('widget_id');

    const instance = await getOwnedInstance(db, instanceId, userId);
    if (!instance) {
        return c.json({ error: 'not_found', message: 'Instance not found.' }, 404);
    }

    const row = await db.prepare(`
        SELECT * FROM widget_entries
        WHERE instance_id = ? AND widget_id = ? AND entry_type = ?
    `).bind(instanceId, widgetId, ENTRY_TYPE).first<any>();

    if (!row) {
        return c.json({ steps: [] });
    }

    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return c.json({ steps: data.steps });
});

export default app;