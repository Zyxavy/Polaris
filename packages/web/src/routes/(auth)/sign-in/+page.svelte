<script lang="ts">
    import { goto } from '$app/navigation';
    import { authClient } from "$lib/auth-client";
    
    let email = $state('');
    let password = $state('');
    let error = $state('');

    async function handleSignIn(e: Event) {
        e.preventDefault();
        error = '';
        const { error: err} = await authClient.signIn.email({ email, password});
        if (err) {
            error = err.message || 'Invalid email or password.';
            return;
        }
        goto('/dashboard');
    }
</script>

<div class="min-h-screen flex items-center justify-center px-4 bg-surface">
  <div class="w-full max-w-sm flex flex-col items-center gap-8">
    <a href="/" class="flex items-center gap-2 font-display text-2xl font-semibold text-primary">
      <span class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary text-sm font-bold">P</span>
      Paragon
    </a>

    <div class="w-full bg-surface-container-lowest rounded-xl p-8 shadow-ambient-md">
      <h1 class="font-display text-xl font-semibold text-on-surface mb-6 text-center">Sign in</h1>

      <form class="flex flex-col gap-5" onsubmit={handleSignIn}>
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
                 placeholder="••••••••" />
        </div>

        {#if error}
          <p class="text-destructive text-sm font-body">{error}</p>
        {/if}

        <button type="submit"
                class="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary
                       py-3 rounded-2xl font-semibold
                       transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                       cursor-pointer">
          Sign in
        </button>
      </form>
    </div>

    <p class="font-body text-sm text-muted-foreground">
      Don't have an account?
      <a href="/sign-up" class="text-primary hover:underline font-medium">Sign up</a>
    </p>
  </div>
</div>