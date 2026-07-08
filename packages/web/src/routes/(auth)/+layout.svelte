<script lang="ts">
  import { redirect } from '@sveltejs/kit';
  import { authClient } from '$lib/auth-client';

  let { children } = $props();
  let ready = $state(false);

  $effect(() => {
    authClient.getSession().then(({ data: session }) => {
      if (session) throw redirect(302, '/guides');
      ready = true;
    });
  });
</script>

{#if ready}
  {@render children()}
{/if}