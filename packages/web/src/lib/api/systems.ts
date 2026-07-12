import { apiFetch } from './client';

export interface System {
    id: string;
    user_id: string;
    name: string;
    domain: string | null;
    purpose: string;
    philosophy: string;
    protocol: string;
    floor_action: string;
    trigger: string;
    barrier_list: string[];
    environment_cue: string;
    template_origin: string | null;
    status: 'active' | 'paused' | 'archived';
    created_at: string;
    updated_at: string;
}

export interface SystemListResponse {
    systems: System[];
    next_cursor: string | null;
}

export interface CreateSystemPayload {
    name: string;
    domain?: string | null;
    purpose?: string;
    philosophy?: string;
    protocol?: string;
    floor_action?: string;
    trigger?: string;
    barrier_list?: string[];
    environment_cue?: string;
    template_origin?: string | null;
}

export type PatchSystemPayload = Partial<CreateSystemPayload>;

export async function getSystems(params?: { status?: string; cursor?: string; limit?: number }): Promise<SystemListResponse> {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.cursor) search.set('cursor', params.cursor);
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiFetch<SystemListResponse>(`/api/systems${qs ? `?${qs}` : ''}`);
}

export async function createSystem(payload: CreateSystemPayload) {
    return apiFetch<System>('/api/systems', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function getSystem(id: string): Promise<System> {
    return apiFetch<System>(`/api/systems/${id}`);
}

export async function patchSystem(id: string, payload: PatchSystemPayload): Promise<System> {
    return apiFetch<System>(`/api/systems/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function confirmSystem(id: string): Promise<System> {
    return apiFetch<System>(`/api/systems/${id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
}

export async function archiveSystem(id: string): Promise<System> {
    return apiFetch<System>(`/api/systems/${id}/archive`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
}

