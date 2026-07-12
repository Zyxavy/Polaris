<script lang="ts">
    import { createSystem, patchSystem, confirmSystem } from '$lib/api/systems';
    import { ApiError } from '$lib/api/client';
    import type { System } from '$lib/api/systems';
    import { AUTOSAVE_DEBOUNCE_MS } from './system-form.config';

    let { system: _system }: { system?: System | null } = $props();

    const initial = _system;
    let systemId = $state<string | null>(initial?.id ?? null);
    let name = $state(initial?.name ?? '');
    let domain = $state(initial?.domain ?? '');
    let purpose = $state(initial?.purpose ?? '');
    let philosophy = $state(initial?.philosophy ?? '');
    let protocol = $state(initial?.protocol ?? '');
    let floor_action = $state(initial?.floor_action ?? '');
    let trigger = $state(initial?.trigger ?? '');
    let barrier_list = $state<string[]>(initial?.barrier_list ?? []);
    let barrierInput = $state('');
    let environment_cue = $state(initial?.environment_cue ?? '');

    let confirmError = $state<string | null>(null);
    let saving = $state(false);
    let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleAutosave() {
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(doAutosave, AUTOSAVE_DEBOUNCE_MS);
    }

    async function doAutosave() {
        if (!name.trim()) return;
        saving = true;
        try {
            const payload: any = { name: name.trim() };
            if (domain !== (initial?.domain ?? '')) payload.domain = domain || null;
            if (purpose !== (initial?.purpose ?? '')) payload.purpose = purpose;
            if (philosophy !== (initial?.philosophy ?? '')) payload.philosophy = philosophy;
            if (protocol !== (initial?.protocol ?? '')) payload.protocol = protocol;
            if (floor_action !== (initial?.floor_action ?? '')) payload.floor_action = floor_action;
            if (trigger !== (initial?.trigger ?? '')) payload.trigger = trigger;
            if (JSON.stringify(barrier_list) !== JSON.stringify(initial?.barrier_list ?? [])) payload.barrier_list = barrier_list;
            if (environment_cue !== (initial?.environment_cue ?? '')) payload.environment_cue = environment_cue;

            if (!systemId) {
                const created = await createSystem(payload);
                systemId = created.id;
            } else {
                await patchSystem(systemId, payload);
            }
        } catch (e) {
            // autosave errors are silent
        } finally {
            saving = false;
        }
    }

    function addBarrier() {
        const trimmed = barrierInput.trim();
        if (trimmed && !barrier_list.includes(trimmed)) {
            barrier_list = [...barrier_list, trimmed];
            barrierInput = '';
            scheduleAutosave();
        }
    }

    function removeBarrier(index: number) {
        barrier_list = barrier_list.filter((_, i) => i !== index);
        scheduleAutosave();
    }

    async function handleConfirm() {
        if (!systemId) {
            // If confirm is clicked before first autosave completes, wait for id
            await doAutosave();
            if (!systemId) return;
        }

        confirmError = null;
        try {
            await confirmSystem(systemId);
        } catch(e) {
            if (e instanceof ApiError && e.code === 'floor_action_required') {
                confirmError = e.message;
            } else {
                throw e;
            }
        }
    }
</script>

