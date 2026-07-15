<script lang="ts">
    import { dashboardStore } from '$lib/stores/dashboard.svelte';
    import InstanceList from '$lib/components/InstanceList.svelte';

    let { data } = $props();
    let ready = $state(false);

    let statusHeader = $derived.by(() => {
        const instances = dashboardStore.instances;
        if (instances.length === 0) return null;
        const pending = instances.filter(i => i.state === 'pending').length;
        const full = instances.filter(i => i.state === 'full').length;
        const floor = instances.filter(i => i.state === 'floor').length;
        const allMarked = pending === 0;
        const allMissed = full === 0 && floor === 0;

        if (allMarked) {
            return {
                bg: 'bg-blush/30', text: 'text-blush',
                message: 'All systems nominal today'
            };
        }
        if (allMissed) {
            return {
                bg: 'bg-muted', text: 'text-muted-foreground',
                message: "Tomorrow's a new day"
            };
        }
        return {
            bg: 'bg-secondary/10', text: 'text-secondary',
            message: `${pending} system${pending !== 1 ? 's' : ''} left today`
        };
    });

    $effect(() => {
        if (data.instances || data.error) {
            if (data.instances) dashboardStore.load(data.instances);
            ready = true;
        }
    });
</script>

{#if !ready}
    <div class="flex flex-col gap-4 max-w-5xl mx-auto">
        <div class="skeleton h-14 rounded-xl"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {#each Array(4) as _}
                <div class="skeleton h-[180px]"></div>
            {/each}
        </div>
    </div>
{:else if data.error}
    <div class="flex flex-col items-center justify-center py-20 gap-4">
        <div class="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive
                    flex items-center justify-center">
            <span class="text-xl font-bold">!</span>
        </div>
        <h2 class="font-body text-lg font-semibold text-on-surface">Something went wrong</h2>
        <p class="font-body text-sm text-muted-foreground text-center max-w-sm">
            We couldn't load your dashboard. Please try again.
        </p>
        <button onclick={() => location.reload()}
                class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                       px-5 py-2.5 rounded-2xl font-semibold text-sm mt-2 cursor-pointer">
            Try again
        </button>
    </div>
{:else if dashboardStore.instances.length === 0}
    <div class="max-w-md mx-auto">
        <div class="bg-surface-container-low rounded-xl p-10 text-center">
            <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary
                        flex items-center justify-center mx-auto mb-4">
                <span class="text-2xl">+</span>
            </div>
            <h2 class="font-body text-lg font-semibold text-on-surface mb-2">No systems yet</h2>
            <p class="font-body text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                Set up your first system to get started.
            </p>
            <a href="/systems/new"
               class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                      px-5 py-2.5 rounded-2xl font-semibold text-sm inline-block
                      transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                      cursor-pointer">
                Create a system
            </a>
        </div>
    </div>
{:else}
    <div class="max-w-5xl mx-auto flex flex-col gap-6">
        {#if statusHeader}
            <div class="{statusHeader.bg} {statusHeader.text} rounded-xl px-6 py-4 flex items-center gap-3">
                <span class="font-body font-semibold">{statusHeader.message}</span>
            </div>
        {/if}
        <InstanceList instances={dashboardStore.instances} onMark={(id, state) => dashboardStore.markState(id, state)} />
    </div>
{/if}
