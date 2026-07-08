export class ApiError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const BASE = import.meta.env.VITE_API_BASE_URL || '';
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options.headers },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'unknown', message: 'Something went wrong.' }));
        throw new ApiError(res.status, body.error, body.message);
    }

    return res.json();
}

