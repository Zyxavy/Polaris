<script lang="ts">
  import { toastStore } from '$lib/stores/toast.svelte';
</script>

{#if toastStore.items.length > 0}
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {#each toastStore.items as item (item.id)}
            <div
                class="rounded-lg px-4 py-3 text-sm font-body shadow-ambient-3 transition-all
                {item.type === 'error' ? 'bg-destructive text-white' : 'bg-primary text-white'}">
                {item.message}
            </div>
        {/each}

    </div>
{/if}