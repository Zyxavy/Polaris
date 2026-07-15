
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

export async function getOwnedInstances(db: D1Database, instanceId: string, userId: string, ) {
    return await db.prepare(`
        SELECT instances.*
        FROM instances
        JOIN systems ON systems.id = instances.system_id
        WHERE instances.id = ? AND systems.user_id = ?
    `).bind(instanceId, userId).first<any>();
}