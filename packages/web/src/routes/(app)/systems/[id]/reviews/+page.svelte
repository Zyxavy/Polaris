<script lang="ts">
    import { goto } from '$app/navigation';

    let { data } = $props();

    let ready = $state(false);
    let loadError = $state(false);
    let reviews: any[] = $state([]);
    let next_cursor: string | null = $state(null);
    let systemId: string = $state('');

    $effect(() => {
        if (data) {
            ready = true;
            if (data.reviews) {
                reviews = data.reviews;
                next_cursor = data.next_cursor;
                systemId = data.systemId;
            } else {
                loadError = true;
            }
        }
    });
</script>

<div class="w-full md:max-w-2xl lg:max-w-3xl mx-auto px-4 md:px-0 flex flex-col gap-4">
  {#if !ready}
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div class="skeleton h-7 w-24 rounded-xl"></div>
        <div class="skeleton h-9 w-28 rounded-xl"></div>
      </div>
      {#each Array(3) as _}
        <div class="skeleton h-20 rounded-xl"></div>
      {/each}
    </div>
  {:else if loadError}
    <div class="flex flex-col items-center justify-center py-20 gap-4">
      <div class="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
        <span class="text-xl font-bold">!</span>
      </div>
      <h2 class="font-body text-lg font-semibold text-on-surface">Couldn't load reviews</h2>
      <p class="font-body text-sm text-muted-foreground text-center max-w-sm">Something went wrong.</p>
      <button
        onclick={() => location.reload()}
        class="bg-gradient-to-br from-primary to-primary-container text-on-primary
               px-5 py-2.5 rounded-2xl font-semibold text-sm mt-2 cursor-pointer"
      >
        Try again
      </button>
    </div>
  {:else}
    <div class="flex items-center justify-between">
      <h2 class="font-display text-xl text-on-surface">Reviews</h2>
      <a
        href="/systems/{systemId}/reviews/new"
        class="rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary
               px-4 py-2 text-sm font-body font-semibold
               transition-all duration-200 hover:opacity-90 active:scale-[0.98]
               cursor-pointer"
      >
        New Review
      </a>
    </div>

    {#if reviews.length === 0}
      <div class="bg-surface-container-low rounded-xl p-10 text-center">
        <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <span class="text-2xl">+</span>
        </div>
        <h2 class="font-body text-lg font-semibold text-on-surface mb-2">No reviews yet</h2>
        <p class="font-body text-sm text-muted-foreground max-w-sm mx-auto">
          Complete your first review week to see your history here.
        </p>
      </div>
    {:else}
      <div class="flex flex-col gap-3">
        {#each reviews as review (review.id)}
          <div class="bg-surface-container-lowest rounded-xl p-4 shadow-ambient-sm">
            <div class="flex items-center justify-between mb-2">
              <span class="font-body text-sm font-medium text-on-surface">
                {review.period_start} — {review.period_end}
              </span>
              <span class="font-body text-xs text-muted-foreground">
                {new Date(review.created_at).toLocaleDateString()}
              </span>
            </div>
            {#if review.change_applied}
              <p class="font-body text-sm text-muted-foreground">{review.change_applied}</p>
            {/if}
            {#if review.what_worked}
              <p class="font-body text-xs text-muted-foreground mt-1">
                <span class="font-medium">Worked:</span> {review.what_worked}
              </p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
