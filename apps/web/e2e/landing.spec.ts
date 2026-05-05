import { expect, test } from '@playwright/test';

test.describe('Landing page', () => {
  test('loads and exposes primary CTAs to Designer and Autopilot', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Build RAG Systems/i);

    const designerCta = page.getByRole('link', { name: /start designing/i });
    await expect(designerCta).toBeVisible();
    await expect(designerCta).toHaveAttribute('href', '/designer');

    const autopilotCta = page.getByRole('link', { name: /launch autopilot/i });
    await expect(autopilotCta).toBeVisible();
    await expect(autopilotCta).toHaveAttribute('href', '/autopilot');

    await expect(page.locator('aside')).toHaveCount(0);
  });

  test('navigates to Designer shell from Hero CTA', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /start designing/i }).click();
    await expect(page).toHaveURL(/\/designer/);
    await expect(page.getByRole('radiogroup', { name: /cloud provider/i })).toBeVisible();
  });
});
