import { apiFetch } from './client';

export interface Schedule {
    id: string;
    system_id: string;
    days_of_week: number;
    time_window_start: string;
    time_window_end: string;
    recurrence: string;
    created_at: string;
    updated_at: string;
}

export interface ScheduleListResponse {
    schedules: Schedule[];
    next_cursor: string | null;
}

export interface CreateSchedulePayload {
    days_of_week: number;
    time_window_start: string;
    time_window_end: string;
}

export type PatchSchedulePayload = Partial<CreateSchedulePayload>;

export async function getSchedules(systemId: string): Promise<ScheduleListResponse> {
    return apiFetch<ScheduleListResponse>(`/api/systems/${systemId}/schedules`);    
}

export async function createSchedule(systemId: string, payload: CreateSchedulePayload): Promise<Schedule> {
    return apiFetch<Schedule>(`/api/systems/${systemId}/schedules`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function patchSchedule(id: string, payload: PatchSchedulePayload): Promise<Schedule> {
    return apiFetch<Schedule>(`/api/schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function deleteSchedule(id: string): Promise<{ id: string; deleted: true }> {
    return apiFetch(`/api/schedules/${id}`, {
        method: 'DELETE',
    });
}