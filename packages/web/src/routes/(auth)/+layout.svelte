<script lang="ts">
  import { goto } from '$app/navigation';
  import { authClient } from '$lib/auth-client';

  let { children } = $props();
  let ready = $state(false);

  $effect(() => {
    authClient.getSession().then(({ data: session }) => {
      if (session) { goto('/guides'); return; }
      ready = true;
    });
  });
</script>

{#if ready}
  {@render children()}
{/if}