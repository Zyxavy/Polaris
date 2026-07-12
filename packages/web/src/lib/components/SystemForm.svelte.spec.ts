import { page } from 'vitest/browser';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SystemForm from './SystemForm.svelte';
import { AUTOSAVE_DEBOUNCE_MS } from './system-form.config';

vi.mock('$lib/api/systems', () => ({
    createSystem: vi.fn().mockResolvedValue({ id: 'sys_test123', name: 'My System' }),
    patchSystem: vi.fn().mockResolvedValue({ id: 'sys_test123', name: 'My System' }),
    confirmSystem: vi.fn().mockResolvedValue({ id: 'sys_test123' }),
}));

describe('SystemForm autosave', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('does not save immediately when user types', async () => {
        const { createSystem } = await import('$lib/api/systems');
        render(SystemForm);

        await page.getByPlaceholder('e.g. Reading System').fill('My System');

        expect(createSystem).not.toHaveBeenCalled();
    });

    it('auto-saves after debounce interval when name is filled', async () => {
        const { createSystem } = await import('$lib/api/systems');
        render(SystemForm);

        await page.getByPlaceholder('e.g. Reading System').fill('My System');
        await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 100);

        expect(createSystem).toHaveBeenCalledOnce();
        expect(createSystem).toHaveBeenCalledWith(expect.objectContaining({ name: 'My System' }));
    });

    it('calls patchSystem on second save after system id exists', async () => {
        const { createSystem, patchSystem } = await import('$lib/api/systems');
        render(SystemForm);

        await page.getByPlaceholder('e.g. Reading System').fill('My System');
        await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 100);

        await page.getByPlaceholder('e.g. Study, Fitness, Writing').fill('Study');
        await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 100);

        expect(patchSystem).toHaveBeenCalledWith(
        'sys_test123',
        expect.objectContaining({ domain: 'Study' })
        );
    });
});

describe('SystemForm validation', () => {
    it('submit button is disabled when name is empty', async () => {
        render(SystemForm);

        const button = page.getByRole('button', { name: /Save System/ });
        await expect.element(button).toBeDisabled();
    });

    it('submit button is enabled when name is filled', async () => {
        render(SystemForm);

        await page.getByPlaceholder('e.g. Reading System').fill('Reading System');

        const button = page.getByRole('button', { name: /Save System/ });
        await expect.element(button).toBeEnabled();
    });
});