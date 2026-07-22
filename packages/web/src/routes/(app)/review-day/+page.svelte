<script lang="ts">
    import DueReviewList from '$lib/components/DueReviewList.svelte';

    let { data } = $props();
    let due = $derived(data.due);
</script>

<div class="w-full md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-0 flex flex-col gap-6">
    <h1 class="font-display text-2xl text-on-surface">Review Day</h1>
    <DueReviewList {due} />
</div>