import { getSystems } from '$lib/api/systems';

export async function load() {
    const data = await getSystems();
    return { systems: data.systems, next_cursor: data.next_cursor };
}