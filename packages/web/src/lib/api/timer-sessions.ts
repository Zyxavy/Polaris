import { apiFetch } from "./client";

export interface TimerSession {
    id: string;
    workspace_id: string;
    widget_id: string;
    instance_id: string;
    duration_secs: number;
    started_at: string;
    ended_at: string;
    created_at: string;
}

export interface TimerSessionListResponse {
    timer_sessions: TimerSession[];
}

export interface CreateTimerSessionPayload {
    widget_id: string;
    duration_secs: number;
    started_at: string;
    ended_at: string;
}

export function createTimerSession(instanceId: string, payload: CreateTimerSessionPayload): Promise<TimerSession> {
    return apiFetch<TimerSession>(`/api/instances/${instanceId}/timer-sessions`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function getTimerSessions(widgetId: string, params?: { from?: string; to?: string }): Promise<TimerSessionListResponse> {
    const search = new URLSearchParams();
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    const qs = search.toString();
    return apiFetch<TimerSessionListResponse>(`/api/widgets/${widgetId}/timer-sessions${qs ? `?${qs}` : ''}`);
}

export function deleteTimerSession(id: string): Promise<{ id: string; deleted: true }> {
    return apiFetch(`/api/timer-sessions/${id}`, {
        method: 'DELETE',
    });
}