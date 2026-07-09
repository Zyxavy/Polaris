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
