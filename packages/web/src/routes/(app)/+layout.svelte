<script lang="ts">
  import NavBar from '$lib/components/NavBar.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  let { children, data } = $props();
</script>

<NavBar session={data.session} />
<ToastContainer />
<main
  class="max-w-6xl mx-auto px-6 py-8 pb-[calc(56px+1.5rem)] lg:pb-8 xl:ml-48"
  style="min-height: 100dvh"
>
  {@render children()}
</main>
