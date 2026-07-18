import { apiFetch } from './client';

export interface Layout {
    v: number;
    widgets: Widget[];
}

export interface Widget {
    id: string;
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    config: Record<string, any>;
    label?: string;
}

export interface Workspace {
    id: string;
    system_id: string;
    layout: Layout;
    created_at: string;
    updated_at: string;
}

export function getWorkspace(systemId: string): Promise<Workspace> {
    return apiFetch<Workspace>(`/api/systems/${systemId}/workspace`);
}

export function putWorkspace(systemId: string, layout: Layout): Promise<Workspace> {
    return apiFetch<Workspace>(`/api/systems/${systemId}/workspace`, {
        method: 'PUT',
        body: JSON.stringify({ layout }),
    });
}