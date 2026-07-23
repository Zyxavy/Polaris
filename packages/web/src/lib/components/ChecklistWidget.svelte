<script lang="ts">
    import { putChecklist, getChecklist } from '$lib/api/checklist';
    import type { ChecklistStep } from '$lib/api/checklist';
    import type { Widget } from '$lib/api/workspaces';

    let { widget, instanceId }: { widget: Widget; instanceId: string | null } = $props();

    let steps = $state<ChecklistStep[]>([]);
    let loaded = $state(false);
    let saving = $state(false);

    $effect(() => {
        if (instanceId) loadChecklist();
    });

    async function loadChecklist() {
        try {
            const res = await getChecklist(instanceId!, widget.id);
            steps = res.steps;
        } catch {
            // network error — show empty state
        } finally {
            loaded = true;
        }
    }

    async function toggleStep(index: number) {
        if (!instanceId || saving) return;
        const newSteps = steps.map((s, i) => i === index ? { ...s, checked: !s.checked } : s);
        steps = newSteps;
        saving = true;
        try {
            await putChecklist(instanceId, widget.id, newSteps);
        } catch {
            steps = steps.map((s, i) => i === index ? { ...s, checked: !s.checked } : s);
        } finally {
            saving = false;
        }
    }
</script>

{#if !instanceId}
    <p class="text-sm text-muted-foreground text-center py-4">No instance for today</p>
{:else if !loaded}
    <p class="text-sm text-muted-foreground text-center py-4">Loading...</p>
{:else if steps.length === 0}
    <div class="flex flex-col items-center gap-2 py-4">
        <p class="text-xs text-muted-foreground">No checklist items</p>
        <p class="text-xs text-muted-foreground">Configure steps in the widget settings</p>
    </div>
{:else}
    <div class="flex flex-col gap-1 py-1">
        {#each steps as step, i}
            <label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container-low cursor-pointer">
                <input
                    type="checkbox"
                    checked={step.checked}
                    onchange={() => toggleStep(i)}
                    disabled={saving}
                    class="accent-primary w-4 h-4 rounded cursor-pointer"
                />
                <span class="text-sm font-body text-on-surface {step.checked ? 'line-through text-muted-foreground' : ''}">
                    {step.label}
                </span>
            </label>
        {/each}
    </div>
{/if}