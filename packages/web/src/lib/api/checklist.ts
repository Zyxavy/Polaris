import { apiFetch } from './client';

export interface ChecklistStep {
    label: string;
    checked: boolean;
}

export interface ChecklistEntry {
    id: string;
    workspace_id: string;
    widget_id: string;
    instance_id: string;
    entry_type: string;
    data: { steps: ChecklistStep[] };
    created_at: string;
}

export function putChecklist(instanceId: string, widgetId: string, steps: ChecklistStep[]): Promise<ChecklistEntry> {
    return apiFetch<ChecklistEntry>(`/api/instances/${instanceId}/checklist/${widgetId}`, {
        method: 'PUT',
        body: JSON.stringify({ steps }),
    });
}

export function getChecklist(instanceId: string, widgetId: string): Promise<ChecklistEntry> {
    return apiFetch<ChecklistEntry>(`/api/instances/${instanceId}/checklist/${widgetId}`);
}