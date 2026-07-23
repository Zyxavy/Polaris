<script lang="ts">
    import { Settings, Play, Square } from '@lucide/svelte';
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
    let showSettings = $state(false);
    let durationSecs = $state((() => widget.config?.duration_secs ?? 0)());
    let isCountdown = $derived(durationSecs > 0);
    let display = $derived(isCountdown ? Math.max(0, durationSecs - elapsed) : elapsed);
    let isFinished = $derived(isCountdown && durationSecs > 0 && elapsed >= durationSecs);

    function playBeep() {
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
            setTimeout(() => ctx.close(), 1000);
        } catch { /* audio not available */ }
    }

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
        if (isFinished) elapsed = 0;
        timerState = 'running';
        startedAt = new Date().toISOString();
        intervalId = setInterval(() => {
            elapsed++;
            if (isCountdown && elapsed >= durationSecs) {
                clearInterval(intervalId!);
                intervalId = null;
                timerState = 'saving';
                playBeep();
                saveSession();
            }
        }, 1000);
    }

    function stopTimer() {
        if (!instanceId || !startedAt || timerState !== 'running') return;
        timerState = 'saving';
        if (intervalId) clearInterval(intervalId);
        saveSession();
    }

    async function saveSession() {
        if (!instanceId) return;
        const endedAt = new Date().toISOString();
        try {
            await createTimerSession(instanceId, {
                widget_id: widget.id,
                duration_secs: isCountdown ? Math.min(elapsed, durationSecs) : elapsed,
                started_at: startedAt!,
                ended_at: endedAt,
            });
            todayTotal += isCountdown ? Math.min(elapsed, durationSecs) : elapsed;
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

<div class="flex flex-col items-center gap-2 py-2 relative">
    {#if showSettings}
        <div class="flex items-center gap-2 bg-surface-container-low px-3 py-2 rounded-xl w-full">
            <span class="text-xs text-muted-foreground shrink-0">Duration:</span>
            <input
                type="number"
                min="0"
                step="30"
                bind:value={durationSecs}
                onchange={() => { if (durationSecs < 0) durationSecs = 0; }}
                disabled={timerState !== 'idle'}
                class="w-20 text-sm text-center bg-surface-container-lowest rounded-lg px-2 py-1 outline-none ring-1 ring-inset ring-outline focus:ring-2 focus:ring-primary disabled:opacity-40"
            />
            <span class="text-xs text-muted-foreground">sec (0 = stopwatch)</span>
            <button
                onclick={() => showSettings = false}
                class="ml-auto text-xs text-primary hover:underline cursor-pointer bg-transparent border-none"
            >Done</button>
        </div>
    {/if}

    {#if !instanceId}
        <p class="text-sm text-muted-foreground text-center py-2">No instance for today</p>
    {:else}
        <div class="flex items-center gap-2">
            <span class="text-3xl font-display font-bold font-mono text-on-surface">
                {formatDuration(display)}
            </span>
            <button
                onclick={() => showSettings = !showSettings}
                disabled={timerState !== 'idle'}
                class="text-muted-foreground hover:text-on-surface transition-colors cursor-pointer disabled:opacity-30 p-1 rounded bg-transparent border-none"
                aria-label="Timer settings"
            >
                <Settings class="w-4 h-4" />
            </button>
        </div>
        {#if timerState === 'idle'}
            <button
                onclick={startTimer}
                class="bg-gradient-to-br from-primary to-primary-container text-on-primary
                       px-6 py-2 rounded-2xl font-semibold text-sm cursor-pointer
                       hover:opacity-90 active:scale-[0.98] transition-all duration-200 flex items-center gap-2"
            >
                <Play class="w-4 h-4" />
                {isCountdown ? 'Start' : 'Start'}
            </button>
        {:else if timerState === 'running'}
            <button
                onclick={stopTimer}
                class="bg-gradient-to-br from-destructive to-destructive/80 text-white
                       px-6 py-2 rounded-2xl font-semibold text-sm cursor-pointer
                       hover:opacity-90 active:scale-[0.98] transition-all duration-200 flex items-center gap-2"
            >
                <Square class="w-4 h-4" />
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
    {/if}
</div>
