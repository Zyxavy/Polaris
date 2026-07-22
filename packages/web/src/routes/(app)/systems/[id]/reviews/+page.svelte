<script lang="ts">
    import { goto } from '$app/navigation';

    let { data } = $props();
    let { reviews, next_cursor, systemId } = $derived(data);
</script>

<div class="max-w-2xl flex flex-col gap-4">
    <div class="flex items-center justify-between">
        <h2 class="font-display text-xl text-on-surface">Reviews</h2>
        <button
            onclick={() => goto(`/systems/${systemId}/reviews/new`)}
            class="rounded-md bg-primary px-4 py-2 text-sm font-body font-medium text-white"
        >
            New Review
        </button>
    </div>

    {#if reviews.length === 0}
        <p class="font-body text-on-surface-muted">No reviews yet.</p>
    {:else}
        <div class="flex flex-col gap-3">
            {#each reviews as review (review.id)}
                <div class="rounded-lg border border-border bg-surface p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-body text-sm font-medium text-on-surface">
                            {review.period_start} — {review.period_end}
                        </span>
                        <span class="font-body text-xs text-on-surface-muted">
                            {new Date(review.created_at).toLocaleDateString()}
                        </span>
                    </div>
                    {#if review.change_applied}
                        <p class="font-body text-sm text-on-surface-muted">{review.change_applied}</p>
                    {/if}
                    {#if review.what_worked}
                        <p class="font-body text-xs text-on-surface-muted mt-1">
                            <span class="font-medium">Worked:</span> {review.what_worked}
                        </p>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>