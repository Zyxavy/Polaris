<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';

    let { error } = $props();
</script>

<div class="flex flex-col items-center justify-center min-h-dvh px-6 bg-background">
    <div class="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
        <span class="text-2xl font-bold">!</span>
    </div>
    <h1 class="font-display text-xl font-semibold text-on-surface mb-2">
        {$page.status === 404 ? 'Not found' : 'Something went wrong'}
    </h1>
    <p class="font-body text-sm text-muted-foreground text-center max-w-sm mb-6">
        {error?.message ?? 'An unexpected error occurred.'}
    </p>
    <div class="flex gap-3">
        <button
            onclick={() => goto('/dashboard')}
            class="rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary px-5 py-2.5 text-sm font-body font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98] cursor-pointer"
        >
            Go to Dashboard
        </button>
        <button
            onclick={() => location.reload()}
            class="rounded-xl border border-border px-5 py-2.5 text-sm font-body text-on-surface hover:bg-surface/50 transition-colors cursor-pointer"
        >
            Try again
        </button>
    </div>
</div>
