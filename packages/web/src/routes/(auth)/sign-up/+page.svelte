<script lang="ts">
    import { redirect } from "@sveltejs/kit";
    import { authClient } from "$lib/auth-client";
    import { apiFetch } from '$lib/api/client';

    let name = $state('');
    let email = $state('');
    let password = $state('');
    let error = $state('');
    let codes: string[] | null = $state(null);

    async function handleSignUp(e: Event) {
        e.preventDefault();
        error = '';
        const { error: err } = await authClient.signUp.email({ email, password, name });
        if (err) {
            error = err.message || 'Could not create account.';
            return;
        }
        try {
            const { codes: generated } = await apiFetch<{ codes: string[] }>('/api/recovery-codes/generate', { method: 'POST' });
            codes = generated;
        } catch {
            throw redirect(302, '/guides');
        }
    }

    function handleDone() {
        throw redirect(302, '/guides');
    }

    async function copyCodes() {
        if (codes) await navigator.clipboard.writeText(codes.join('\n'));
    }
</script>

<div class="min-h-screen flex items-center justify-center px-4 bg-surface">
  <div class="w-full max-w-sm flex flex-col items-center gap-8">
    <a href="/" class="flex items-center gap-2 font-display text-2xl font-semibold text-primary">
      <span class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary text-sm font-bold">P</span>
      Polaris
    </a>

    <div class="w-full bg-surface-container-lowest rounded-xl p-8 shadow-ambient-md">
      <h1 class="font-display text-xl font-semibold text-on-surface mb-6 text-center">Create your account</h1>

      <form class="flex flex-col gap-5" onsubmit={handleSignUp}>
        <div class="flex flex-col gap-1.5">
          <label for="name" class="font-body text-sm font-medium text-on-surface">Name</label>
          <input id="name" type="text" bind:value={name}
                 class="w-full px-4 py-3 bg-surface-container-low text-on-surface
                        border border-border rounded-xl
                        transition-colors duration-200
                        focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
                        placeholder:text-muted-foreground"
                 placeholder="Your name" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="email" class="font-body text-sm font-medium text-on-surface">Email</label>
          <input id="email" type="email" bind:value={email}
                 class="w-full px-4 py-3 bg-surface-container-low text-on-surface
                        border border-border rounded-xl
                        transition-colors duration-200
                        focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
                        placeholder:text-muted-foreground"
                 placeholder="you@example.com" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="password" class="font-body text-sm font-medium text-on-surface">Password</label>
          <input id="password" type="password" bind:value={password}
                 class="w-full px-4 py-3 bg-surface-container-low text-on-surface
                        border border-border rounded-xl
                        transition-colors duration-200
                        focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
                        placeholder:text-muted-foreground"
                 placeholder="At least 8 characters" />
        </div>

        {#if error}
          <p class="text-destructive text-sm font-body">{error}</p>
        {/if}

        <button type="submit"
                class="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary
                       py-3 rounded-2xl font-semibold
                       transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                       cursor-pointer">
          Create account
        </button>
      </form>
    </div>

    <p class="font-body text-sm text-muted-foreground">
      Already have an account?
      <a href="/sign-in" class="text-primary hover:underline font-medium">Sign in</a>
    </p>
  </div>
</div>

{#if codes}
  <div class="fixed inset-0 bg-on-surface/30 backdrop-blur-sm z-40 flex items-center justify-center p-4">
    <div class="bg-surface-container-lowest text-on-surface rounded-xl p-8 shadow-ambient-lg max-w-md w-full">
      <h2 class="font-display text-lg font-semibold text-on-surface mb-2">Save your recovery codes</h2>
      <p class="font-body text-sm text-muted-foreground mb-6">
        Each code can be used once to sign in if you lose access to your account.
      </p>

      <div class="bg-surface-container-low rounded-xl p-4 mb-6 font-mono text-sm text-on-surface space-y-2">
        {#each codes as code}
          <div class="flex items-center justify-between">
            <span>{code}</span>
            <span class="text-blush text-xs font-medium">unused</span>
          </div>
        {/each}
      </div>

      <div class="flex flex-col gap-3">
        <button onclick={copyCodes}
                class="w-full bg-surface-container-low text-on-surface py-3 rounded-2xl font-semibold
                       transition-all duration-200 hover:bg-muted cursor-pointer">
          Copy codes
        </button>
        <button onclick={handleDone}
                class="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary
                       py-3 rounded-2xl font-semibold
                       transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                       cursor-pointer">
          I've saved them, let's go
        </button>
      </div>
    </div>
  </div>
{/if}

