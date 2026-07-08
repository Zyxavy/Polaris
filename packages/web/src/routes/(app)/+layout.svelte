<script lang="ts">
    let { children } = $props();
</script>

<nav class="h-14 border-b border-border bg-surface flex items-center px-6">
  <span class="font-display font-semibold text-primary">Polaris</span>
</nav>

<main>
  {@render children()}
</main>