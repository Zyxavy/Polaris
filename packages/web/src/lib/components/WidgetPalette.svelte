<script lang="ts">
    import { Timer, Plus, ListChecks, FileText, Link, Flame, ChartLine, StickyNote } from '@lucide/svelte';

    let { onAdd }: { onAdd: (type: string) => void } = $props();

    const widgetTypes = [
        { type: 'timer', label: 'Timer', icon: Timer, comingSoon: false },
        { type: 'counter', label: 'Counter', icon: Plus, comingSoon: false },
        { type: 'checklist', label: 'Checklist', icon: ListChecks, comingSoon: false },
        { type: 'log', label: 'Log', icon: FileText, comingSoon: true },
        { type: 'link-list', label: 'Link List', icon: Link, comingSoon: true },
        { type: 'streak', label: 'Streak', icon: Flame, comingSoon: true },
        { type: 'progress', label: 'Progress Chart', icon: ChartLine, comingSoon: true },
        { type: 'notes', label: 'Notes', icon: StickyNote, comingSoon: true },
    ];

</script>

<aside class="w-[200px] shrink-0 bg-surface-container-low rounded-xl p-4 flex flex-col gap-1">
    <h3 class="font-body text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Widgets</h3>
    {#each widgetTypes as w}
        <button
            onclick={() => { if (!w.comingSoon) onAdd(w.type); }}
            disabled={w.comingSoon}
            title={w.comingSoon ? 'Coming in a future update' : `Add ${w.label}`}
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-on-surface
                   transition-all duration-150
                   {w.comingSoon
                       ? 'opacity-30 cursor-not-allowed'
                       : 'hover:bg-surface-container-lowest hover:shadow-ambient-sm cursor-pointer active:scale-[0.98]'
                   }"
        >
            <w.icon class="w-4 h-4 {w.comingSoon ? 'text-muted-foreground' : 'text-primary'}" />
            <span class="font-medium">{w.label}</span>
            {#if w.comingSoon}
                <span class="ml-auto text-[10px] text-muted-foreground">Soon</span>
            {/if}
        </button>
    {/each}
</aside>