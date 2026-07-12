import { expect, test } from '@playwright/test';

const email = `systems-e2e-${Date.now()}@test.com`;
const password = 'password123';

test('P0 flow #2: create system from scratch', async ({ page }) => {
    // Sign up
    await page.goto('/sign-up');
    await page.fill('#name', 'E2E User');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button:has-text("Create account")');

    // Skip recovery codes
    await expect(page.locator('text=Save your recovery codes')).toBeVisible({ timeout: 10000 });
    await page.click('text=I\'ve saved them');
    await expect(page).toHaveURL('/guides');

    // Navigate to Systems page
    await page.goto('/systems');
    await expect(page.locator('text=Create System')).toBeVisible();

    // Click "New System"
    await page.click('text=Create System');
    await expect(page).toHaveURL('/systems/new');

    // Fill required fields
    await page.fill('#name', 'Reading System');
    await page.fill('#domain', 'Study');
    await page.fill('#purpose', 'Read more books consistently');
    await page.fill('#floor_action', 'Open the book and read one paragraph');
    await page.fill('#trigger', 'After morning coffee');

    // Wait for autosave to complete
    await page.waitForTimeout(3000);

    // Click "Save System" to confirm
    await page.click('text=Save System');

    // Check confirm succeeded — no inline error appeared
    await expect(page.locator('text=Every system needs a floor action')).not.toBeVisible({ timeout: 3000 });

    // Verify system appears in Systems list
    await page.goto('/systems');
    await expect(page.locator('text=Reading System')).toBeVisible();
    await expect(page.locator('text=Study')).toBeVisible();
});