
export async function getOwnedSystem(db: D1Database, systemId: string, userId: string) {
    const row = await db.prepare(
        'SELECT * FROM systems WHERE id = ? AND user_id = ?'
    ).bind(systemId, userId).first<any>();
    
    if(!row) return null;

    return {
        ...row,
        barrier_list: typeof row.barrier_list === 'string' ? JSON.parse(row.barrier_list) : row.barrier_list,
    };
}

export async function getOwnedSchedule(db:D1Database, scheduleId: string, userId: string) {
    return await db.prepare(`
        SELECT s.* FROM schedules s
        JOIN systems sys ON s.system_id = sys.id
        WHERE s.id = ? AND sys.user_id = ?
    `).bind(scheduleId, userId).first<any>();
}

export async function getOwnedInstance(db: D1Database, instanceId: string, userId: string) {
    return await db.prepare(`
        SELECT instances.*git push --set-upstream origin feat/reviews
        FROM instances
        JOIN systems ON systems.id = instances.system_id
        WHERE instances.id = ? AND systems.user_id = ?
    `).bind(instanceId, userId).first<any>();
}

export async function getOwnedReview(db: D1Database, reviewId: string, userId: string) {
    return await db.prepare(
        `SELECT r.* FROM reviews r
        JOIN systems s ON r.system_id = s.id
        WHERE r.id = ? AND s.user_id = ?`
    ).bind(reviewId, userId).first<any>();
}

export async function getOwnedWorkspace(db: D1Database, systemId: string, userId: string) {
    return await db.prepare(`
        SELECT w.* FROM workspaces w
        JOIN systems s ON w.system_id = s.id
        WHERE w.system_id = ? AND s.user_id = ?
    `).bind(systemId, userId).first<any>();
}

export async function getOwnedWidgetEntry(db: D1Database, instanceId: string, widgetId: string, entryType: string, userId: string) {
    return await db.prepare(`
        SELECT we.* FROM widget_entries we
        JOIN instances i ON we.instance_id = i.id
        JOIN systems s ON i.system_id = s.id
        WHERE we.instance_id = ? AND we.widget_id = ? AND we.entry_type = ?
        AND s.user_id = ?
    `).bind(instanceId, widgetId, entryType, userId).first<any>();
}