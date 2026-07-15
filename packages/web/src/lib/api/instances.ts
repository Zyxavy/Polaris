import { apiFetch } from './client';

export interface Instance {
    id: string;
    system_id: string;
    date: string;
    state: 'pending' | 'full' | 'floor' | 'missed';
    notes: string | null;
    workspace_snapshot: string | null;
    created_at: string;
    updated_at: string;
}

export interface DashboardInstance extends Instance {
    name: string;
    domain: string | null;
    floor_action: string;
}

export interface DashboardResponse {
    instances: DashboardInstance[];
}

export function getInstance(id: string): Promise<Instance> {
    return apiFetch<Instance>(`/api/instances/${id}`);
}

export function patchInstance(id: string, payload: { state?: string; notes?: string }): Promise<Instance> {
    return apiFetch<Instance>(`/api/instances/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export function getSystemInstances(systemId: string, params?: {
    from?: string; to?: string; cursor?: string; limit?: number;
}): Promise<{ instances: Instance[]; next_cursor: string | null }> {
    
    const search = new URLSearchParams();
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    if (params?.cursor) search.set('cursor', params.cursor);
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiFetch(`/api/systems/${systemId}/instances${qs ? `?${qs}` : ''}`);
}