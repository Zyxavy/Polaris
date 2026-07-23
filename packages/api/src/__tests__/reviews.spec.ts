import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { describe, it, expect, beforeEach, afterEach, vi, inject } from 'vitest';
import { Hono } from 'hono';
import reviewsRoutes, { reviewDayRoutes } from '../routes/reviews';

const migrations = inject('migrations');
let currentUserId: string;

async function seedUser(db: D1Database, userId: string) {
    const now = new Date().toISOString();
    await db.prepare(
        `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
         VALUES (?, ?, ?, 1, ?, ?)`
    ).bind(userId, 'Test User', `${userId}@test.com`, now, now).run();
}

function getAuthedApp(userId?: string) {
    const uid = userId ?? currentUserId;
    const app = new Hono<{ Bindings: CloudflareBindings; Variables: { user: any; session: any } }>();
    app.use('/api/*', async (c, next) => {
        c.set('user', { id: uid, email: 'test@test.com' });
        c.set('session', { id: crypto.randomUUID(), uid });
        await next();
    });
    app.route('/api/systems/:system_id/reviews', reviewsRoutes);
    app.route('/api', reviewDayRoutes);
    return app;
}

async function seedActiveSystem(db: D1Database, userId: string): Promise<string> {
    const systemId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare(
        `INSERT INTO systems (id, user_id, name, domain, floor_action, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(systemId, userId, 'Test System', 'health', 'Original floor action', 'active', now, now).run();
    return systemId;
}

async function seedInstance(
    db: D1Database, systemId: string, date: string, state: string
) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.prepare(
        `INSERT INTO instances (id, system_id, date, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, systemId, date, state, now, now).run();
}

// Suite 1: Write-back

describe('POST /api/systems/:system_id/reviews: write-back', () => {
    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
        currentUserId = crypto.randomUUID();
        await seedUser(env.DB, currentUserId);
    });

    it('writes back floor_action change to parent system', async () => {
        const systemId = await seedActiveSystem(env.DB, currentUserId);
        const app = getAuthedApp();

        const res = await app.fetch(new Request(
            `http://localhost/api/systems/${systemId}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period_start: '2026-07-13',
                    period_end: '2026-07-19',
                    what_worked: 'Consistent reading',
                    what_broke: 'Missed Wednesday',
                    worst_day_check: true,
                    change_applied: { floor_action: 'Read one chapter title' },
                }),
            }
        ), env);

        expect(res.status).toBe(201);
        const body = await res.json() as any;

        // Assert review exists with derived change_applied text
        expect(body.review.change_applied).toContain("floor_action: 'Read one chapter title'");

        // Assert system's floor_action was updated
        expect(body.updated_system.floor_action).toBe('Read one chapter title');
    });

    it('returns 201 without write-back when change_applied is empty', async () => {
        const systemId = await seedActiveSystem(env.DB, currentUserId);
        const app = getAuthedApp();

        const res = await app.fetch(new Request(
            `http://localhost/api/systems/${systemId}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period_start: '2026-07-13',
                    period_end: '2026-07-19',
                    what_worked: 'Did okay',
                    what_broke: '',
                    worst_day_check: false,
                }),
            }
        ), env);

        expect(res.status).toBe(201);
        const body = await res.json() as any;
        expect(body.review.change_applied).toBe('');
        expect(body.updated_system.floor_action).toBe('Original floor action');
    });

    it('uses change_applied_note as the stored description', async () => {
        const systemId = await seedActiveSystem(env.DB, currentUserId);
        const app = getAuthedApp();

        const res = await app.fetch(new Request(
            `http://localhost/api/systems/${systemId}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period_start: '2026-07-13',
                    period_end: '2026-07-19',
                    what_worked: 'Great',
                    what_broke: '',
                    worst_day_check: false,
                    change_applied: { floor_action: 'Read one chapter title' },
                    change_applied_note: 'I decided to lower my bar to just opening the book',
                }),
            }
        ), env);

        expect(res.status).toBe(201);
        const body = await res.json() as any;
        expect(body.review.change_applied).toBe('I decided to lower my bar to just opening the book');
        // Write-back still happens based on the structured object
        expect(body.updated_system.floor_action).toBe('Read one chapter title');
    });
});

// Suite 2: 409 Duplicate

describe('POST /api/systems/:system_id/reviews: 409 duplicate', () => {
    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
        currentUserId = crypto.randomUUID();
        await seedUser(env.DB, currentUserId);
    });

    it('returns 409 when a review already exists for the same period', async () => {
        const systemId = await seedActiveSystem(env.DB, currentUserId);
        const app = getAuthedApp();
        const url = `http://localhost/api/systems/${systemId}/reviews`;
        const body = {
            period_start: '2026-07-13',
            period_end: '2026-07-19',
            what_worked: 'First review',
            what_broke: '',
            worst_day_check: false,
        };

        // First: succeeds
        const res1 = await app.fetch(new Request(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }), env);
        expect(res1.status).toBe(201);

        // Second: 409
        const res2 = await app.fetch(new Request(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }), env);
        expect(res2.status).toBe(409);

        const err = await res2.json() as any;
        expect(err.error).toBe('review_already_exists');
    });

    it('allows reviews for different periods on the same system', async () => {
        const systemId = await seedActiveSystem(env.DB, currentUserId);
        const app = getAuthedApp();
        const url = `http://localhost/api/systems/${systemId}/reviews`;

        const res1 = await app.fetch(new Request(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                period_start: '2026-07-13', period_end: '2026-07-19',
                what_worked: '', what_broke: '', worst_day_check: false,
            }),
        }), env);
        expect(res1.status).toBe(201);

        const res2 = await app.fetch(new Request(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                period_start: '2026-07-20', period_end: '2026-07-26',
                what_worked: '', what_broke: '', worst_day_check: false,
            }),
        }), env);
        expect(res2.status).toBe(201);
    });
});

