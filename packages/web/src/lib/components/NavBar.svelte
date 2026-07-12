<script lang="ts">
    import { goto } from "$app/navigation";
    import { authClient } from '$lib/auth-client';

    let { session }: {session: any} = $props();

    async function handleSignOut() {
        await authClient.signOut();
        goto('/');
    }
    
</script>

<nav class="h-14 border-b border-border bg-surface flex items-center justify-between px-6">
  <div class="flex items-center gap-6">
    <span class="font-display font-semibold text-primary">Polaris</span>
    <a href="/dashboard" class="font-body text-sm text-on-surface-muted hover:text-on-surface">Dashboard</a>
    <a href="/systems" class="font-body text-sm text-on-surface-muted hover:text-on-surface">Systems</a>
    <a href="/review-day" class="font-body text-sm text-on-surface-muted hover:text-on-surface">Review Day</a>
    <a href="/guides" class="font-body text-sm text-on-surface-muted hover:text-on-surface">Guides</a>
  </div>
  <div class="flex items-center gap-3">
    <span class="font-body text-sm text-on-surface-muted">{session?.user?.email}</span>
    <button
      onclick={handleSignOut}
      class="font-body text-sm text-destructive hover:underline"
    >
      Sign out
    </button>
  </div>
</nav>