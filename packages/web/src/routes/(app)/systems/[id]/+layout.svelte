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

    function isActive(tabPath: (id: string) => string) {
        return page.url.pathname === tabPath(system.id);
    }

</script>

<div class="max-w-4xl">
    <h1 class="font-display text-2xl text-on-surface mb-1">{system.name}</h1>
    {#if system.domain}
        <p class="font-body text-sm text-on-surface-muted mb-4">{system.domain}</p>
    {/if}

    <nav class="flex gap-4 border-b border-border mb-6">
        {#each tabs as tab}
        <button
            onclick={() => goto(tab.path(system.id))}
            class="pb-2 font-body text-sm {isActive(tab.path) ? 'text-primary border-b-2 border-primary' : 'text-on-surface-muted hover:text-on-surface'}"
        >
            {tab.label}
        </button>
        {/each}
    </nav>

    {@render children()}
    </div>