import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth';
import { getOwnedInstance, getOwnedSystem } from '../lib/ownership';
import { encodeDateCursor, decodeDateCursor } from '../lib/cursor';
import type { User, Session } from 'better-auth/types';

// --- Instance CRUD (GET/PATCH /api/instances/:id) ---

const instanceRoutes = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { user: User; session: Session };
}>();

instanceRoutes.use('/*', requireAuth);

instanceRoutes.get('/:id', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const instance = await getOwnedInstance(db, c.req.param('id'), userId);
    if (!instance) return c.json({ error: 'not_found', message: 'Instance not found.' }, 404);
    return c.json(instance);
});

instanceRoutes.patch('/:id', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const instanceId = c.req.param('id');

    const existing = await getOwnedInstance(db, instanceId, userId);
    if (!existing) return c.json({ error: 'not_found', message: 'Instance not found.' }, 404);

    const body = await c.req.json<any>();

    if (Object.keys(body).length === 0) {
        return c.json({ error: 'invalid_input', message: 'At least one field must be provided.' }, 400);
    }

    if (body.state !== undefined && body.state === 'pending') {
        return c.json({ error: 'invalid_transition', message: "Cannot set state to 'pending' directly." }, 422);
    }

    if (body.state !== undefined && !['full', 'floor', 'missed'].includes(body.state)) {
        return c.json({ error: 'invalid_input', message: "State must be one of: full, floor, missed." }, 400);
    }

    const sets: string[] = [];
    const params: any[] = [];
    const now = new Date().toISOString();

    if (body.state !== undefined) {
        sets.push('state = ?');
        params.push(body.state);
    }
    if (body.notes !== undefined) {
        sets.push('notes = ?');
        params.push(body.notes);
    }

    sets.push('updated_at = ?');
    params.push(now);
    params.push(instanceId);

    await db.prepare(
        `UPDATE instances SET ${sets.join(', ')} WHERE id = ?`
    ).bind(...params).run();

    const updated = await getOwnedInstance(db, instanceId, userId);
    return c.json(updated);
});

// --- System Instances list (GET /api/systems/:system_id/instances) ---

const systemInstanceRoutes = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { user: User; session: Session };
}>();

systemInstanceRoutes.use('/*', requireAuth);

systemInstanceRoutes.get('/:system_id/instances', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const systemId = c.req.param('system_id');

    const system = await getOwnedSystem(db, systemId, userId);
    if (!system) return c.json({ error: 'not_found', message: 'System not found.' }, 404);

    const from = c.req.query('from');
    const to = c.req.query('to');
    const cursor = c.req.query('cursor');
    const limitParam = c.req.query('limit');

    const limit = Math.min(Math.max(parseInt(limitParam || String(50), 10) || 50, 1), 100);

    const conditions: string[] = ['system_id = ?'];
    const params: any[] = [systemId];

    if (from) { conditions.push('date >= ?'); params.push(from); }
    if (to) { conditions.push('date <= ?'); params.push(to); }

    if (cursor) {
        const decoded = decodeDateCursor(cursor);
        if (decoded) {
            conditions.push('(date > ? OR (date = ? AND id > ?))');
            params.push(decoded.date, decoded.date, decoded.id);
        }
    }

    const { results } = await db.prepare(
        `SELECT * FROM instances WHERE ${conditions.join(' AND ')} ORDER BY date DESC, id DESC LIMIT ?`
    ).bind(...params, limit + 1).all<any>();

    const hasMore = results.length > limit;
    const rows = hasMore ? results.slice(0, limit) : results;

    let next_cursor: string | null = null;
    if (hasMore && rows.length > 0) {
        const last = rows[rows.length - 1];
        next_cursor = encodeDateCursor(last.date, last.id);
    }

    return c.json({ instances: rows, next_cursor });
});

export { instanceRoutes, systemInstanceRoutes };
