import { getWorkspace } from '$lib/api/workspaces';
import { getSystemInstances } from '$lib/api/instances';
import { ApiError } from '$lib/api/client';
import type { Layout } from '$lib/api/workspaces';

export async function load({ params }) {
    const systemId = params.id;

    let layout: Layout | null = null;
    try {
        const ws = await getWorkspace(systemId);
        layout = ws.layout;
    } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
    }

    const today = new Date().toLocaleDateString('en-CA');
    let instanceId: string | null = null;
    try {
        const res = await getSystemInstances(systemId, { from: today, to: today });
        if (res.instances.length > 0) {
            instanceId = res.instances[0].id;
        }
    } catch { /* no instance for today */ }

    return { systemId, layout, instanceId };
}