import { expect, test } from '@playwright/test';

const email = `reviews-e2e-${Date.now()}@test.com`;
const password = 'password123';

test('P0 flow #6: weekly review updates floor_action', async ({ page }) => {
    // 1. Sign up
    await page.goto('/sign-up');
    await page.fill('#name', 'E2E User');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button:has-text("Create account")');
    await expect(page.locator('text=Save your recovery codes')).toBeVisible({ timeout: 10000 });
    await page.click('text=I\'ve saved them');
    await expect(page).toHaveURL('/guides');

    // 2. Create a system with a schedule via API (faster than UI)
    const res = await page.request.post('http://localhost:8787/api/systems', {
        data: {
            name: 'Weekly Review Test',
            domain: 'test',
            floor_action: 'Original floor action',
            trigger: 'Test trigger',
        },
    });
    expect(res.status()).toBe(201);
    const system = await res.json();

    await page.request.post(`http://localhost:8787/api/systems/${system.id}/schedules`, {
        data: { days_of_week: 127, time_window_start: '00:00', time_window_end: '23:59' },
    });

    // 3. Navigate to the review form
    await page.goto(`/systems/${system.id}/reviews/new`);
    await expect(page.locator('text=Weekly Review Test')).toBeVisible();

    // 4. Fill reflection fields
    await page.fill('textarea[name="what_worked"]', 'Completed all tasks every day');
    await page.fill('textarea[name="what_broke"]', 'Almost skipped Tuesday');

    // 5. Toggle worst_day_check
    await page.locator('input[type="checkbox"]').click();

    // 6. Edit the floor_action in the blueprint section
    const floorActionTextarea = page.locator('textarea[name="floor_action"]');
    await floorActionTextarea.fill('');
    await floorActionTextarea.fill('New floor action from review');

    // 7. Submit the review
    await page.click('button:has-text("Submit Review")');

    // 8. Verify redirect to review history page
    await expect(page).toHaveURL(`/systems/${system.id}/reviews`);

    // 9. Verify system's floor_action was updated by re-fetching via API
    const updatedRes = await page.request.get(`http://localhost:8787/api/systems/${system.id}`);
    const updatedSystem = await updatedRes.json();
    expect(updatedSystem.floor_action).toBe('New floor action from review');
});