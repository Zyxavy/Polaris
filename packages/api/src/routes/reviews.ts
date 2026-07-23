import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth';
import { getOwnedSystem } from '../lib/ownership';
import { encodeDateCursor, decodeDateCursor } from '../lib/cursor';
import { createReview, DuplicateReviewError } from '../services/reviews';
import type { User, Session } from 'better-auth/types';

// Router for /api/systems/:system_id/reviews

const reviewsRoutes = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { user: User; session: Session };
}>();

reviewsRoutes.use('/*', requireAuth);

reviewsRoutes.get('/', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const systemId = c.req.param('system_id');
    if (!systemId) return c.json({ error: 'not_found', message: 'System not found.' }, 404);

    const system = await getOwnedSystem(db, systemId, userId);
    if (!system) return c.json({ error: 'not_found', message: 'System not found.' }, 404);

    const cursor = c.req.query('cursor');
    const limitParam = c.req.query('limit');
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100);

    const conditions: string[] = ['system_id = ?'];
    const params: any[] = [systemId];

    if (cursor) {
        const decoded = decodeDateCursor(cursor);
        if (decoded) {
            conditions.push('(period_start < ? OR (period_start = ? AND id < ?))');
            params.push(decoded.date, decoded.date, decoded.id);
        }
    }

    const { results } = await db.prepare(
        `SELECT * FROM reviews WHERE ${conditions.join(' AND ')} ORDER BY period_start DESC, id DESC LIMIT ?`
    ).bind(...params, limit + 1).all<any>();

    const hasMore = results.length > limit;
    const rows = hasMore ? results.slice(0, limit) : results;

    let next_cursor: string | null = null;
    if (hasMore && rows.length > 0) {
        const last = rows[rows.length - 1];
        next_cursor = encodeDateCursor(last.period_start, last.id);
    }

    return c.json({ reviews: rows, next_cursor });
});

reviewsRoutes.post('/', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const systemId = c.req.param('system_id');
    if (!systemId) return c.json({ error: 'not_found', message: 'System not found.' }, 404);

    const system = await getOwnedSystem(db, systemId, userId);
    if (!system) return c.json({ error: 'not_found', message: 'System not found.' }, 404);

    const body = await c.req.json<any>();

    if (!body.period_start || !body.period_end) {
        return c.json({ error: 'invalid_input', message: 'period_start and period_end are required.' }, 400);
    }

    try {
        const result = await createReview(db, systemId, userId, {
            period_start: body.period_start,
            period_end: body.period_end,
            what_worked: body.what_worked ?? '',
            what_broke: body.what_broke ?? '',
            worst_day_check: body.worst_day_check ?? false,
            change_applied: body.change_applied ?? null,
            change_applied_note: body.change_applied_note ?? null,
        });

        return c.json(result, 201);
    } catch (e) {
        if (e instanceof DuplicateReviewError) {
            return c.json({ error: 'review_already_exists', message: e.message }, 409);
        }
        throw e;
    }
});

export default reviewsRoutes;


export const reviewDayRoutes = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { user: User; session: Session };
}>();

reviewDayRoutes.use('/*', requireAuth);

function lastCompletedWeek(): { period_start: string; period_end: string } {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); 
    // Days since last Sunday
    const daysSinceSunday = dayOfWeek;
    const lastSunday = new Date(now);
    lastSunday.setUTCDate(now.getUTCDate() - daysSinceSunday);
    // If today is Sunday, the "last completed week" ended yesterday (Saturday)
    if (dayOfWeek === 0) {
        lastSunday.setUTCDate(lastSunday.getUTCDate() - 7);
    }
    // period_end = last Sunday
    const periodEnd = new Date(lastSunday);
    // period_start = previous Monday (6 days before Sunday)
    const periodStart = new Date(periodEnd);
    periodStart.setUTCDate(periodEnd.getUTCDate() - 6);

    const fmt = (d: Date) => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    return { period_start: fmt(periodStart), period_end: fmt(periodEnd) };
}

reviewDayRoutes.get('/review-day', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;

    const { period_start, period_end } = lastCompletedWeek();

    const { results } = await db.prepare(`
        SELECT
            s.id,
            s.name,
            s.floor_action,
            COALESCE(inst.full_count, 0) as full_count,
            COALESCE(inst.floor_count, 0) as floor_count,
            COALESCE(inst.missed_count, 0) as missed_count,
            (SELECT r.id FROM reviews r WHERE r.system_id = s.id ORDER BY r.created_at DESC LIMIT 1) as last_review_id
        FROM systems s
        LEFT JOIN (
            SELECT system_id,
                   SUM(CASE WHEN state = 'full' THEN 1 ELSE 0 END) as full_count,
                   SUM(CASE WHEN state = 'floor' THEN 1 ELSE 0 END) as floor_count,
                   SUM(CASE WHEN state = 'missed' THEN 1 ELSE 0 END) as missed_count
            FROM instances
            WHERE date >= ? AND date <= ?
            GROUP BY system_id
        ) inst ON inst.system_id = s.id
        WHERE s.user_id = ?
          AND s.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM reviews r
            WHERE r.system_id = s.id
              AND r.period_start = ? AND r.period_end = ?
          )
        ORDER BY s.name ASC
    `).bind(
        period_start, period_end,  // single instance pass
        userId,
        period_start, period_end   // reviews check
    ).all<any>();

    const due = results.map((row: any) => ({
        system: { id: row.id, name: row.name, floor_action: row.floor_action },
        period_start,
        period_end,
        instance_summary: {
            full: row.full_count,
            floor: row.floor_count,
            missed: row.missed_count,
        },
        last_review_id: row.last_review_id,
    }));

    return c.json({ due });
});