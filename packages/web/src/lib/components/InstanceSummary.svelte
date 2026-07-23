<script lang="ts">
    let {
        counts,
        variant = 'md',
    }: {
        counts: { full: number; floor: number; missed: number };
        variant?: 'sm' | 'md';
    } = $props();
</script>

{#if variant === 'sm'}
    <div class="flex gap-3 text-xs font-body">
        <span class="text-blush">{counts.full} full</span>
        <span class="text-secondary">{counts.floor} floor</span>
        <span class="text-muted-foreground">{counts.missed} missed</span>
    </div>
{:else}
    <div class="grid grid-cols-3 gap-2">
        <div class="bg-blush/20 rounded-lg p-3 text-center">
            <span class="block text-xl font-display text-blush">{counts.full}</span>
            <span class="text-xs font-body text-blush">Full</span>
        </div>
        <div class="bg-secondary/15 rounded-lg p-3 text-center">
            <span class="block text-xl font-display text-secondary">{counts.floor}</span>
            <span class="text-xs font-body text-secondary">Floor</span>
        </div>
        <div class="bg-muted rounded-lg p-3 text-center">
            <span class="block text-xl font-display text-muted-foreground">{counts.missed}</span>
            <span class="text-xs font-body text-muted-foreground">Missed</span>
        </div>
    </div>
{/if}