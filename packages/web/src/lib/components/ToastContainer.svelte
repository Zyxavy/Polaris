<script lang="ts">
  import { toastStore } from '$lib/stores/toast.svelte';
  import { fly } from 'svelte/transition';

  const bg = (type: string) =>
    type === 'error' ? 'bg-destructive text-white' :
    type === 'success' ? 'bg-primary text-white' :
    'bg-primary text-white';
</script>

{#if toastStore.items.length > 0}
  <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
    {#each toastStore.items as item (item.id)}
      <div
        class="pointer-events-auto rounded-xl px-4 py-3 text-sm font-body shadow-ambient-lg flex items-start gap-3 {bg(item.type)}"
        transition:fly={{ x: 20, duration: 200, opacity: 0}}
      >
        <span class="flex-1">{item.message}</span>
        <button
          onclick={() => toastStore.dismiss(item.id)}
          class="shrink-0 opacity-70 hover:opacity-100 transition-opacity cursor-pointer leading-none"
          aria-label="Dismiss"
        >&times;</button>
      </div>
    {/each}
  </div>
{/if}
