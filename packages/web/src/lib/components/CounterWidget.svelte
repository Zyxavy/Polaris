<script lang="ts">
    import { createCounterLog, getCounterLogs } from '$lib/api/counter-logs';
    import { ApiError } from '$lib/api/client';
    import type { Widget } from '$lib/api/workspaces';

    let { widget, instanceId }: { widget: Widget; instanceId: string | null } = $props();

    let total = $state(0);
    let saving = $state(false);

    $effect(() => {
        if (instanceId) loadToday();
    });

    async function loadToday() {
        const today = new Date().toLocaleDateString('en-CA');
        try {
            const res = await getCounterLogs(widget.id, { from: today, to: today });
            total = res.counter_logs.reduce((sum, log) => sum + log.value, 0);
        } catch { /* silent */ }
    }

    async function handleIncrement() {
        if (!instanceId || saving) return;
        saving = true;
        total++;
        try {
            await createCounterLog(instanceId, { widget_id: widget.id, value: 1 });
        } catch (e) {
            total--;
            if (e instanceof ApiError) { /* silent */ }
        } finally {
            saving = false;
        }
    }
</script>

{#if !instanceId}
    <p class="text-sm text-muted-foreground text-center py-4">No instance for today</p>
{:else}
    <div class="flex flex-col items-center gap-3 py-2">
        <span class="text-3xl font-display font-bold text-on-surface">{total}</span>
        <button
            onclick={handleIncrement}
            disabled={saving}
            class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                   px-6 py-2 rounded-2xl font-semibold text-sm
                   disabled:opacity-40 cursor-pointer transition-all duration-200
                   hover:opacity-90 active:scale-[0.98]"
        >
            {saving ? '...' : '+1'}
        </button>
    </div>
{/if}
