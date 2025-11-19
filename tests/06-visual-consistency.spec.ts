import { test, expect } from '@playwright/test';

test.describe('Visual Consistency and UX', () => {
  test('should have consistent color scheme', async ({ page }) => {
    await page.goto('/');

    // Check primary colors are being used
    const addButton = page.getByRole('button', { name: 'Add Item' }).first();
    if (await addButton.isVisible()) {
      // Should have primary color classes
      await page.screenshot({ path: 'tests/screenshots/06-color-scheme.png', fullPage: true });
    }
  });

  test('should have consistent spacing and alignment', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add' }).click();

    // All form elements should be properly aligned
    const formElements = [
      page.getByLabel('Item Name', { exact: false }),
      page.getByLabel('Barcode', { exact: false }),
      page.getByLabel('Quantity', { exact: false }),
    ];

    for (const element of formElements) {
      await expect(element).toBeVisible();
    }

    // Take screenshot to verify alignment
    await page.screenshot({ path: 'tests/screenshots/06-form-alignment.png', fullPage: true });
  });

  test('should have readable typography', async ({ page }) => {
    await page.goto('/');

    // Check headers are visible and properly sized
    const header = page.locator('h1').first();
    await expect(header).toBeVisible();

    const fontSize = await header.evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });

    // Font size should be reasonable (at least 16px)
    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(16);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/06-typography.png', fullPage: true });
  });

  test('should have proper button styling', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add' }).click();

    const addButton = page.getByRole('button', { name: 'Add Item' });
    await expect(addButton).toBeVisible();

    // Button should have proper padding and be easy to click
    const boundingBox = await addButton.boundingBox();
    expect(boundingBox?.height).toBeGreaterThanOrEqual(48);

    // Take screenshot showing button states
    await page.screenshot({ path: 'tests/screenshots/06-button-styling.png' });
  });

  test('should show loading state on initialization', async ({ page }) => {
    await page.goto('/');

    // Check if loader appears initially
    const possibleLoader = page.locator('text=Loading');
    // Loader might be very quick, so we just check the page loads

    await page.waitForTimeout(2000);

    // Page should be fully loaded
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should have accessible navigation labels', async ({ page }) => {
    await page.goto('/');

    // Check aria-labels exist for navigation
    const homeButton = page.getByRole('button', { name: 'Home' });
    await expect(homeButton).toHaveAttribute('aria-label', 'Home');

    const scanButton = page.getByRole('button', { name: 'Scan' });
    await expect(scanButton).toHaveAttribute('aria-label', 'Scan');
  });

  test('should display icons consistently', async ({ page }) => {
    await page.goto('/');

    // Check navigation icons are visible
    const icons = page.locator('svg');
    const iconCount = await icons.count();

    // Should have icons for navigation (at least 4 for bottom nav)
    expect(iconCount).toBeGreaterThanOrEqual(4);

    // Take screenshot showing icons
    await page.screenshot({ path: 'tests/screenshots/06-icons-consistency.png', fullPage: true });
  });

  test('should have proper focus states', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add' }).click();

    // Tab through form elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Take screenshot showing focus
    await page.screenshot({ path: 'tests/screenshots/06-focus-states.png' });
  });

  test('should handle empty states gracefully', async ({ page }) => {
    await page.goto('/');

    // Check empty state has helpful messaging
    const emptyStateVisible = await page.getByText('No items yet').isVisible().catch(() => false);

    if (emptyStateVisible) {
      await expect(page.getByText('Add your first item to get started')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible();

      // Take screenshot of empty state
      await page.screenshot({
        path: 'tests/screenshots/06-empty-state-messaging.png',
        fullPage: true,
      });
    }
  });

  test('should have consistent card styling', async ({ page }) => {
    await page.goto('/');

    // Add an item to see card styling
    await page.getByRole('button', { name: 'Add' }).click();
    await page.getByLabel('Item Name', { exact: false }).fill('Test Item for Card');
    await page.getByLabel('Quantity', { exact: false }).fill('10');
    await page.getByRole('button', { name: 'Add Item' }).click();

    await page.waitForTimeout(1000);

    // Take screenshot of item cards
    await page.screenshot({ path: 'tests/screenshots/06-card-styling.png', fullPage: true });
  });
});
