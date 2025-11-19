import { test, expect } from '@playwright/test';

test.describe('Mobile Responsiveness', () => {
  test('should display correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Check viewport dimensions
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBeLessThan(600);

    // Take mobile screenshot
    await page.screenshot({ path: 'tests/screenshots/05-mobile-home.png', fullPage: true });
  });

  test('should have touch-friendly navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Check bottom navigation is visible
    const homeButton = page.getByRole('button', { name: 'Home' });
    await expect(homeButton).toBeVisible();

    // Check button size (should be at least 48x48px for touch)
    const boundingBox = await homeButton.boundingBox();
    expect(boundingBox?.width).toBeGreaterThanOrEqual(48);
    expect(boundingBox?.height).toBeGreaterThanOrEqual(48);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/05-mobile-navigation.png' });
  });

  test('should display add form correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Add' }).click();

    // Form should be scrollable and properly laid out
    await expect(page.getByLabel('Item Name', { exact: false })).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/05-mobile-add-form.png', fullPage: true });
  });

  test('should show bottom navigation on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Bottom nav should be fixed at bottom
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();

    // Take screenshot focusing on bottom area
    await page.screenshot({ path: 'tests/screenshots/05-mobile-bottom-nav.png' });
  });

  test('search bar should work on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const searchInput = page.getByPlaceholder('Search items...');
    await expect(searchInput).toBeVisible();

    // Input should be touch-friendly
    const boundingBox = await searchInput.boundingBox();
    expect(boundingBox?.height).toBeGreaterThanOrEqual(48);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/05-mobile-search.png', fullPage: true });
  });
});

test.describe('Tablet Responsiveness', () => {
  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1366 }); // iPad Pro size
    await page.goto('/');

    await page.screenshot({ path: 'tests/screenshots/05-tablet-home.png', fullPage: true });

    // Navigation should still be visible
    await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  });

  test('should utilize tablet space efficiently', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1366 });
    await page.goto('/');

    // Add some items first
    await page.getByRole('button', { name: 'Add' }).click();
    await page.getByLabel('Item Name', { exact: false }).fill('Tablet Test Item');
    await page.getByLabel('Quantity', { exact: false }).fill('10');
    await page.getByRole('button', { name: 'Add Item' }).click();

    await page.waitForTimeout(1000);

    // Take screenshot showing layout
    await page.screenshot({ path: 'tests/screenshots/05-tablet-with-items.png', fullPage: true });
  });
});
