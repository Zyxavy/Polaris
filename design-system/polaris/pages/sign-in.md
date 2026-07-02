# Sign In — Page Override

> Page-specific overrides for `design-system/polaris/MASTER.md`.
> Only deviations from the Master are listed here. Everything else follows the Master.

---

## Layout

Centered, minimal form layout. No nav shell. The `(auth)` route group wraps all auth pages in a `auth-shell` that redirects signed-in users to `/guides`.

```svelte
<div class="min-h-screen flex items-center justify-center px-4 bg-surface">
  <div class="w-full max-w-sm flex flex-col items-center gap-8">
    <!-- Logo / Brand -->
    <a href="/" class="flex items-center gap-2 font-display text-2xl font-semibold text-primary">
      <span class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary text-sm font-bold">P</span>
      Polaris
    </a>

    <!-- Form card -->
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

        <button type="submit"
                class="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary
                       py-3 rounded-2xl font-semibold
                       transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                       cursor-pointer">
          Sign in
        </button>
      </form>
    </div>

    <!-- Footer link -->
    <p class="font-body text-sm text-muted-foreground">
      Don't have an account?
      <a href="/sign-up" class="text-primary hover:underline font-medium">Sign up</a>
    </p>
  </div>
</div>
```

## Visual Tone for Auth Pages

- Centered column, max-w-sm — intentionally narrow to keep forms digestible
- Logo at top anchors the page, uses the sage primary color
- Form card is `surface-container-lowest` with ambient shadow — floats gently on the page background
- No decorative elements, no illustrations — the focus is the form
- Error states (invalid email, wrong password): inline validation below the field in destructive (`#C24545`) at `text-sm`
- Sign-in success navigates to `/dashboard`
- All transitions at 200ms — micro-interactions only, no page reveal animations