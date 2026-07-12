<script lang="ts">
    let { data } = $props();
    let system = $derived(data.system);
</script>

<div class="flex flex-col gap-4 max-w-2xl">
    {#if system.purpose}
        <div>
            <h3 class="font-body text-sm font-medium text-on-surface-muted">Purpose</h3>
            <p class="font-body text-on-surface">{system.purpose}</p>
        </div>
    {/if}
    {#if system.philosophy}
        <div>
            <h3 class="font-body text-sm font-medium text-on-surface-muted">Philosophy</h3>
            <p class="font-body text-on-surface">{system.philosophy}</p>
        </div>
    {/if}
    {#if system.protocol}
        <div>
            <h3 class="font-body text-sm font-medium text-on-surface-muted">Protocol</h3>
            <p class="font-body text-on-surface">{system.protocol}</p>
        </div>
    {/if}
    {#if system.floor_action}
        <div>
            <h3 class="font-body text-sm font-medium text-on-surface-muted">Floor Action</h3>
            <p class="font-body text-on-surface">{system.floor_action}</p>
        </div>
    {/if}
    {#if system.trigger}
        <div>
            <h3 class="font-body text-sm font-medium text-on-surface-muted">Trigger</h3>
            <p class="font-body text-on-surface">{system.trigger}</p>
        </div>
    {/if}
    {#if system.barrier_list.length > 0}
        <div>
            <h3 class="font-body text-sm font-medium text-on-surface-muted">Barriers</h3>
            <div class="flex flex-wrap gap-2 mt-1">
                {#each system.barrier_list as barrier}
                    <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-body text-primary">{barrier}</span>
                {/each}
            </div>
        </div>
    {/if}
    {#if system.environment_cue}
        <div>
            <h3 class="font-body text-sm font-medium text-on-surface-muted">Environment Cue</h3>
            <p class="font-body text-on-surface">{system.environment_cue}</p>
        </div>
    {/if}
    <div class="mt-4 pt-4 border-t border-border text-xs font-body text-on-surface-muted">
        Status: {system.status} &middot; Created {new Date(system.created_at).toLocaleDateString()}
    </div>
</div>