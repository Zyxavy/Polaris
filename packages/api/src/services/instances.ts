import { toManilaDate } from "../lib/calendar";

export async function generateInstancesForAllUsers(db: D1Database, dateStr: string): Promise<void> {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const jsDay = dateObj.getUTCDay();
    const paragonDay = (jsDay + 6) % 7;
    const dayBit = 1 << paragonDay;

    const { results: systems } = await db.prepare(`
        SELECT s.id
        FROM systems s
        JOIN schedules sch ON sch.system_id = s.id
        WHERE s.status = 'active'
        AND (sch.days_of_week & ?) != 0
    `).bind(dayBit).all<{ id: string }>();

    if (systems.length === 0) return;

    const stmt = db.prepare(
        'INSERT OR IGNORE INTO instances (id, system_id, date, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const now = new Date().toISOString();
    const batch = systems.map(s =>
        stmt.bind(crypto.randomUUID(), s.id, dateStr, 'pending', now, now)
    );

    try {
        await db.batch(batch);
    } catch (e) {
        const msg = String(e);
        if (!msg.includes('UNIQUE constraint')) throw e;
    }
}

export async function generateInstancesForDate(db: D1Database, userId: string, dateStr: string): Promise<void> {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const jsDay = dateObj.getUTCDay();
    const paragonDay = (jsDay + 6) % 7;
    const dayBit = 1 << paragonDay;

    const { results: systems } = await db.prepare(`
        SELECT s.id
        FROM systems s
        JOIN schedules sch ON sch.system_id = s.id
        WHERE s.user_id = ?
        AND s.status = 'active'
        AND (sch.days_of_week & ?) != 0
    `).bind(userId, dayBit).all<{ id: string }>();

    if (systems.length === 0) return;

    const stmt = db.prepare(
        'INSERT OR IGNORE INTO instances (id, system_id, date, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const now = new Date().toISOString();
    const batch = systems.map(s =>
        stmt.bind(crypto.randomUUID(), s.id, dateStr, 'pending', now, now)
    );

    try {
        await db.batch(batch);
    } catch (e) {
        const msg = String(e);
        if (!msg.includes('UNIQUE constraint')) throw e;
    }
}

export async function generateTodayInstances(db: D1Database, userId: string): Promise<void> {
    return generateInstancesForDate(db, userId, toManilaDate());
}