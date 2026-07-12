<script lang="ts">
  import NavBar from '$lib/components/NavBar.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  let { children, data } = $props();
</script>

<NavBar session={data.session} />
<ToastContainer />
<main class="p-6">
  {@render children()}
</main>