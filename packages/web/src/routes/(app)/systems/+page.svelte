<script lang="ts">
    import { goto } from '$app/navigation';

    let { data } = $props();
    let { systems, next_cursor } = $derived(data);
</script>

<div class="max-w-3xl">
  <div class="flex items-center justify-between mb-6">
    <h1 class="font-display text-2xl text-on-surface">Systems</h1>
    <button
      onclick={() => goto('/systems/new')}
      class="rounded-md bg-primary px-4 py-2 text-sm font-body font-medium text-white"
    >
      Create System
    </button>
  </div>

  {#if systems.length === 0}
    <p class="font-body text-on-surface-muted">No systems yet. Create one to get started.</p>
  {:else}
    <div class="flex flex-col gap-3">
      {#each systems as system (system.id)}
        <button
          onclick={() => goto(`/systems/${system.id}`)}
          class="flex items-center justify-between rounded-lg border border-border bg-surface p-4 text-left hover:border-primary transition-colors"
        >
          <div>
            <h3 class="font-body font-medium text-on-surface">{system.name}</h3>
            {#if system.domain}
              <p class="text-sm text-on-surface-muted font-body">{system.domain}</p>
            {/if}
          </div>
          <span class="text-xs font-body text-on-surface-muted">{system.status}</span>
        </button>
      {/each}
    </div>

    {#if next_cursor}
      <p class="mt-4 text-sm text-on-surface-muted font-body">(Pagination — "Load more" coming in a future slice)</p>
    {/if}
  {/if}
</div>