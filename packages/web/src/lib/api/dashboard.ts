import { apiFetch } from './client';
import type { DashboardResponse } from './instances';

export function getDashboard(): Promise<DashboardResponse> {
    return apiFetch<DashboardResponse>('/api/dashboard');
}