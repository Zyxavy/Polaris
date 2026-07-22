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
        <span class="text-status-full">{counts.full} full</span>
        <span class="text-status-floor">{counts.floor} floor</span>
        <span class="text-status-missed">{counts.missed} missed</span>
    </div>
{:else}
    <div class="grid grid-cols-3 gap-2">
        <div class="bg-status-full/10 rounded-lg p-3 text-center">
            <span class="block text-xl font-display text-status-full">{counts.full}</span>
            <span class="text-xs font-body text-status-full">Full</span>
        </div>
        <div class="bg-status-floor/10 rounded-lg p-3 text-center">
            <span class="block text-xl font-display text-status-floor">{counts.floor}</span>
            <span class="text-xs font-body text-status-floor">Floor</span>
        </div>
        <div class="bg-status-missed/10 rounded-lg p-3 text-center">
            <span class="block text-xl font-display text-status-missed">{counts.missed}</span>
            <span class="text-xs font-body text-status-missed">Missed</span>
        </div>
    </div>
{/if}