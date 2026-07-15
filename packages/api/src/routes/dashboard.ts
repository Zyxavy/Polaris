import { Hono } from 'hono';
import type { User, Session } from 'better-auth/types';
import { requireAuth } from '../middleware/require-auth';
import { todayBit, toManilaDate } from '../lib/calendar';
import { generateTodayInstances } from '../services/instances';

const app = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { user: User, session: Session};
}>();

app.use('/*', requireAuth);

app.get('/', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const todayStr = toManilaDate();

    //Lazy Generation
    await generateTodayInstances(db, userId).catch((e) => {
        const msg = String(e);
        if (!msg.includes('UNIQUE constraint')) throw e;
    });

    // Filtered SELECT with window gate
    const now = new Date();
    const manilaTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).format(now);

    const { results: instances } = await db.prepare(
        ` SELECT instances.*, systems.name, systems.domain, systems.floor_action
        FROM instances
        JOIN systems ON systems.id = instances.system_id
        JOIN schedules ON schedules.system_id = instances.system_id
        WHERE instances.date = ?
        AND systems.user_id = ?
        AND (schedules.days_of_week & ?) != 0
        AND schedules.time_window_start <= ?
        ORDER BY instances.created_at DESC`
    ).bind(todayStr, userId, todayBit(), manilaTime).all<any>();

    return c.json({ instances });

});


export default app;