<script lang="ts">
    import { createTimerSession, getTimerSessions } from '$lib/api/timer-sessions';
    import { ApiError } from '$lib/api/client';
    import type { Widget } from '$lib/api/workspaces';

    let { widget, instanceId }: { widget: Widget; instanceId: string | null } = $props();

    type TimerState = 'idle' | 'running' | 'saving';
    let timerState = $state<TimerState>('idle');
    let elapsed = $state(0);
    let startedAt = $state<string | null>(null);
    let todayTotal = $state(0);
    let intervalId: ReturnType<typeof setInterval> | null = null;
    
    $effect(() => {
        if (instanceId) loadToday();
        return () => { if (intervalId) clearInterval(intervalId); };
    });

    async function loadToday() {
        const today = new Date().toISOString().slice(0, 10);
        try {
            const res = await getTimerSessions(widget.id, { from: today, to: today });
            todayTotal = res.timer_sessions.reduce((sum, s) => sum + s.duration_secs, 0);
        } catch { /* silent */ }
    }

    function startTimer() {
        timerState = 'running';
        startedAt = new Date().toISOString();
        elapsed = 0;
        intervalId = setInterval(() => { elapsed++; }, 1000);
    }

    async function stopTimer() {
        if (!instanceId || !startedAt || timerState !== 'running') return;
        timerState = 'saving';
        if (intervalId) clearInterval(intervalId);

        const endedAt = new Date().toISOString();
        try {
            await createTimerSession(instanceId, {
                widget_id: widget.id,
                duration_secs: elapsed,
                started_at: startedAt,
                ended_at: endedAt,
            });
            todayTotal += elapsed;
            timerState = 'idle';
            elapsed = 0;
            startedAt = null;
        } catch {
            timerState = 'running';
            intervalId = setInterval(() => { elapsed++; }, 1000);
        }
    }

    function formatDuration(secs: number): string {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

</script>

{#if !instanceId}
    <p class="text-sm text-muted-foreground text-center py-4">No instance for today</p>
{:else}
    <div class="flex flex-col items-center gap-3 py-2">
        <span class="text-3xl font-display font-bold font-mono text-on-surface">
            {formatDuration(elapsed)}
        </span>
        {#if timerState === 'idle'}
            <button
                onclick={startTimer}
                class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                       px-6 py-2 rounded-2xl font-semibold text-sm cursor-pointer
                       hover:opacity-90 active:scale-[0.98] transition-all duration-200"
            >
                Start
            </button>
        {:else if timerState === 'running'}
            <button
                onclick={stopTimer}
                class="bg-gradient-to-br from-destructive to-destructive/80 text-white
                       px-6 py-2 rounded-2xl font-semibold text-sm cursor-pointer
                       hover:opacity-90 active:scale-[0.98] transition-all duration-200"
            >
                Stop
            </button>
        {:else}
            <button disabled class="px-6 py-2 rounded-2xl font-semibold text-sm opacity-40 cursor-not-allowed">
                Saving...
            </button>
        {/if}
        <p class="text-xs text-muted-foreground">
            Today: {formatDuration(todayTotal)}
        </p>
    </div>
{/if}