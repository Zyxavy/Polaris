<script lang="ts">
  import { page } from '$app/stores';
  import { authClient } from '$lib/auth-client';
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
  import Cog from '@lucide/svelte/icons/cog';
  import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import type { Component } from 'svelte';

  let { session }: { session: any } = $props();

  let active = $derived($page.url.pathname);

  interface NavItem {
    label: string;
    href: string;
    icon: Component;
  }

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Systems', href: '/systems', icon: Cog },
    { label: 'Review Day', href: '/review-day', icon: ClipboardCheck },
    { label: 'Guides', href: '/guides', icon: BookOpen },
  ];
</script>

<nav
  class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50
         h-14 px-6 flex items-center gap-6 sm:gap-8
         bg-surface/70 backdrop-blur-xl rounded-full
         shadow-ambient-lg transition-shadow duration-200"
>
  {#each navItems as item}
    <a
      href={item.href}
      class="flex items-center gap-1.5 font-body text-sm
             transition-colors duration-150
             {active.startsWith(item.href)
               ? 'text-primary font-semibold'
               : 'text-muted-foreground hover:text-on-surface'}"
      aria-current={active.startsWith(item.href) ? 'page' : undefined}
    >
      <item.icon class="w-4 h-4" />
      <span class="hidden sm:inline">{item.label}</span>
    </a>
  {/each}
</nav>

<aside
  class="hidden xl:flex fixed left-0 top-0 h-screen w-48
         bg-surface-container-low flex-col justify-between p-6 z-40"
>
  <div class="flex flex-col gap-1">
    <span class="font-display font-semibold text-primary text-lg mb-6">Polaris</span>
    {#each navItems as item}
      <a
        href={item.href}
        class="flex items-center gap-2 px-3 py-2 rounded-lg font-body text-sm
               transition-colors duration-150
               {active.startsWith(item.href)
                 ? 'bg-primary/10 text-primary font-semibold'
                 : 'text-muted-foreground hover:text-on-surface hover:bg-muted'}"
        aria-current={active.startsWith(item.href) ? 'page' : undefined}
      >
        <item.icon class="w-4 h-4" />
        {item.label}
      </a>
    {/each}
  </div>

  <div class="flex flex-col gap-2 border-t border-border/50 pt-4">
    <span class="font-body text-xs text-muted-foreground truncate">{session?.user?.email}</span>
    <button
      onclick={async () => { await authClient.signOut(); window.location.href = '/'; }}
      class="text-left text-sm text-destructive hover:underline font-body cursor-pointer"
    >
      Sign out
    </button>
  </div>
</aside>
