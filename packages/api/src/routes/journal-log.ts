import { Hono } from "hono";
import { requireAuth } from "../middleware/require-auth";
import { getOwnedInstance } from "../lib/ownership";
import { getMongoClient } from "../lib/mongo";
import type { User, Session } from "better-auth/types";

// Types shared with the queue consumer in index.ts

export interface JournalEntryResult {
    entry_id: string;
    text: string;
    created_at: string;
}

export interface JournalRetryMessage {
    entry_id: string;
    system_id: string;
    workspace_id: string;
    instance_id: string;
    widget_id: string;
    user_id: string;
    text: string;
    created_at: string;
}

// Cursor helpers for pagination

function encodeCursor(createdAt: string, entryId: string): string {
    return btoa(JSON.stringify({ c: createdAt, e: entryId }));
}

function decodeCursor(raw: string): { c: string; e: string } | null {
    try {
        const p = JSON.parse(atob(raw));
        if (typeof p.c === 'string' && typeof p.e === 'string') return p;
        return null;
    } catch {
        return null;
    }
}

// Routes

const app = new Hono<{
    Bindings: CloudflareBindings;
    Variables: { user: User; session: Session };
}>();

app.use('/*', requireAuth);

app.post('/instances/:instance_id/journal_log/:widget_id', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const instanceId = c.req.param('instance_id');
    const widgetId = c.req.param('widget_id');

    //check if user owns instance
    const instance = await getOwnedInstance(db, instanceId, userId);
    if (!instance) {
        return c.json({ error: 'not_found', message: 'Instance not found.' }, 404);
    }

    //Validate input
    const body = await c.req.json<any>();
    if (typeof body.text !== 'string' || body.text.trim().length === 0) {
        return c.json({ error: 'invalid_input', message: 'text must be a non-empty string.' }, 400);
    }

    // Look up the workspace_id
    const ws = await db.prepare(
        'SELECT id FROM workspaces WHERE system_id = ?'
    ).bind(instance.system_id).first<{ id: string }>();
    if (!ws) {
        return c.json({ error: 'not_found', message: 'Workspace not found.' }, 404);
    }

    // Generate UUID before any I/O
    const entryId = crypto.randomUUID();
    const now = new Date().toISOString();

    //Attempt direct-write path
    try {
        const client = await getMongoClient(c.env.MONGODB_URI);
        const collection = client.db().collection('journal_entries');

        await collection.insertOne({
            _id: entryId,
            system_id: instance.system_id,
            instance_id: instanceId,
            widget_id: widgetId,
            user_id: userId,
            text: body.text,
            schema_version: 1,
            created_at: new Date(now),
            updated_at: new Date(now),
        });

        // Mongo succeeded
        await db.prepare(
            `INSERT INTO widget_entries (id, workspace_id, widget_id, instance_id, entry_type, data, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            entryId, ws.id, widgetId, instanceId,
            'log_meta',
            JSON.stringify({ mongo_id: entryId }),
            now
        ).run();

        console.log(`[mongo] direct-write success instance=${instanceId} widget=${widgetId} entry=${entryId}`);
        return c.json({ entry_id: entryId, created_at: now }, 201);

    } catch (err) {

        // Mongo write failed 
        console.warn(`[mongo] direct-write failed, enqueuing instance=${instanceId} widget=${widgetId}`, err);

        await c.env.JOURNAL_RETRY_QUEUE.send({
            entry_id: entryId,
            system_id: instance.system_id,
            workspace_id: ws.id,
            instance_id: instanceId,
            widget_id: widgetId,
            user_id: userId,
            text: body.text,
            created_at: now,
        } satisfies JournalRetryMessage);

        return c.json({ entry_id: entryId, created_at: now, status: 'pending' }, 202);
    }

});

app.get('/instances/:instance_id/journal_log/:widget_id', async (c) => {
    const userId = c.get('user').id;
    const db = c.env.DB;
    const instanceId = c.req.param('instance_id');
    const widgetId = c.req.param('widget_id');

    // Verify ownership
    const instance = await getOwnedInstance(db, instanceId, userId);
    if (!instance) {
        return c.json({ error: 'not_found', message: 'Instance not found.' }, 404);
    }

    // Parse pagination params
    const cursor = c.req.query('cursor');
    const limitParam = c.req.query('limit');
    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 100);

    try {
        const client = await getMongoClient(c.env.MONGODB_URI);
        const collection = client.db().collection('journal_entries');

        const filter: Record<string, unknown> = {
            instance_id: instanceId,
            widget_id: widgetId,
        };

        if (cursor) {
            const decoded = decodeCursor(cursor);
            if (decoded) {
                filter.$or = [
                    { created_at: { $lt: new Date(decoded.c) } },
                    { created_at: new Date(decoded.c), _id: { $lt: decoded.e } },
                ];
            }
        }

        const docs = await collection
            .find(filter)
            .project<{ _id: string; text: string; created_at: Date }>({ _id: 1, text: 1, created_at: 1 })
            .sort({ created_at: -1, _id: -1 })
            .limit(limit + 1)
            .toArray();

        const hasMore = docs.length > limit;
        const entries = hasMore ? docs.slice(0, limit) : docs;

        let next_cursor: string | null = null;
        if (hasMore && entries.length > 0) {
            const last = entries[entries.length - 1];
            next_cursor = encodeCursor(last.created_at.toISOString(), last._id);
        }

        return c.json({
            entries: entries.map(d => ({
                entry_id: d._id,
                text: d.text,
                created_at: d.created_at instanceof Date ? d.created_at.toISOString() : d.created_at,
            })) satisfies JournalEntryResult[],
            next_cursor,
        });
    } catch {
        console.warn(`[mongo] read-failed instance=${instanceId} widget=${widgetId}`);
        return c.json({ entries: [], next_cursor: null });
    }
});

export default app;