import { Hono } from "hono";
import { requireAuth } from "../middleware/require-auth";
import { getOwnedSystem } from "../lib/ownership";
import { upgradeLayout } from "../lib/workspace";
import type { User, Session } from "better-auth/types";

function deduplicateWidgets(widgets: any[]): any[] {
    const seen = new Set<string>();
    return widgets.filter(w => {
        if (!w || !w.id) return false;
        if (seen.has(w.id)) return false;
        seen.add(w.id);
        return true;
    });
}

const app = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { user: User; session: Session };
}>();

app.use('/*', requireAuth);

app.get('/', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const systemId = c.req.param('system_id');
    if (!systemId) {
        return c.json({ error: 'not_found', message: 'System not found.' }, 404);
    }

    const system = await getOwnedSystem(db, systemId, userId);
    if (!system) {
        return c.json({ error: 'not_found', message: 'System not found.' }, 404);
    }

    const row = await db.prepare(
        'SELECT * FROM workspaces WHERE system_id = ?'
    ).bind(systemId).first<any>();

    if (!row) {
        return c.json({ error: 'not_found', message: 'No workspace yet.' }, 404);
    }

    return c.json({
        ...row,
        layout: upgradeLayout(typeof row.layout === 'string' ? JSON.parse(row.layout) : row.layout),
    });
});

app.put('/', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const systemId = c.req.param('system_id');
    if (!systemId) {
        return c.json({ error: 'not_found', message: 'System not found.' }, 404);
    }

    const system = await getOwnedSystem(db, systemId, userId);
    if (!system) {
        return c.json({ error: 'not_found', message: 'System not found.' }, 404);
    }

    const body = await c.req.json<any>();
    if(!body.layout || typeof body.layout !== 'object') {
        return c.json({ error: 'invalid_input', message: 'layout is required.' }, 400);
    }

    const layout = upgradeLayout(body.layout);
    layout.widgets = deduplicateWidgets(layout.widgets);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await db.prepare(
        `INSERT INTO workspaces (id, system_id, layout, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(system_id) DO UPDATE SET
            layout = excluded.layout,
            updated_at = excluded.updated_at`
        ).bind(id, systemId, JSON.stringify(layout), now, now).run();

    const row = await db.prepare(
        'SELECT * FROM workspaces WHERE system_id = ?'
    ).bind(systemId).first<any>();

    return c.json({
        ...row,
        layout: typeof row.layout === 'string' ? JSON.parse(row.layout) : row.layout,
    });
});

export default app;