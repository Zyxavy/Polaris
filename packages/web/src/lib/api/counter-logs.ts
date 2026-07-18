import { apiFetch } from './client';

export interface CounterLog {
    id: string;
    workspace_id: string;
    widget_id: string;
    instance_id: string;
    value: number;
    unit_label: string | null;
    created_at: string;
}

export interface CounterLogListResponse {
    counter_logs: CounterLog[];
}

export interface CreateCounterLogPayload {
    widget_id: string;
    value: number;
    unit_label?: string;
}

export function createCounterLog(instanceId: string, payload: CreateCounterLogPayload): Promise<CounterLog> {
    return apiFetch<CounterLog>(`/api/instances/${instanceId}/counter-logs`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function getCounterLogs(widgetId: string, params?: { from?: string; to?: string }): Promise<CounterLogListResponse> {
    const search = new URLSearchParams();
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiFetch<CounterLogListResponse>(`/api/widgets/${widgetId}/counter-logs${qs ? `?${qs}` : ''}`);
}

export function deleteCounterLog(id: string): Promise<{ id: string; deleted: true }> {
    return apiFetch(`/api/counter-logs/${id}`, {
        method: 'DELETE',
    });
}