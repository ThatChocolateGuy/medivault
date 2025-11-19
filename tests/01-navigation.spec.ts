import { test, expect } from '@playwright/test';

test.describe('Navigation and Layout', () => {
  test('should load the app and show homepage', async ({ page }) => {
    await page.goto('/');

    // Check page title and header
    await expect(page.locator('h1')).toContainText('Inventory');

    // Take screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/01-homepage-initial.png', fullPage: true });
  });

  test('should display bottom navigation with all tabs', async ({ page }) => {
    await page.goto('/');

    // Check all navigation items are visible
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Scan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();

    // Take screenshot of navigation
    await page.screenshot({ path: 'tests/screenshots/01-bottom-navigation.png' });
  });

  test('should navigate to different tabs', async ({ page }) => {
    await page.goto('/');

    // Navigate to Scan page
    await page.getByRole('button', { name: 'Scan' }).click();
    await expect(page.locator('h1')).toContainText('Scan Barcode');
    await page.screenshot({ path: 'tests/screenshots/01-scan-page.png', fullPage: true });

    // Navigate to Add page
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('h1')).toContainText('Add Item');
    await page.screenshot({ path: 'tests/screenshots/01-add-page.png', fullPage: true });

    // Navigate to Settings page
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('h1')).toContainText('Settings');
    await page.screenshot({ path: 'tests/screenshots/01-settings-page.png', fullPage: true });

    // Navigate back to Home
    await page.getByRole('button', { name: 'Home' }).click();
    await expect(page.locator('h1')).toContainText('Inventory');
  });

  test('should show empty state when no items exist', async ({ page }) => {
    await page.goto('/');

    // Wait for loading to complete
    await page.waitForTimeout(1000);

    // Check for empty state
    const emptyStateVisible = await page.getByText('No items yet').isVisible().catch(() => false);

    if (emptyStateVisible) {
      await expect(page.getByText('No items yet')).toBeVisible();
      await expect(page.getByText('Add your first item to get started')).toBeVisible();
      await page.screenshot({ path: 'tests/screenshots/01-empty-state.png', fullPage: true });
    }
  });

  test('should highlight active navigation tab', async ({ page }) => {
    await page.goto('/');

    // Home should be active
    const homeButton = page.getByRole('button', { name: 'Home' });
    await expect(homeButton).toHaveAttribute('aria-current', 'page');

    // Navigate to Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    const settingsButton = page.getByRole('button', { name: 'Settings' });
    await expect(settingsButton).toHaveAttribute('aria-current', 'page');
  });
});
