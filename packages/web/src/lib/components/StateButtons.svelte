<script lang="ts">
    let {
        instanceId,
        currentState,
        onMark,
    }: {
        instanceId: string;
        currentState: 'pending' | 'full' | 'floor' | 'missed';
        onMark: (id: string, state: 'full' | 'floor' | 'missed') => void;
    } = $props();

    const states = [
        { value: 'full' as const, label: 'Full', activeClass: 'bg-blush/20 text-blush' },
        { value: 'floor' as const, label: 'Floor', activeClass: 'bg-secondary/15 text-secondary' },
        { value: 'missed' as const, label: 'Missed', activeClass: 'bg-muted text-muted-foreground' },
    ];
</script>

<div class="flex gap-2">
    {#each states as s}
        <button
            onclick={() => onMark(instanceId, s.value)}
            disabled={currentState === s.value}
            class="rounded-full px-3 py-1.5 text-xs font-body font-medium transition-all duration-150
                   {currentState === s.value
                       ? s.activeClass
                       : 'bg-surface-container-low text-muted-foreground hover:bg-surface-container-lowest'}
                   disabled:cursor-default"
        >
            {s.label}
        </button>
    {/each}
</div>
