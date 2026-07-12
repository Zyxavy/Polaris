<script lang="ts">
    import SystemForm from "$lib/components/SystemForm.svelte";
    let { data } = $props();
    
</script>

<div class="max-w-3xl">
    <h1 class="font-display text-2xl text-on-surface mb-6">Edit System</h1>
    <SystemForm system={data.system} />
</div>