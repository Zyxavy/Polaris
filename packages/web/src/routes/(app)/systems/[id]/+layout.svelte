<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/state';

    let { children, data } = $props();
    let system = $derived(data.system);

    const tabs = [
        { label: 'Overview', path: (id: string) => `/systems/${id}` },
        { label: 'Workspace', path: (id: string) => `/systems/${id}/workspace` },
        { label: 'Reviews', path: (id: string) => `/systems/${id}/reviews` },
        { label: 'Edit', path: (id: string) => `/systems/${id}/edit` },
    ];

    function tabFromUrl() {
        const path = page.url.pathname;
        if (path.endsWith('/workspace')) return 'workspace';
        if (path.includes('/reviews')) return 'reviews';
        if (path.endsWith('/edit')) return 'edit';
        return 'overview';
    }

    let activeTab = $derived(tabFromUrl());
</script>

<div class="w-full md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-0">
  <h1 class="font-display text-2xl text-on-surface mb-1">{system.name}</h1>
  {#if system.domain}
    <p class="font-body text-sm text-on-surface-muted mb-4">{system.domain}</p>
  {/if}

  <nav class="flex gap-6 overflow-x-auto border-b border-border/50 mb-6 pb-0">
    {#each tabs as tab}
      <button
        onclick={() => goto(tab.path(system.id))}
        class="pb-3 font-body text-sm whitespace-nowrap transition-colors duration-150
               {activeTab === tab.label.toLowerCase()
                 ? 'text-primary font-semibold'
                 : 'text-muted-foreground hover:text-on-surface'}"
      >
        {tab.label}
      </button>
    {/each}
  </nav>

  {@render children()}
</div>
