<script lang="ts">
    import DueReviewCard from './DueReviewCard.svelte';
    import type { ReviewDayEntry } from '$lib/api/reviews';

    let { due }: { due: ReviewDayEntry[] } = $props();
</script>

{#if due.length === 0}
    <div class="bg-surface-container-low rounded-xl p-10 text-center">
        <h2 class="font-body text-lg font-semibold text-on-surface mb-2">All caught up!</h2>
        <p class="font-body text-sm text-muted-foreground">Every system has been reviewed for this period.</p>
    </div>
{:else}
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {#each due as entry (entry.system.id)}
            <DueReviewCard {entry} />
        {/each}
    </div>
{/if}