<form class="flex flex-col gap-6 max-w-2xl" onsubmit={async (e) => { e.preventDefault(); await handleConfirm(); }}>
  <!-- Name* -->
  <div class="field-group">
    <label for="name" class="font-body text-sm font-medium text-on-surface">Name *</label>
    <input
      id="name"
      type="text"
      bind:value={name}
      oninput={scheduleAutosave}
      class="mt-1 block w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
      placeholder="e.g. Reading System"
      required
    />
  </div>

  <!-- Domain -->
  <div class="field-group">
    <label for="domain" class="font-body text-sm font-medium text-on-surface">Domain</label>
    <input
      id="domain"
      type="text"
      bind:value={domain}
      oninput={scheduleAutosave}
      class="mt-1 block w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
      placeholder="e.g. Study, Fitness, Writing"
    />
  </div>

  <!-- Purpose -->
  <div class="field-group">
    <label for="purpose" class="font-body text-sm font-medium text-on-surface">Purpose</label>
    <textarea
      id="purpose"
      bind:value={purpose}
      oninput={scheduleAutosave}
      class="mt-1 block w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
      rows="2"
      placeholder="Why does this system exist?"
    ></textarea>
  </div>

  <!-- Philosophy -->
  <div class="field-group">
    <label for="philosophy" class="font-body text-sm font-medium text-on-surface">Philosophy</label>
    <textarea
      id="philosophy"
      bind:value={philosophy}
      oninput={scheduleAutosave}
      class="mt-1 block w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
      rows="2"
      placeholder="What principles guide this system?"
    ></textarea>
  </div>

  <!-- Protocol -->
  <div class="field-group">
    <label for="protocol" class="font-body text-sm font-medium text-on-surface">Protocol</label>
    <textarea
      id="protocol"
      bind:value={protocol}
      oninput={scheduleAutosave}
      class="mt-1 block w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
      rows="2"
      placeholder="What are the steps or rules?"
    ></textarea>
  </div>

  <!-- Floor Action -->
  <div class="field-group">
    <label for="floor_action" class="font-body text-sm font-medium text-on-surface">Floor Action</label>
    <textarea
      id="floor_action"
      bind:value={floor_action}
      oninput={scheduleAutosave}
      class="mt-1 block w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
      rows="2"
      placeholder="The smallest version that still counts as a win."
    ></textarea>
    {#if confirmError}
      <p class="mt-1 text-sm text-destructive font-body">{confirmError}</p>
    {/if}
  </div>

  <!-- Trigger -->
  <div class="field-group">
    <label for="trigger" class="font-body text-sm font-medium text-on-surface">Trigger</label>
    <input
      id="trigger"
      type="text"
      bind:value={trigger}
      oninput={scheduleAutosave}
      class="mt-1 block w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
      placeholder="What starts this behavior?"
    />
  </div>

  <!-- Barrier List -->
  <div class="field-group">
    <p class="font-body text-sm font-medium text-on-surface">Barriers</p>
    <div class="flex flex-wrap gap-2 mt-1 mb-2">
      {#each barrier_list as barrier, i}
        <span class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-body text-primary">
          {barrier}
          <button type="button" onclick={() => removeBarrier(i)} class="hover:text-destructive">&times;</button>
        </span>
      {/each}
    </div>
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={barrierInput}
        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBarrier(); } }}
        class="block w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Add a barrier and press Enter"
      />
      <button type="button" onclick={addBarrier} class="rounded-md bg-primary px-3 py-2 text-sm font-body text-white">Add</button>
    </div>
  </div>

  <!-- Environment Cue -->
  <div class="field-group">
    <label for="environment_cue" class="font-body text-sm font-medium text-on-surface">Environment Cue</label>
    <input
      id="environment_cue"
      type="text"
      bind:value={environment_cue}
      oninput={scheduleAutosave}
      class="mt-1 block w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
      placeholder="e.g. Book on the nightstand, phone in the kitchen"
    />
  </div>

  <!-- Schedule (stub) -->
  <div class="field-group">
    <p class="font-body text-sm font-medium text-on-surface">Schedule</p>
    <p class="mt-1 text-sm font-body text-on-surface-muted">Schedule configuration coming in Slice 5.</p>
  </div>

  <!-- Confirm button -->
  <div class="flex items-center gap-3 pt-4 border-t border-border">
    <button
      type="submit"
      disabled={!name.trim()}
      class="rounded-md bg-primary px-4 py-2 text-sm font-body font-medium text-white disabled:opacity-50"
    >
      {saving ? 'Saving...' : 'Save System'}
    </button>
    {#if saving}
      <span class="text-xs text-on-surface-muted font-body">Autosaving...</span>
    {/if}
  </div>
</form>