import { expect, test } from '@playwright/test';

test.describe('Autopilot entry', () => {
  test('loads entry page from direct navigation', async ({ page }) => {
    await page.goto('/autopilot');
    await expect(page.getByRole('heading', { name: /autopilot mode/i })).toBeVisible();
  });
});
