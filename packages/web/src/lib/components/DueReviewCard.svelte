<script lang="ts">
    import { goto } from '$app/navigation';
    import InstanceSummary from './InstanceSummary.svelte';
    import type { ReviewDayEntry } from '$lib/api/reviews';

    let { entry }: { entry: ReviewDayEntry } = $props();
</script>

<div class="bg-surface-container-lowest rounded-xl p-4 shadow-ambient-sm flex flex-col gap-3">
    <div>
        <h3 class="font-body font-semibold text-on-surface">{entry.system.name}</h3>
        {#if entry.system.floor_action}
            <p class="font-body text-xs text-on-surface-muted mt-0.5">{entry.system.floor_action}</p>
        {/if}
    </div>

    <InstanceSummary counts={entry.instance_summary} variant="sm" />

    <button
        onclick={() => goto(`/systems/${entry.system.id}/reviews/new?period_start=${entry.period_start}&period_end=${entry.period_end}`)}
        class="self-start rounded-md bg-primary px-4 py-1.5 text-xs font-body font-medium text-white"
    >
        Start Review
    </button>
</div>