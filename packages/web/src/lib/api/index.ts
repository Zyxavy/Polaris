import { apiFetch, ApiError } from './client';
import { toastStore } from '$lib/stores/toast.svelte';

export async function apiFetchWithToast<T>(path: string, options?: RequestInit): Promise<T> {
    try {
        return await apiFetch<T>(path, options);
    } catch (e) {
        if (e instanceof ApiError && e.status < 500) {
            toastStore.push({ type: 'error', message: e.message });
        }
        throw e;
    }
}