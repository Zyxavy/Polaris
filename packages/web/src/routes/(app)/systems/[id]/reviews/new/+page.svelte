<script lang="ts">
    import { getSystemInstances } from '$lib/api/instances';
    import ReviewForm from '$lib/components/ReviewForm.svelte';
    import { page } from '$app/state';

    let { data } = $props();
    let system = $derived(data.system);

    // Compute period: from query params, or default to last Mon-Sun week
    function computePeriod() {
        const params = page.url.searchParams;
        if (params.get('period_start') && params.get('period_end')) {
            return {
                period_start: params.get('period_start')!,
                period_end: params.get('period_end')!,
            };
        }
        // Fall back to last completed Mon-Sun week
        const now = new Date();
        const day = now.getDay();
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - day);
        if (day === 0) lastSunday.setDate(lastSunday.getDate() - 7);
        const lastMonday = new Date(lastSunday);
        lastMonday.setDate(lastSunday.getDate() - 6);

        const fmt = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
        };
        return { period_start: fmt(lastMonday), period_end: fmt(lastSunday) };
    }

    let period = $derived(computePeriod());
    let instanceCounts = $state({ full: 0, floor: 0, missed: 0 });
    let loading = $state(true);

    $effect(() => {
        getSystemInstances(data.system.id, {
            from: period.period_start,
            to: period.period_end,
        }).then(res => {
            const counts = { full: 0, floor: 0, missed: 0 };
            for (const inst of res.instances) {
                if (inst.state === 'full') counts.full++;
                else if (inst.state === 'floor') counts.floor++;
                else if (inst.state === 'missed') counts.missed++;
            }
            instanceCounts = counts;
        }).finally(() => { loading = false; });
    });
</script>

<div class="w-full md:max-w-2xl lg:max-w-3xl mx-auto px-4 md:px-0">
    <p class="font-body text-sm text-on-surface-muted mb-6">
        Reviewing {period.period_start} — {period.period_end}
    </p>

    {#if loading}
        <div class="skeleton h-96 rounded-xl"></div>
    {:else}
        <ReviewForm
            systemId={system.id}
            {system}
            periodStart={period.period_start}
            periodEnd={period.period_end}
            instanceCounts={instanceCounts}
        />
    {/if}
</div>