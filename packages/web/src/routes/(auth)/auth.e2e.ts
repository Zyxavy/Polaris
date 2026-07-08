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

  // Recovery codes modal shows (still on /sign-up)
  await expect(page.locator('text=Save your recovery codes')).toBeVisible({ timeout: 10000 });
  await page.click('text=I\'ve saved them');
  await expect(page).toHaveURL('/guides');

  // Sign out via API (Playwright request context avoids SameSite cross-origin restrictions)
  await page.request.post('http://localhost:8787/api/auth/sign-out');
  await page.context().clearCookies();

  // Sign in
  await page.goto('/sign-in');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
});