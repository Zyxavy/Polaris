<script lang="ts">
    import { createReview } from '$lib/api/reviews';
    import { ApiError } from '$lib/api/client';
    import { toastStore } from '$lib/stores/toast.svelte';
    import InstanceSummary from './InstanceSummary.svelte';
    import { goto } from '$app/navigation';

    let {
        systemId,
        system: initial,
        periodStart,
        periodEnd,
        instanceCounts,
    }: {
        systemId: string;
        system: {
            floor_action: string;
            purpose: string;
            philosophy: string;
            protocol: string;
            trigger: string;
            environment_cue: string;
        };
        periodStart: string;
        periodEnd: string;
        instanceCounts: { full: number; floor: number; missed: number };
    } = $props();

    let whatWorked = $state('');
    let whatBroke = $state('');
    let worstDayCheck = $state(false);
    let saving = $state(false);
    let conflictError = $state<string | null>(null);

    let floorAction = $state(initial.floor_action);
    let purpose = $state(initial.purpose);
    let philosophy = $state(initial.philosophy);
    let protocol = $state(initial.protocol);
    let trigger = $state(initial.trigger);
    let environmentCue = $state(initial.environment_cue);
    let changeNote = $state('');

    function buildChangeApplied(): Record<string, string> | null {
        const changes: Record<string, string> = {};
        if (floorAction !== initial.floor_action) changes.floor_action = floorAction;
        if (purpose !== initial.purpose) changes.purpose = purpose;
        if (philosophy !== initial.philosophy) changes.philosophy = philosophy;
        if (protocol !== initial.protocol) changes.protocol = protocol;
        if (trigger !== initial.trigger) changes.trigger = trigger;
        if (environmentCue !== initial.environment_cue) changes.environment_cue = environmentCue;
        return Object.keys(changes).length > 0 ? changes : null;
    }

    async function handleSubmit() {
        saving = true;
        conflictError = null;

        try {
            await createReview(systemId, {
                period_start: periodStart,
                period_end: periodEnd,
                what_worked: whatWorked,
                what_broke: whatBroke,
                worst_day_check: worstDayCheck,
                change_applied: buildChangeApplied(),
                change_applied_note: changeNote || null,
            });

            toastStore.push({ type: 'info', message: 'Review saved' });
            goto(`/systems/${systemId}/reviews`);
        } catch (e) {
            if (e instanceof ApiError && e.code === 'review_already_exists') {
                conflictError = 'A review already exists for this period.';
            } else {
                toastStore.push({ type: 'error', message: 'Could not save review.' });
            }
        } finally {
            saving = false;
        }
    }
</script>

<div class="flex flex-col gap-6 max-w-2xl">
    <InstanceSummary counts={instanceCounts} />

    {#if conflictError}
        <div class="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm font-body text-destructive">
            {conflictError}
        </div>
    {/if}

    <div class="flex flex-col gap-4">
        <h2 class="font-display text-lg text-on-surface">Reflection</h2>

        <div>
            <p class="font-body text-sm font-medium text-on-surface-muted">What worked</p>
            <textarea
                name="what_worked"
                bind:value={whatWorked}
                class="mt-1 w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
                rows="3"
            ></textarea>
        </div>

        <div>
            <p class="font-body text-sm font-medium text-on-surface-muted">What broke</p>
            <textarea
                name="what_broke"
                bind:value={whatBroke}
                class="mt-1 w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
                rows="3"
            ></textarea>
        </div>

        <label class="flex items-center gap-2 font-body text-sm text-on-surface cursor-pointer">
            <input type="checkbox" bind:checked={worstDayCheck} class="rounded border-border" />
            This was a worst day
        </label>
    </div>

    <div class="flex flex-col gap-4 border-t border-border pt-4">
        <h2 class="font-display text-lg text-on-surface">Blueprint changes</h2>
        <p class="font-body text-sm text-on-surface-muted">
            Edit the fields below to update your system. Changed values will be written back.
        </p>

        <div>
            <p class="font-body text-sm font-medium text-on-surface-muted">Floor action</p>
            <textarea name="floor_action" bind:value={floorAction}
                class="mt-1 w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary" rows="2"></textarea>
        </div>

        <div>
            <p class="font-body text-sm font-medium text-on-surface-muted">Purpose</p>
            <textarea name="purpose" bind:value={purpose}
                class="mt-1 w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary" rows="2"></textarea>
        </div>

        <div>
            <p class="font-body text-sm font-medium text-on-surface-muted">Philosophy</p>
            <textarea name="philosophy" bind:value={philosophy}
                class="mt-1 w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary" rows="2"></textarea>
        </div>

        <div>
            <p class="font-body text-sm font-medium text-on-surface-muted">Protocol</p>
            <textarea name="protocol" bind:value={protocol}
                class="mt-1 w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary" rows="2"></textarea>
        </div>

        <div>
            <p class="font-body text-sm font-medium text-on-surface-muted">Trigger</p>
            <textarea name="trigger" bind:value={trigger}
                class="mt-1 w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary" rows="2"></textarea>
        </div>

        <div>
            <p class="font-body text-sm font-medium text-on-surface-muted">Environment cue</p>
            <textarea name="environment_cue" bind:value={environmentCue}
                class="mt-1 w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary" rows="2"></textarea>
        </div>
    </div>

    <div class="flex flex-col gap-2 border-t border-border pt-4">
        <p class="font-body text-sm font-medium text-on-surface-muted">
            Change note <span class="text-on-surface-muted/60">(optional, overrides auto-description)</span>
        </p>
        <textarea
            name="change_applied_note"
            bind:value={changeNote}
            class="w-full rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
            rows="2"
            placeholder="e.g. I decided to lower my bar..."
        ></textarea>
    </div>

    <button
        onclick={handleSubmit}
        disabled={saving}
        class="self-start rounded-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-2 text-sm font-body font-semibold disabled:opacity-50
                       transition-all duration-200 hover:opacity-90 active:scale-[0.98] cursor-pointer"
    >
        {saving ? 'Saving...' : 'Submit Review'}
    </button>
</div>