import { getDashboard } from '$lib/api/dashboard';

export async function load() {
    try {
        const data = await getDashboard();
        return { instances: data.instances };
    } catch {
        return { instances: [], error: true };
    }
}
