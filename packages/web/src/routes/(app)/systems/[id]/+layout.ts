import { getSystem } from '$lib/api/systems';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
    const system = await getSystem(params.id).catch(() => null);
    if (!system) {
        throw error(404, 'System not found');
    }
    return { system };
}