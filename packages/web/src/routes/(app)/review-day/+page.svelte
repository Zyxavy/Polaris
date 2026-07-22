<script lang="ts">
    import DueReviewList from '$lib/components/DueReviewList.svelte';

    let { data } = $props();
    let due = $derived(data.due);
</script>

<div class="max-w-5xl mx-auto flex flex-col gap-6">
    <h1 class="font-display text-2xl text-on-surface">Review Day</h1>
    <DueReviewList {due} />
</div>