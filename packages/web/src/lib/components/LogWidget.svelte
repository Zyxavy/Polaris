<script lang="ts">
    import type { Widget } from '$lib/api/workspaces';
    import { postJournalEntry, getJournalEntries, type JournalEntryResult } from '$lib/api/journal-log';
    import { ApiError } from '$lib/api/client';
    import { Send } from '@lucide/svelte';

    let {widget, instanceId}: {widget: Widget; instanceId: string | null } = $props();

    let entries = $state<JournalEntryResult[]>([]);
    let text = $state('');
    let loaded = $state(false);
    let saving = $state(false);
    let nextCursor = $state<string | null>(null);
    let loadError = $state<string | null>(null);
    let loadingMore = $state(false);
    
    $effect(() => {
        if (instanceId) {
            loadEntries();
        } else {
            entries = [];
            loaded = false;
            nextCursor = null;
        }
    });

    async function loadEntries() {
        loaded = false;
        loadError = null;
        try {
            const res = await getJournalEntries(instanceId!, widget.id);
            entries = res.entries;
            nextCursor = res.next_cursor;
        } catch (e) {
            if (e instanceof ApiError && e.status === 404) {
                entries = [];
            } else {
                loadError = 'Failed to load journal entries.';
            }
        } finally {
            loaded = true;
        }
    }

    async function loadMore() {
        if (!nextCursor || loadingMore) return;
        loadingMore = true;
        try {
            const res = await getJournalEntries(instanceId!, widget.id, nextCursor);
            entries = [...entries, ...res.entries];
            nextCursor = res.next_cursor;
        } catch {
            // silently fail on load-more
        } finally {
            loadingMore = false;
        }
    }

    async function submit() {
        const content = text.trim();
        if (!content || saving || !instanceId) return;

        saving = true;
        const optimistic: JournalEntryResult = {
            entry_id: 'pending',
            text: content,
            created_at: new Date().toISOString(),
        };
        entries = [optimistic, ...entries];
        text = '';

        try {
            const result = await postJournalEntry(instanceId, widget.id, content);
            entries = entries.map(e =>
                e.entry_id === 'pending'
                    ? { entry_id: result.entry_id, text: content, created_at: result.created_at }
                    : e
            );
        } catch {
            entries = entries.filter(e => e.entry_id !== 'pending');
        } finally {
            saving = false;
        }
    }

    function formatTime(iso: string): string {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(iso: string): string {
        const d = new Date(iso);
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
</script>

{#if !instanceId}
    <div class="flex-1 flex items-center justify-center">
        <p class="text-xs text-muted-foreground">No instance for today</p>
    </div>
{:else if !loaded}
    <div class="flex-1 flex items-center justify-center">
        <p class="text-xs text-muted-foreground">Loading...</p>
    </div>
{:else}
    <div class="flex flex-col h-full gap-2">
        <!-- Input area -->
        <form onsubmit={submit} class="flex gap-2 items-start">
            <textarea
                bind:value={text}
                disabled={saving}
                placeholder="Write your journal entry..."
                class="flex-1 resize-none rounded-lg bg-surface-container-lowest px-3 py-2 text-sm outline-none
                       ring-1 ring-inset ring-outline focus:ring-2 focus:ring-primary
                       placeholder:text-muted-foreground disabled:opacity-50 min-h-[60px]"
                onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            ></textarea>
            <button
                type="submit"
                disabled={!text.trim() || saving}
                class="shrink-0 rounded-lg bg-primary p-2 text-on-primary hover:bg-primary/90
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <Send class="w-4 h-4" />
            </button>
        </form>

        <!-- Error message -->
        {#if loadError}
            <p class="text-xs text-error">{loadError}</p>
        {/if}

        <!-- Entry list -->
        <div class="flex-1 overflow-y-auto flex flex-col gap-1.5">
            {#if entries.length === 0}
                <p class="text-xs text-muted-foreground text-center mt-4">No journal entries yet</p>
            {:else}
                {#each entries as entry (entry.entry_id)}
                    <div class="rounded-lg bg-surface-container-lowest px-3 py-2">
                        <p class="text-sm text-on-surface whitespace-pre-wrap break-words">{entry.text}</p>
                        <p class="text-[10px] text-muted-foreground mt-1">
                            {formatDate(entry.created_at)} at {formatTime(entry.created_at)}
                        </p>
                    </div>
                {/each}
            {/if}

            {#if nextCursor}
                <button
                    onclick={loadMore}
                    disabled={loadingMore}
                    class="text-xs text-primary hover:underline disabled:opacity-40 self-center"
                >
                    {loadingMore ? 'Loading...' : 'Load more'}
                </button>
            {/if}
        </div>
    </div>
{/if}