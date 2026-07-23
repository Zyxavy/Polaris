<script lang="ts">
    import { Check } from '@lucide/svelte';

    let { dirty, onSave }: {
        dirty: boolean;
        onSave: () => void;
    } = $props();
</script>

<div class="sticky bottom-0 mt-6 bg-surface-container-lowest rounded-xl px-6 py-4 shadow-ambient-md
            flex items-center justify-between">
    <span class="text-xs text-muted-foreground flex items-center gap-2">
        {#if dirty}
            <span class="w-1.5 h-1.5 rounded-full bg-secondary" ></span>
            Unsaved changes
        {:else}
            <Check class="w-3 h-3" />
            Saved
        {/if}
    </span>
    <button
        onclick={onSave}
        disabled={!dirty}
        class="bg-gradient-to-br from-primary to-primary-container text-on-primary
               px-6 py-2.5 rounded-2xl font-semibold text-sm
               transition-all duration-200 hover:opacity-90 active:scale-[0.98]
               disabled:opacity-40 disabled:cursor-not-allowed
               cursor-pointer"
    >
        Save layout
    </button>
</div>