import { apiFetch } from './client';

export interface JournalEntryResult {
    entry_id: string;
    text: string;
    created_at: string;
}

export interface JournalListResponse {
    entries: JournalEntryResult[];
    next_cursor: string | null;
}

export interface JournalPostResponse {
    entry_id: string;
    created_at: string;
}

export async function postJournalEntry(instanceId: string, widgetId: string, text: string): Promise<JournalPostResponse> {
    return apiFetch(`/api/instances/${instanceId}/journal_log/${widgetId}`, {
        method: 'POST',
        body: JSON.stringify({ text }),
    });
}

export async function getJournalEntries(
    instanceId: string,
    widgetId: string,
    cursor?: string,
    limit?: number
): Promise<JournalListResponse> {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return apiFetch(
        `/api/instances/${instanceId}/journal_log/${widgetId}${qs ? '?' + qs : ''}`
    );
}