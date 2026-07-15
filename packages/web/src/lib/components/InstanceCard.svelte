<script lang="ts">
    import StateButtons from './StateButtons.svelte';
    import type { DashboardInstance } from '../api/instances';

    let {
        instance,
        onMark,
    }: {
        instance: DashboardInstance;
        onMark: (id: string, state: 'full' | 'floor' | 'missed') => void;
    } = $props();
</script>

<div class="bg-surface-container-lowest rounded-xl p-4 shadow-ambient-sm
            transition-shadow duration-200 hover:shadow-ambient-md
            flex flex-col gap-3 min-h-[140px]">
    <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
            <h3 class="font-body text-sm font-semibold text-on-surface truncate">
                {instance.name}
            </h3>
            {#if instance.domain}
                <p class="font-body text-xs text-muted-foreground mt-0.5">
                    {instance.domain}
                </p>
            {/if}
        </div>
    </div>

    {#if instance.floor_action}
        <p class="font-body text-xs text-on-surface/70 leading-relaxed line-clamp-2">
            {instance.floor_action}
        </p>
    {/if}

    <div class="mt-auto">
        <StateButtons
            instanceId={instance.id}
            currentState={instance.state}
            {onMark}
        />
    </div>
</div>
