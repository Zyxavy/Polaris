import { expect, test } from '@playwright/test';

const email = `workspace-e2e-${Date.now()}@test.com`;
const password = 'password123';

test('P0 flow #5: workspace widget CRUD: add, save, reload, persist', async ({ page }) => {
    // Sign up
    await page.goto('/sign-up');
    await page.fill('#name', 'E2E User');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button:has-text("Create account")');
    await expect(page.locator('text=Save your recovery codes')).toBeVisible({ timeout: 10000 });
    await page.click('text=I\'ve saved them');
    await expect(page).toHaveURL('/guides');

    // Create a system via API
    const res = await page.request.post('http://localhost:8787/api/systems', {
        data: { name: 'Workspace Test System', domain: 'health', floor_action: 'Do the thing' },
    });
    expect(res.status()).toBe(201);
    const system = await res.json();

    // Navigate directly to workspace page
    await page.goto(`/systems/${system.id}/workspace`);
    await expect(page.getByRole('heading', { name: 'Widgets' })).toBeVisible({ timeout: 10000 });

    // Canvas should be empty initially
    await expect(page.getByText('Drag widgets from the palette to build your workspace')).toBeVisible();

    // Add a Timer widget by clicking its palette entry
    await page.locator('aside button:has-text("Timer")').click();
    await expect(page.locator('h4:has-text("Timer")')).toBeVisible();

    // Add a Counter widget
    await page.locator('aside button:has-text("Counter")').click();
    await expect(page.locator('h4:has-text("Counter")')).toBeVisible();

    // Both widgets should be on the canvas
    const widgetHeaders = page.locator('h4');
    await expect(widgetHeaders.filter({ hasText: 'Timer' })).toHaveCount(1);
    await expect(widgetHeaders.filter({ hasText: 'Counter' })).toHaveCount(1);

    // Save layout
    await page.click('button:has-text("Save layout")');
    // Save button should become disabled after save
    await expect(page.locator('button:has-text("Save layout")')).toBeDisabled();

    // Reload the page
    await page.goto(`/systems/${system.id}/workspace`);
    await expect(page.locator('text=Widgets')).toBeVisible({ timeout: 10000 });

    // Widgets should still be present after reload
    await expect(page.locator('h4:has-text("Timer")')).toBeVisible();
    await expect(page.locator('h4:has-text("Counter")')).toBeVisible();
    await expect(page.locator('h4:has-text("Timer")')).toHaveCount(1);
    await expect(page.locator('h4:has-text("Counter")')).toHaveCount(1);
});
