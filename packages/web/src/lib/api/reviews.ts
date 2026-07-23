import { apiFetch } from './client';

export interface Review {
    id: string;
    system_id: string;
    period_start: string;
    period_end: string;
    what_worked: string;
    what_broke: string;
    worst_day_check: number;   // 0 | 1 from SQLite INTEGER
    change_applied: string;
    created_at: string;
    updated_at: string;
}

export interface ReviewListResponse {
    reviews: Review[];
    next_cursor: string | null;
}

export interface CreateReviewPayload {
    period_start: string;
    period_end: string;
    what_worked: string;
    what_broke: string;
    worst_day_check: boolean;
    change_applied?: {
        floor_action?: string;
        purpose?: string;
        philosophy?: string;
        protocol?: string;
        trigger?: string;
        environment_cue?: string;
    } | null;
    change_applied_note?: string | null;
}

export interface CreateReviewResponse {
    review: Review;
    updated_system: {
        id: string;
        floor_action: string;
        purpose: string;
        philosophy: string;
        protocol: string;
        trigger: string;
        environment_cue: string;
        [key: string]: any;
    };
}

export interface ReviewDayEntry {
    system: { id: string; name: string; floor_action: string };
    period_start: string;
    period_end: string;
    instance_summary: { full: number; floor: number; missed: number };
    last_review_id: string | null;
}

export interface ReviewDayResponse {
    due: ReviewDayEntry[];
}

export async function getReviews(systemId: string, params?: {
    cursor?: string; limit?: number;
}): Promise<ReviewListResponse> {
    const search = new URLSearchParams();
    if (params?.cursor) search.set('cursor', params.cursor);
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiFetch<ReviewListResponse>(`/api/systems/${systemId}/reviews${qs ? `?${qs}` : ''}`);
}

export async function createReview(systemId: string, payload: CreateReviewPayload): Promise<CreateReviewResponse> {
    return apiFetch<CreateReviewResponse>(`/api/systems/${systemId}/reviews`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function getReviewDay(): Promise<ReviewDayResponse> {
    return apiFetch<ReviewDayResponse>('/api/review-day');
}