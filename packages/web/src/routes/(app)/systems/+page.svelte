<script lang="ts">
  import { goto } from '$app/navigation';

  let { data } = $props();

  let ready = $state(false);
  let loadError = $state(false);
  let systems: any[] = $state([]);
  let next_cursor: string | null = $state(null);
  let todayMap: Record<string, any> = $state({});

  $effect(() => {
    if (data) {
      ready = true;
      if (data.systems) {
        systems = data.systems;
        next_cursor = data.next_cursor;
        todayMap = data.todayMap ?? {};
      } else {
        loadError = true;
      }
    }
  });
</script>

{#if !ready}
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between mb-2">
      <div class="skeleton h-8 w-32 rounded-xl"></div>
      <div class="skeleton h-10 w-36 rounded-xl"></div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each Array(4) as _}
        <div class="skeleton h-[120px] rounded-xl"></div>
      {/each}
    </div>
  </div>
{:else if loadError}
  <div class="flex flex-col items-center justify-center py-20 gap-4">
    <div class="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
      <span class="text-xl font-bold">!</span>
    </div>
    <h2 class="font-body text-lg font-semibold text-on-surface">Couldn't load systems</h2>
    <p class="font-body text-sm text-muted-foreground text-center max-w-sm">Something went wrong. Try again.</p>
    <button
      onclick={() => location.reload()}
      class="bg-gradient-to-br from-primary to-primary-container text-on-primary
             px-5 py-2.5 rounded-2xl font-semibold text-sm mt-2 cursor-pointer"
    >
      Try again
    </button>
  </div>
{:else}
  <div class="max-w-6xl">
    <div class="flex items-center justify-between mb-6">
      <h1 class="font-display text-2xl md:text-3xl text-on-surface">Systems</h1>
      <a
        href="/systems/new"
        class="rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary
               px-5 py-2.5 text-sm font-body font-semibold
               transition-all duration-200 hover:opacity-90 active:scale-[0.98]
               cursor-pointer"
      >
        Create System
      </a>
    </div>

    {#if systems.length === 0}
      <div class="bg-surface-container-low rounded-xl p-10 text-center">
        <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <span class="text-2xl">+</span>
        </div>
        <h2 class="font-body text-lg font-semibold text-on-surface mb-2">No systems yet</h2>
        <p class="font-body text-sm text-muted-foreground max-w-sm mx-auto mb-6">
          Design your first system to get started.
        </p>
        <a
          href="/systems/new"
          class="inline-block bg-gradient-to-br from-primary to-primary-container text-on-primary
                 px-5 py-2.5 rounded-2xl font-semibold text-sm
                 transition-all duration-200 hover:opacity-90 active:scale-[0.98]
                 cursor-pointer"
        >
          Create a system
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each systems as system (system.id)}
          <a
            href="/systems/{system.id}"
            class="block bg-surface-container-lowest rounded-xl p-4 md:p-5 lg:p-6
                   shadow-ambient-sm
                   transition-all duration-200
                   hover:shadow-ambient-md hover:bg-surface-container-lowest/80
                   cursor-pointer"
          >
            <div class="flex items-center justify-between mb-1">
              <h3 class="font-body font-semibold text-on-surface">{system.name}</h3>
              {#if todayMap[system.id]}
                <span class="inline-flex items-center gap-1.5">
                  <span
                    class="w-2 h-2 rounded-full
                      {todayMap[system.id].state === 'full' ? 'bg-blush' :
                       todayMap[system.id].state === 'floor' ? 'bg-secondary' :
                       todayMap[system.id].state === 'missed' ? 'bg-muted' : 'bg-surface-container-low'}"
                  ></span>
                  <span class="text-xs font-body text-muted-foreground capitalize">
                    {todayMap[system.id].state}
                  </span>
                </span>
              {/if}
            </div>
            {#if system.domain}
              <p class="text-sm text-muted-foreground font-body">{system.domain}</p>
            {/if}
            {#if system.floor_action}
              <p class="text-xs text-muted-foreground font-body mt-1.5 line-clamp-1">{system.floor_action}</p>
            {/if}
          </a>
        {/each}
      </div>

      {#if next_cursor}
        <p class="mt-6 text-sm text-muted-foreground font-body text-center">(Pagination coming in a future slice)</p>
      {/if}
    {/if}
  </div>
{/if}
