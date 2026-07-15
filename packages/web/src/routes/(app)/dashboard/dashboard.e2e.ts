import { expect, test } from '@playwright/test';

const email = `dashboard-e2e-${Date.now()}@test.com`;
const password = 'password123';

test('P0 flow #4: daily execution — mark instances on dashboard', async ({ page }) => {
    await page.goto('/sign-up');
    await page.fill('#name', 'E2E User');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button:has-text("Create account")');
    await expect(page.locator('text=Save your recovery codes')).toBeVisible({ timeout: 10000 });
    await page.click('text=I\'ve saved them');
    await expect(page).toHaveURL('/guides');

    const resA = await page.request.post('http://localhost:8787/api/systems', {
        data: { name: 'Morning Journal', domain: 'journal', floor_action: 'Write 3 things', trigger: 'After coffee' },
    });
    expect(resA.status()).toBe(201);
    const systemA = await resA.json();

    await page.request.post(`http://localhost:8787/api/systems/${systemA.id}/schedules`, {
        data: { days_of_week: 127, time_window_start: '00:00', time_window_end: '23:59' },
    });

    const resB = await page.request.post('http://localhost:8787/api/systems', {
        data: { name: 'Reading System', domain: 'study', floor_action: 'Read one page', trigger: 'After lunch' },
    });
    expect(resB.status()).toBe(201);
    const systemB = await resB.json();

    await page.request.post(`http://localhost:8787/api/systems/${systemB.id}/schedules`, {
        data: { days_of_week: 127, time_window_start: '00:00', time_window_end: '23:59' },
    });

    await page.goto('/dashboard');
    await expect(page.locator('text=Morning Journal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Reading System')).toBeVisible();

    const journalCard = page.locator('text=Morning Journal').locator('..');
    await journalCard.locator('button:has-text("Full")').click();
    await expect(journalCard.locator('button:has-text("Full")')).toBeDisabled();
    expect(page.url()).toContain('/dashboard');

    const readingCard = page.locator('text=Reading System').locator('..');
    await readingCard.locator('button:has-text("Floor")').click();
    await expect(readingCard.locator('button:has-text("Floor")')).toBeDisabled();
});
