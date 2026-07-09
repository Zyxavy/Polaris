import { Hono } from "hono";
import { requireAuth } from "../middleware/require-auth";
import { getOwnedSystem } from "../lib/ownership";
import { User, Session } from "better-auth/types";

const app = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { user: User; session: Session };
}>();

app.use('/*', requireAuth);

function parseSystemRow(row: any) {
    return {
        ...row,
        barrier_list: typeof row.barrier_list === 'string' ? JSON.parse(row.barrier_list) : row.barrier_list,
    };
}

function encodeCursor(name: string, id: string): string {
    return btoa(JSON.stringify({ n: name, i: id}));
}

function decodeCursor(cursor: string): { name: string; id: string } | null {
    try {
        return JSON.parse(atob(cursor));
    } catch {
        return null;
    }
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

app.get('/', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;

    const status = c.req.query('status');
    const limitParam = c.req.query('limit');
    const cursorParam = c.req.query('cursor');

    const limit = Math.min(Math.max(parseInt(limitParam || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

    const conditions: string[] = ['user_id = ?'];
    const params: any[] = [userId];

    if (status && ['active', 'paused', 'archived'].includes(status)) {
        conditions.push('status = ?');
        params.push(status);
    }

    if (cursorParam) {
        const cursor = decodeCursor(cursorParam);
        if (cursor) {
            conditions.push('(name > ? OR (name = ? AND id > ?))');
            params.push(cursor.name, cursor.name, cursor.id);
        }
    }

    const { results } = await db.prepare(
        `SELECT * FROM systems WHERE ${conditions.join(' AND ')} ORDER BY name ASC, id ASC LIMIT ?`
    ).bind(...params, limit + 1).all<any>();

    const hasMore = results.length > limit;
    const rows = hasMore ? results.slice(0, limit) : results;

    const systems = rows.map(parseSystemRow);

    let next_cursor: string | null = null;
    if (hasMore && rows.length > 0) {
        const last = rows[rows.length - 1];
        next_cursor = encodeCursor(last.name, last.id);
    }

    return c.json({ systems, next_cursor });
})


app.post('/', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const body = await c.req.json<any>();

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
        return c.json({ error: 'invalid_input', message: 'name is required'}, 400);
    }
    
    const id = crypto.randomUUID();
    const now  = new Date().toISOString();;

    await db.prepare(`
        INSERT INTO systems (id, user_id, name, domain, purpose, philosophy, protocol, floor_action, trigger, barrier_list, environment_cue, template_origin, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(
        id,
        userId,
        body.name.trim(),
        body.domain ?? null,
        body.purpose ?? '',
        body.philosophy ?? '',
        body.protocol ?? '',
        body.floor_action ?? '',
        body.trigger ?? '',
        body.barrier_list ? JSON.stringify(body.barrier_list) : '[]',
        body.environment_cue ?? '',
        body.template_origin ?? null,
        now,
        now,
    ).run();

    const row = await db.prepare('SELECT * FROM systems WHERE id = ?').bind(id).first<any>();
    return c.json(parseSystemRow(row), 201);
});

app.get('/:id', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const system = await getOwnedSystem(db, c.req.param('id'), userId);

    if(!system) {
        return c.json({ error: 'not_found', message: 'System not found.'}, 404);
    }

    return c.json(system);
});

app.patch('/:id', async(c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const systemId = c.req.param('id');

    const existing = await db.prepare(
        'SELECT * FROM systems WHERE id = ? AND user_id = ?'
    ).bind(systemId, userId).first<any>();

    if (!existing) {
        return c.json({ error: 'not_found', message: 'System not found'}, 404);
    }

    const body = await c.req.json<any>();
    const now  = new Date().toISOString();

    const sets: string[] = [];
    const params: any[] = [];

    const updatableFields = ['name', 'domain', 'purpose', 'philosophy', 'protocol', 'floor_action', 'trigger', 'environment_cue', 'template_origin', 'status'];

    for (const field of updatableFields) {
        if (body[field] !== undefined) {
        sets.push(`${field} = ?`);
        params.push(field === 'name' ? String(body[field]).trim() : body[field]);
        }
    }

    if (body.barrier_list !== undefined) {
        sets.push('barrier_list = ?');
        params.push(JSON.stringify(body.barrier_list));
    }

    if (sets.length === 0) {
        return c.json(parseSystemRow(existing));
    } 

    sets.push('updated_at = ?');
    params.push(now);
    params.push(systemId, userId);

    await db.prepare(
        `UPDATE systems SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`
    ).bind(...params).run();

    const updated = await db.prepare(
    'SELECT * FROM systems WHERE id = ? AND user_id = ?'
    ).bind(systemId, userId).first<any>();

    return c.json(parseSystemRow(updated));

});


app.post('/:id/confirm', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const system = await getOwnedSystem(db, c.req.param('id'), userId);

    if (!system) {
        return c.json({ error: 'not_found', message: 'System not found.' }, 404);
    }

    if (!system.floor_action || system.floor_action.trim().length === 0) {
        return c.json({
        error: 'floor_action_required',
        message: 'Every system needs a floor action: the smallest version that still counts as a win.',
        }, 422);
    }

    return c.json(system);
});

app.post('/:id/archive', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const systemId = c.req.param('id');

    const existing = await db.prepare(
        'SELECT * FROM systems WHERE id = ? AND user_id = ?'
    ).bind(systemId, userId).first<any>();

    if (!existing) {
        return c.json({ error: 'not_found', message: 'System not found.' }, 404);
    }

    if (existing.status === 'archived') {
        return c.json({ error: 'already_archived', message: 'This system is already archived.' }, 409);
    }

    const now = new Date().toISOString();
    await db.prepare(
        "UPDATE systems SET status = 'archived', updated_at = ? WHERE id = ? AND user_id = ?"
    ).bind(now, systemId, userId).run();

    const updated = await db.prepare(
        'SELECT * FROM systems WHERE id = ? AND user_id = ?'
    ).bind(systemId, userId).first<any>();

    return c.json(parseSystemRow(updated));
});

export default app;