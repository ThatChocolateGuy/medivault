import { test, expect } from '@playwright/test';

test.describe('Search and Filter Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Add a few test items first
    for (const item of [
      { name: 'Aspirin 500mg', barcode: '111', category: 'Medications', qty: '100' },
      { name: 'Medical Gauze', barcode: '222', category: 'Supplies', qty: '50' },
      { name: 'Digital Thermometer', barcode: '333', category: 'Equipment', qty: '5' },
    ]) {
      await page.getByRole('button', { name: 'Add' }).click();
      await page.getByLabel('Item Name', { exact: false }).fill(item.name);
      await page.getByLabel('Barcode', { exact: false }).fill(item.barcode);
      await page.getByLabel('Quantity', { exact: false }).fill(item.qty);
      await page.getByRole('button', { name: 'Add Item' }).click();
      await page.waitForTimeout(500);
    }

    // Navigate back to home
    await page.getByRole('button', { name: 'Home' }).click();
    await page.waitForTimeout(1000);
  });

  test('should display search bar on home page', async ({ page }) => {
    await expect(page.getByPlaceholder('Search items...')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/03-search-bar.png', fullPage: true });
  });

  test('should search items by name', async ({ page }) => {
    const searchBar = page.getByPlaceholder('Search items...');

    // Search for "Aspirin"
    await searchBar.fill('Aspirin');
    await page.waitForTimeout(500);

    // Should show Aspirin
    await expect(page.getByText('Aspirin 500mg')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/03-search-aspirin.png', fullPage: true });

    // Should not show other items
    const gauzeVisible = await page.getByText('Medical Gauze').isVisible().catch(() => false);
    expect(gauzeVisible).toBe(false);
  });

  test('should search items by barcode', async ({ page }) => {
    const searchBar = page.getByPlaceholder('Search items...');

    // Search by barcode
    await searchBar.fill('222');
    await page.waitForTimeout(500);

    // Should show Medical Gauze
    await expect(page.getByText('Medical Gauze')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/03-search-barcode.png', fullPage: true });
  });

  test('should show all items when search is cleared', async ({ page }) => {
    const searchBar = page.getByPlaceholder('Search items...');

    // Search first
    await searchBar.fill('Aspirin');
    await page.waitForTimeout(500);

    // Clear search using the X button
    await page.locator('button[aria-label="Clear search"]').click();

    // All items should be visible again
    await expect(page.getByText('Aspirin 500mg')).toBeVisible();
    await expect(page.getByText('Medical Gauze')).toBeVisible();
    await expect(page.getByText('Digital Thermometer')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/03-search-cleared.png', fullPage: true });
  });

  test('should show "no items found" for non-existent search', async ({ page }) => {
    const searchBar = page.getByPlaceholder('Search items...');

    // Search for something that doesn't exist
    await searchBar.fill('XYZ Non Existent Item 123');
    await page.waitForTimeout(500);

    // Should show empty state
    await expect(page.getByText('No items found')).toBeVisible();
    await expect(page.getByText('Try a different search term')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/03-no-results.png', fullPage: true });
  });

  test('should display item cards with all information', async ({ page }) => {
    // Check if items show all required information
    const _aspirinCard = page.getByText('Aspirin 500mg').locator('..');

    // Should show quantity
    await expect(page.getByText(/Qty:/).first()).toBeVisible();

    // Should show category badge
    await expect(page.getByText('Medications').first()).toBeVisible();

    // Take screenshot of item cards
    await page.screenshot({ path: 'tests/screenshots/03-item-cards.png', fullPage: true });
  });
});
