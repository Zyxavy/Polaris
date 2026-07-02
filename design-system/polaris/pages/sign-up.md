# Sign Up — Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

Same centered auth-shell as Sign In. The form adds a name field and a "recovery codes" display section that appears after successful sign-up.

```svelte
<div class="min-h-screen flex items-center justify-center px-4 bg-surface">
  <div class="w-full max-w-sm flex flex-col items-center gap-8">

    <!-- Logo -->
    <a href="/" class="flex items-center gap-2 font-display text-2xl font-semibold text-primary">
      <span class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary text-sm font-bold">P</span>
      Polaris
    </a>

    <!-- Form card -->
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
                        focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                 placeholder="At least 8 characters" />
        </div>

        <button type="submit"
                class="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary
                       py-3 rounded-2xl font-semibold
                       transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                       cursor-pointer">
          Create account
        </button>
      </form>
    </div>

    <!-- Footer link -->
    <p class="font-body text-sm text-muted-foreground">
      Already have an account?
      <a href="/sign-in" class="text-primary hover:underline font-medium">Sign in</a>
    </p>
  </div>
</div>
```

## Recovery Codes Display

After successful sign-up, show the recovery codes before redirecting to `/guides`. This modal follows the MASTER.md modal spec with blush highlights.

```svelle
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
        I've saved them — let's go
      </button>
    </div>
  </div>
</div>
```

## Visual Tone for Sign Up

- Same centered form pattern as Sign In — visual consistency across auth pages
- Name field is first (personal, warm) before email/password (transactional)
- Password field uses a muted hint ("At least 8 characters") — no aggressive validation on blur
- Recovery codes use a blush accent on the "unused" label — a small high-emotion moment for account creation
- Sign-up success navigates to `/guides` per the navigation model (S9)
- The "I've saved them" button uses the gradient CTA — this is an important confirmation step