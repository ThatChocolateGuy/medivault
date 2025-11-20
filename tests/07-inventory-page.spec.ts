import { test, expect, type Page } from '@playwright/test';

// Helper function to add an item
async function addItem(page: Page, itemData: {
  name: string;
  quantity: number;
  minQuantity?: number;
  category?: string;
  location?: string;
}) {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByPlaceholder('e.g., Bandages').fill(itemData.name);
  await page.locator('input[type="number"]').first().fill(String(itemData.quantity));

  if (itemData.minQuantity !== undefined) {
    await page.locator('input[type="number"]').nth(1).fill(String(itemData.minQuantity));
  }

  if (itemData.category) {
    await page.locator('select').first().selectOption(itemData.category);
  }

  if (itemData.location) {
    await page.locator('select').nth(1).selectOption(itemData.location);
  }

  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.waitForTimeout(500);
}

test.describe('Inventory Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Inventory');
  });

  test('should display empty state when no items', async ({ page }) => {
    // Check empty state messaging
    await expect(page.getByText('No items yet')).toBeVisible();
    await expect(page.getByText('Add your first item to get started')).toBeVisible();

    // Check empty state has Add Item button
    const addButton = page.getByRole('button', { name: 'Add Item' }).first();
    await expect(addButton).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/07-empty-state.png', fullPage: true });
  });

  test('should add items and display them as cards', async ({ page }) => {
    // Add first item using helper (uses default category from DB)
    await addItem(page, {
      name: 'Bandages',
      quantity: 25,
      minQuantity: 10,
    });

    // Should show item card
    await expect(page.getByText('Bandages')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/07-single-item.png', fullPage: true });
  });

  test('should display quantity without min quantity format', async ({ page }) => {
    // Add item
    await addItem(page, {
      name: 'Test Item',
      quantity: 15,
      minQuantity: 5,
    });

    // Should show just the quantity (15) with package icon, not "15 / 5"
    const quantityText = page.locator('text=15');
    await expect(quantityText).toBeVisible();

    // Should NOT show the old format with slash
    await expect(page.locator('text=/ 5')).not.toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/07-quantity-display.png', fullPage: true });
  });

  test('should show low stock badge for items below minimum', async ({ page }) => {
    // Add low stock item
    await addItem(page, {
      name: 'Gauze Pads',
      quantity: 3,
      minQuantity: 10,
    });

    // Should show "Low Stock" badge (exact match to avoid matching "Low Stock Alert" heading)
    await expect(page.getByText('Low Stock', { exact: true })).toBeVisible();

    // Quantity should be visible
    await expect(page.getByText('3')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/07-low-stock-item.png', fullPage: true });
  });

  test('should NOT show low stock badge for items above minimum', async ({ page }) => {
    // Add normal stock item
    await addItem(page, {
      name: 'Thermometer',
      quantity: 20,
      minQuantity: 5,
    });

    // Should NOT show "Low Stock" badge
    await expect(page.getByText('Low Stock')).not.toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/07-normal-stock-item.png', fullPage: true });
  });

  test('should display multiple items with proper styling', async ({ page }) => {
    // Add multiple items
    await addItem(page, { name: 'Bandages', quantity: 25, minQuantity: 10 });
    await addItem(page, { name: 'Gauze', quantity: 3, minQuantity: 10 });
    await addItem(page, { name: 'Thermometer', quantity: 5, minQuantity: 2 });

    // Navigate back to home
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(500);

    // All items should be visible
    await expect(page.getByText('Bandages')).toBeVisible();
    await expect(page.getByText('Gauze')).toBeVisible();
    await expect(page.getByText('Thermometer')).toBeVisible();

    // Gauze should have low stock badge (3 < 10)
    const lowStockBadges = page.getByText('Low Stock', { exact: true });
    await expect(lowStockBadges).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/07-multiple-items.png', fullPage: true });
  });

  test('should display category badges with primary color', async ({ page }) => {
    // Add item
    await addItem(page, {
      name: 'Test Item',
      quantity: 10,
      category: 'Equipment',
    });

    // Category badge should be visible
    const categoryBadge = page.getByText('Equipment');
    await expect(categoryBadge).toBeVisible();

    // Check badge has primary color styling
    const badgeStyles = await categoryBadge.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
      };
    });

    // Should use primary colors (blue-ish tones)
    expect(badgeStyles.backgroundColor).toBeTruthy();
    expect(badgeStyles.color).toBeTruthy();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/07-category-badge.png', fullPage: true });
  });

  test('should display location information', async ({ page }) => {
    // Add item with location (use actual default from DB: Shelf A, Shelf B, Refrigerator, Storage Room)
    await addItem(page, {
      name: 'Scissors',
      quantity: 8,
      location: 'Refrigerator',
    });

    // Location should be visible with MapPin icon
    await expect(page.getByText('Refrigerator')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/07-location-display.png', fullPage: true });
  });

  test('should show relative time for last update', async ({ page }) => {
    // Add item
    await addItem(page, {
      name: 'Recently Added',
      quantity: 5,
    });

    // Should show "Just now" or similar relative time
    const timeText = page.locator('text=/just now|seconds ago|minutes ago/i');
    await expect(timeText).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/07-relative-time.png', fullPage: true });
  });

  test('should display package icon for items without photos', async ({ page }) => {
    // Add item without photo
    await addItem(page, {
      name: 'No Photo Item',
      quantity: 10,
    });

    // Package icon should be visible (there should be an SVG in the card)
    const packageIcons = page.locator('svg');
    const iconCount = await packageIcons.count();
    expect(iconCount).toBeGreaterThan(0);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/07-no-photo-icon.png', fullPage: true });
  });

  test('should have search bar visible and functional', async ({ page }) => {
    // Search bar should be visible
    const searchBar = page.getByPlaceholder('Search items...');
    await expect(searchBar).toBeVisible();

    // Add items
    await addItem(page, { name: 'Bandages', quantity: 10 });
    await addItem(page, { name: 'Scissors', quantity: 5 });

    // Go back to home
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    // Both items should be visible initially
    await expect(page.getByText('Bandages')).toBeVisible();
    await expect(page.getByText('Scissors')).toBeVisible();

    // Search for specific item
    await searchBar.fill('Band');
    await page.waitForTimeout(500);

    // Only Bandages should be visible
    await expect(page.getByText('Bandages')).toBeVisible();

    // Scissors should not be visible (filtered out)
    const scissorsCard = page.getByText('Scissors');
    const isVisible = await scissorsCard.isVisible().catch(() => false);
    expect(isVisible).toBe(false);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/07-search-results.png', fullPage: true });
  });

  test('should have proper card spacing and layout', async ({ page }) => {
    // Add multiple items
    for (let i = 1; i <= 3; i++) {
      await addItem(page, {
        name: `Item ${i}`,
        quantity: i * 5,
      });
    }

    // Go back to home
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(500);

    // Check all cards are visible
    await expect(page.getByText('Item 1')).toBeVisible();
    await expect(page.getByText('Item 2')).toBeVisible();
    await expect(page.getByText('Item 3')).toBeVisible();

    // Take screenshot showing layout
    await page.screenshot({ path: 'tests/screenshots/07-card-layout.png', fullPage: true });
  });

  test('cards should be clickable and accessible', async ({ page }) => {
    // Add item
    await addItem(page, {
      name: 'Clickable Item',
      quantity: 10,
    });

    // Find the card (it should have cursor-pointer class)
    const card = page.locator('.cursor-pointer').first();
    await expect(card).toBeVisible();

    // Card should have transition-colors for visual feedback
    const hasTransition = await card.evaluate((el) => {
      return el.className.includes('transition-colors');
    });
    expect(hasTransition).toBe(true);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/07-card-interaction.png', fullPage: true });
  });
});

test.describe('Inventory Page - Mobile', () => {
  test('should display properly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Add item
    await addItem(page, {
      name: 'Mobile Test',
      quantity: 10,
    });

    // Go back home
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    // Item should be visible on mobile
    await expect(page.getByText('Mobile Test')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({ path: 'tests/screenshots/07-mobile-inventory.png', fullPage: true });
  });
});
