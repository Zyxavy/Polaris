import { expect, test } from '@playwright/test';

const email = `e2e-${Date.now()}@test.com`;
const password = 'password123';

test('P0 flow #1: sign up, sign out, sign in', async ({ page }) => {
  // Sign up
  await page.goto('/sign-up');
  await page.fill('#name', 'E2E User');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button:has-text("Create account")');
  await expect(page).toHaveURL('/guides', { timeout: 10000 });

  // Recovery codes modal shows
  await expect(page.locator('text=Save your recovery codes')).toBeVisible();
  await page.click('text=I\'ve saved them');
  await expect(page).toHaveURL('/guides');

  // Sign out via API
  await page.evaluate(() =>
    fetch('http://localhost:8787/api/auth/sign-out', { method: 'POST', credentials: 'include' })
  );

  // Sign in
  await page.goto('/sign-in');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
});