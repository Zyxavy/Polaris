<script lang="ts">
    import InstanceCard from './InstanceCard.svelte';
    import type { DashboardInstance } from '../api/instances';

    let {
        instances,
        onMark,
    }: {
        instances: DashboardInstance[];
        onMark: (id: string, state: 'full' | 'floor' | 'missed') => void;
    } = $props();
</script>

<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {#each instances as instance (instance.id)}
        <InstanceCard {instance} {onMark} />
    {/each}
</div>
