<script lang="ts">
    import { WorkspaceEditorStore } from '$lib/stores/workspace-editor.svelte';
    import WidgetPalette from '$lib/components/WidgetPalette.svelte';
    import WorkspaceCanvas from '$lib/components/WorkspaceCanvas.svelte';
    import SaveBar from '$lib/components/SaveBar.svelte';

    let { data } = $props();

    let store = new WorkspaceEditorStore();
    let loaded = $state(false);

    $effect(() => {
        store.load(data.systemId, data.layout);
        loaded = true;
    });
</script>

{#if !loaded}
    <div class="skeleton h-[60vh] rounded-xl"></div>
{:else}
    <div class="flex gap-4">
        <WidgetPalette onAdd={(t) => store.addWidget(t)} />
        <WorkspaceCanvas
            widgets={store.layout.widgets}
            instanceId={data.instanceId}
            onReorder={(ws) => store.reorder(ws)}
            onRemove={(id) => store.removeWidget(id)}
        />
    </div>
    <SaveBar dirty={store.dirty} onSave={() => store.save()} />
{/if}