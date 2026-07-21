<script lang="ts">
    import { X } from '@lucide/svelte';
    import type { Widget } from '$lib/api/workspaces';
    import CounterWidget from './CounterWidget.svelte';
    import TimerWidget from './TimerWidget.svelte';
    import ChecklistWidget from './ChecklistWidget.svelte';
    import LogWidget from './LogWidget.svelte';

    let { widget, instanceId, onRemove }: {
        widget: Widget;
        instanceId: string | null;
        onRemove: (id: string) => void;
    } = $props();
</script>

<div class="bg-surface-container-lowest rounded-xl p-4 shadow-ambient-sm
            transition-shadow duration-200 hover:shadow-ambient-md
            min-h-[140px] flex flex-col">
    <div class="flex items-center justify-between mb-3">
        <h4 class="font-body text-sm font-semibold text-on-surface">{widget.label}</h4>
        <button
            onclick={() => onRemove(widget.id)}
            class="text-muted-foreground hover:text-destructive transition-colors cursor-pointer p-0.5 rounded"
            aria-label="Remove {widget.label}"
        >
            <X class="w-4 h-4" />
        </button>
    </div>

    {#if widget.type === 'counter'}
        <CounterWidget {widget} {instanceId} />
    {:else if widget.type === 'timer'}
        <TimerWidget {widget} {instanceId} />
    {:else if widget.type === 'checklist'}
        <ChecklistWidget {widget} {instanceId} />
    {:else if widget.type === 'log'}
        <LogWidget {widget} {instanceId} />
    {:else}
        <div class="flex-1 flex items-center justify-center">
            <p class="text-xs text-muted-foreground">Coming in a future update</p>
        </div>
    {/if}
</div>