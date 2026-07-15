import { patchInstance } from '$lib/api/instances';
import type { DashboardInstance } from '$lib/api/instances';
import { toastStore } from './toast.svelte';

class DashboardStore {
    instances = $state<DashboardInstance[]>([]);

    load(instances: DashboardInstance[]) {
        this.instances = instances;
    }

    async markState(instanceId: string, state: 'full' | 'floor' | 'missed') {
        const idx = this.instances.findIndex(i => i.id === instanceId);
        if (idx === -1) return;

        const prev = this.instances[idx];
        this.instances[idx] = { ...prev, state };

        try {
            const updated = await patchInstance(instanceId, { state });
            this.instances[idx] = {
                ...this.instances[idx],
                state: updated.state as DashboardInstance['state'],
                notes: updated.notes,
            };
        } catch {
            this.instances[idx] = prev;
            toastStore.push({ type: 'error', message: 'Could not save — try again.' });
        }
    }
}

export const dashboardStore = new DashboardStore();