// Suite 3: Paginated GET

describe('GET /api/systems/:system_id/reviews: pagination', () => {
    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
        currentUserId = crypto.randomUUID();
        await seedUser(env.DB, currentUserId);
    });

    it('returns paginated reviews sorted by period_start DESC', async () => {
        const systemId = await seedActiveSystem(env.DB, currentUserId);
        const app = getAuthedApp();

        // Create 3 reviews for different periods
        const periods = [
            { period_start: '2026-07-06', period_end: '2026-07-12' },
            { period_start: '2026-07-13', period_end: '2026-07-19' },
            { period_start: '2026-07-20', period_end: '2026-07-26' },
        ];
        for (const p of periods) {
            await app.fetch(new Request(
                `http://localhost/api/systems/${systemId}/reviews`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...p, what_worked: '', what_broke: '', worst_day_check: false }),
                }
            ), env);
        }

        const res = await app.fetch(new Request(
            `http://localhost/api/systems/${systemId}/reviews?limit=2`
        ), env);

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.reviews).toHaveLength(2);
        expect(body.reviews[0].period_start).toBe('2026-07-20');
        expect(body.reviews[1].period_start).toBe('2026-07-13');
        expect(body.next_cursor).toBeTruthy();
    });

    it('returns 404 for non-existent system', async () => {
        const app = getAuthedApp();
        const res = await app.fetch(new Request(
            'http://localhost/api/systems/nonexistent/reviews'
        ), env);
        expect(res.status).toBe(404);
    });
});

// Suite 4: Review Day

describe('GET /api/review-day: due systems', () => {
    beforeEach(async () => {
        await applyD1Migrations(env.DB, migrations);
        currentUserId = crypto.randomUUID();
        await seedUser(env.DB, currentUserId);
        vi.useFakeTimers();
        // Set to a Wednesday (2026-07-22 is a Wednesday)
        vi.setSystemTime(new Date('2026-07-22T06:00:00.000Z'));
    });
    afterEach(() => { vi.useRealTimers(); });

    it('returns systems without a review for the last completed week', async () => {
        const systemId = await seedActiveSystem(env.DB, currentUserId);
        // The last completed Mon-Sun week for 2026-07-22 (Wed) is Jul 13-19
        // Seed some instances for that period
        await seedInstance(env.DB, systemId, '2026-07-13', 'full');
        await seedInstance(env.DB, systemId, '2026-07-14', 'floor');

        const app = getAuthedApp();
        const res = await app.fetch(new Request('http://localhost/api/review-day'), env);
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.due).toHaveLength(1);
        expect(body.due[0].system.name).toBe('Test System');
        expect(body.due[0].instance_summary.full).toBe(1);
        expect(body.due[0].instance_summary.floor).toBe(1);
        expect(body.due[0].instance_summary.missed).toBe(0);
    });

    it('excludes systems that already have a review for the period', async () => {
        const systemId = await seedActiveSystem(env.DB, currentUserId);
        const app = getAuthedApp();

        // Create a review for the last completed week
        await app.fetch(new Request(
            `http://localhost/api/systems/${systemId}/reviews`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period_start: '2026-07-13', period_end: '2026-07-19',
                    what_worked: '', what_broke: '', worst_day_check: false,
                }),
            }
        ), env);

        const res = await app.fetch(new Request('http://localhost/api/review-day'), env);
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.due).toHaveLength(0);
    });

    it('excludes non-active systems', async () => {
        const systemId = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare(
            `INSERT INTO systems (id, user_id, name, domain, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(systemId, currentUserId, 'Paused System', 'test', 'paused', now, now).run();

        const app = getAuthedApp();
        const res = await app.fetch(new Request('http://localhost/api/review-day'), env);
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.due).toHaveLength(0);
    });
});