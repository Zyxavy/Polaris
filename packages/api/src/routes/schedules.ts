import { Hono } from "hono";
import { getOwnedSystem } from "../lib/ownership";
import type { User, Session } from "better-auth/types";

const app = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { user: User; session: Session };
}>();

const HH_MM_REGEX = /^\d{2}:\d{2}$/;

function isValidTime(str: string): boolean {
    if (!HH_MM_REGEX.test(str)) return false;
    const [h, m] = str.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// GET /api/systems/:system_id/schedules
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

    const { results } = await db.prepare(
        'SELECT * FROM schedules WHERE system_id = ? ORDER BY created_at DESC'
    ).bind(systemId).all<any>();

    return c.json({schedules: results, next_cursor: null });
});

// POST /api/systems/:system_id/schedules
app.post('/', async (c) => {
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

    if (body.days_of_week === undefined || typeof body.days_of_week !== 'number' || body.days_of_week < 0 || body.days_of_week > 127 || !Number.isInteger(body.days_of_week)) {
        return c.json({ error: 'invalid_input', message: 'days_of_week must be an integer between 0 and 127.' }, 400);
    }

    if (!body.time_window_start || !isValidTime(body.time_window_start)) {
        return c.json({ error: 'invalid_input', message: 'time_window_start must be in HH:MM format.' }, 400);
    }

    if (!body.time_window_end || !isValidTime(body.time_window_end)) {
        return c.json({ error: 'invalid_input', message: 'time_window_end must be in HH:MM format.' }, 400);
    }

    if (body.time_window_end <= body.time_window_start) {
        return c.json({ error: 'invalid_window', message: 'End time must be after start time.' }, 422);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.prepare(
        `INSERT INTO schedules (id, system_id, days_of_week, time_window_start, time_window_end, recurrence, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'weekly', ?, ?)`
    ).bind(id, systemId, body.days_of_week, body.time_window_start, body.time_window_end, now, now).run();

    const row = await db.prepare('SELECT * FROM schedules WHERE id = ?').bind(id).first<any>();
    return c.json(row, 201);
});

// PATCH /api/schedules/:id
app.patch('/:id', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const scheduleId = c.req.param('id');

    const existing = await db.prepare(
        `SELECT s.* FROM schedules s
        JOIN systems sys ON s.system_id = sys.id
        WHERE s.id = ? AND sys.user_id = ?`
    ).bind(scheduleId, userId).first<any>();

    if (!existing){
        return c.json({ error: 'not_found', message: 'Schedule not found.' }, 404);
    }

    const body = await c.req.json<any>();
    const now = new Date().toISOString();

    const sets: string[] = [];
    const params: any[] = [];

    const updatableFields = ['days_of_week', 'time_window_start', 'time_window_end'];

    for (const field of updatableFields) {
        if (body[field] !== undefined) {
            if (field === 'days_of_week') {
                if (typeof body[field] !== 'number' || body[field] < 0 || body[field] > 127 || !Number.isInteger(body[field])) {
                    return c.json({ error: 'invalid_input', message: 'days_of_week must be an integer between 0 and 127.' }, 400);
                }
            }
            if (field === 'time_window_start' || field === 'time_window_end') {
                if (!isValidTime(body[field])) {
                    return c.json({ error: 'invalid_input', message: `${field} must be in HH:MM format.` }, 400);
                }
            }
            sets.push(`${field} = ?`);
            params.push(body[field]);
        }
    }

    const newStart = body.time_window_start ?? existing.time_window_start;
    const newEnd = body.time_window_end ?? existing.time_window_end;

    if (newEnd <= newStart) {
        return c.json({ error: 'invalid_window', message: 'End time must be after start time.' }, 422);
    }

    if (sets.length === 0) {
        return c.json(existing);
    }

    sets.push('updated_at = ?');
    params.push(now);
    params.push(scheduleId);

    await db.prepare(
        `UPDATE schedules SET ${sets.join(', ')} WHERE id = ?`
    ).bind(...params).run();

    const updated = await db.prepare('SELECT * FROM schedules WHERE id = ?').bind(scheduleId).first<any>();
    return c.json(updated);
});

// DELETE /api/schedules/:id
app.delete('/:id', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const scheduleId = c.req.param('id');

    const existing = await db.prepare(`
        SELECT s.* FROM schedules s
        JOIN systems sys ON s.system_id = sys.id
        WHERE s.id = ? AND sys.user_id = ?
    `).bind(scheduleId, userId).first<any>();

    if (!existing) {
        return c.json({ error: 'not_found', message: 'Schedule not found.' }, 404);
    }

    await db.prepare('DELETE FROM schedules WHERE id = ?').bind(scheduleId).run();

    return c.json({ id: scheduleId, deleted: true });
});

export default app;
