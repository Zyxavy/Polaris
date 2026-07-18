<script lang="ts">
    import { dndzone } from 'svelte-dnd-action';
    import WidgetCard from './WidgetCard.svelte';
    import type { Widget } from '$lib/api/workspaces';

    let {
        widgets, instanceId, onReorder, onRemove,
    }: {
        widgets: Widget[];
        instanceId: string | null;
        onReorder: (widgets: Widget[]) => void;
        onRemove: (id: string) => void;
    } = $props();

    function handleConsider(e: CustomEvent) {
        onReorder(e.detail.items);
    }

    function handleFinalize() {
        // No-op: the store is already updated via handleConsider
    }

</script>

{#if widgets.length === 0}
    <div class="flex-1 bg-surface rounded-xl min-h-[60vh] flex items-center justify-center">
        <p class="font-body text-sm text-muted-foreground">
            Drag widgets from the palette to build your workspace
        </p>
    </div>
{:else}
    <div
        use:dndzone={{ items: widgets, flipDurationMs: 200 }}
        onconsider={handleConsider}
        onfinalize={handleFinalize}
        class="flex-1 bg-surface rounded-xl p-6 min-h-[60vh]
               grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min"
    >
        {#each widgets as widget (widget.id)}
            <WidgetCard {widget} {instanceId} {onRemove} />
        {/each}
    </div>
{/if}