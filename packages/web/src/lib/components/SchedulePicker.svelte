<script lang="ts">
    import { getSchedules, createSchedule, patchSchedule, deleteSchedule } from '$lib/api/schedules';
    import { ApiError } from '$lib/api/client';
    import type { Schedule } from '$lib/api/schedules';

    let { systemId }: { systemId: string | null } = $props();

    let schedules = $state<Schedule[]>([]);

    let showForm = $state(false);
    let editingId = $state<string | null>(null);
    let selectedDays = $state<number[]>([]);
    let startTime = $state('');
    let endTime = $state('');
    let saving = $state(false);
    let formError = $state<string | null>(null);

    const DAY_LABELS = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];

    $effect(() => {
        if (systemId) loadSchedules();
    });

    async function loadSchedules() {
        if (!systemId) return;
        try {
            const res = await getSchedules(systemId);
            schedules = res.schedules;
        } catch {
            //silent
        }
    }

    function toggleDay(day: number) {
        if (selectedDays.includes(day)) {
            selectedDays = selectedDays.filter(d => d !== day);
        } else {
            selectedDays = [...selectedDays, day];
        }
    }

    function openAddForm() {
        editingId = null;
        selectedDays = [];
        startTime = '';
        endTime = '';
        formError = null;
        showForm = true;
    }

    function openEditForm(schedule: Schedule) {
        editingId = schedule.id;
        selectedDays = [];
        for (let i = 0; i < 7; i++) {
            if(schedule.days_of_week & (1 << i)) selectedDays.push(i);
        }
        startTime = schedule.time_window_start;
        endTime = schedule.time_window_end;
        formError = null;
        showForm = true;
    }

    function cancelForm() {
        showForm = false;
        editingId = null;
    }

    async function handleSave() {
        if (selectedDays.length === 0) {
            formError = 'Select at least one day.';
            return;
        }
        if (!startTime || !endTime) {
            formError = 'Enter start and end time.';
            return;
        }
        if (endTime <= startTime) {
            formError = 'End time must be after start time.';
            return;
        }

        saving = true;
        formError = null;
        const days_of_week = selectedDays.reduce((mask, d) => mask | (1 << d), 0);
        try {
            if (editingId) {
                const updated = await patchSchedule(editingId, {
                    days_of_week,
                    time_window_start: startTime,
                    time_window_end: endTime,
                });
                schedules = schedules.map(s => s.id === editingId ? updated : s);
            } else if (systemId) {
                const created = await createSchedule(systemId, {
                    days_of_week,
                    time_window_start: startTime,
                    time_window_end: endTime,
                });
                schedules = [...schedules, created];
            }
            showForm = false;
            editingId = null;
        } catch (e) {
            if (e instanceof ApiError) {
                formError = e.message;
            }
        } finally {
            saving = false;
        }
    }

    async function handleDelete(id: string) {
        try {
            await deleteSchedule(id);
            schedules = schedules.filter(s => s.id !== id);
        } catch {
            // silent
        }
    }

</script>

<div class="field-group">
    <p class="font-body text-sm font-medium text-on-surface">Schedule</p>

    {#if !systemId}
        <p class="mt-1 text-sm font-body text-on-surface-muted">Save the system first to configure schedules.</p>
    {:else}
        {#each schedules as schedule (schedule.id)}
            <div class="flex items-center gap-2 mt-2 p-2 rounded-md border border-border bg-surface/50">
                <div class="flex gap-1">
                    {#each DAY_LABELS as label, i}
                        <span
                            class="w-7 h-7 flex items-center justify-center rounded-full text-xs font-body
                            {schedule.days_of_week & (1 << i) ? 'bg-primary text-white' : 'bg-surface text-on-surface-muted'}"
                        >
                            {label}
                        </span>
                    {/each}
                </div>
                <span class="text-sm font-body text-on-surface flex-1">
                    {schedule.time_window_start} – {schedule.time_window_end}
                </span>
                <button
                    type="button"
                    onclick={() => openEditForm(schedule)}
                    class="text-xs font-body text-primary hover:underline"
                >
                    Edit
                </button>
                <button
                    type="button"
                    onclick={() => handleDelete(schedule.id)}
                    class="text-xs font-body text-destructive hover:underline"
                >
                    Delete
                </button>
            </div>
        {/each}

        {#if showForm}
            <div class="mt-3 p-3 rounded-md border border-border">
                <div class="flex gap-1 mb-3">
                    {#each DAY_LABELS as label, i}
                        <button
                            type="button"
                            onclick={() => toggleDay(i)}
                            class="w-8 h-8 rounded-full text-xs font-body
                            {selectedDays.includes(i) ? 'bg-primary text-white' : 'bg-surface text-on-surface border border-border'}"
                        >
                            {label}
                        </button>
                    {/each}
                </div>
                <div class="flex gap-3 items-center">
                    <input
                        type="time"
                        bind:value={startTime}
                        class="block rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span class="text-on-surface-muted text-sm font-body">to</span>
                    <input
                        type="time"
                        bind:value={endTime}
                        class="block rounded-md border-border bg-surface text-on-surface px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                {#if formError}
                    <p class="mt-1 text-xs text-destructive font-body">{formError}</p>
                {/if}
                <div class="flex gap-2 mt-3">
                    <button
                        type="button"
                        onclick={handleSave}
                        disabled={saving}
                        class="rounded-md bg-primary px-3 py-1 text-xs font-body text-white disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
                    </button>
                    <button
                        type="button"
                        onclick={cancelForm}
                        class="rounded-md border border-border px-3 py-1 text-xs font-body text-on-surface"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        {:else}
            <button
                type="button"
                onclick={openAddForm}
                class="mt-2 rounded-md border border-border px-3 py-1 text-xs font-body text-on-surface hover:bg-surface"
            >
                + Add Schedule
            </button>
        {/if}
    {/if}
</div>