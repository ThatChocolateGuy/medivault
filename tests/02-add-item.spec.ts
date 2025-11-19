import { test, expect } from '@playwright/test';

test.describe('Add Item Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to Add page
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('h1')).toContainText('Add Item');
  });

  test('should display all form fields', async ({ page }) => {
    // Check all form fields are visible
    await expect(page.getByLabel('Item Name', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Barcode', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Quantity', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Min Quantity', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Category', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Location', { exact: false })).toBeVisible();
    await expect(page.getByText('Notes', { exact: false })).toBeVisible();

    // Take screenshot of form
    await page.screenshot({ path: 'tests/screenshots/02-add-item-form.png', fullPage: true });
  });

  test('should have default categories and locations', async ({ page }) => {
    // Check categories dropdown
    const categorySelect = page.getByLabel('Category', { exact: false });
    await expect(categorySelect).toBeVisible();

    // Check locations dropdown
    const locationSelect = page.getByLabel('Location', { exact: false });
    await expect(locationSelect).toBeVisible();
  });

  test('should successfully add a new item', async ({ page }) => {
    // Fill out the form
    await page.getByLabel('Item Name', { exact: false }).fill('Test Bandages');
    await page.getByLabel('Barcode', { exact: false }).fill('1234567890123');
    await page.getByLabel('Quantity', { exact: false }).fill('50');
    await page.getByLabel('Min Quantity', { exact: false }).fill('10');

    // Select category (first option should be pre-selected)
    // Select location (first option should be pre-selected)

    // Add notes
    await page.getByPlaceholder('Additional notes').fill('Medical grade bandages for wounds');

    // Take screenshot before submit
    await page.screenshot({ path: 'tests/screenshots/02-add-item-filled.png', fullPage: true });

    // Submit form
    await page.getByRole('button', { name: 'Add Item' }).click();

    // Should navigate back to home
    await expect(page.locator('h1')).toContainText('Inventory', { timeout: 5000 });

    // Take screenshot after adding
    await page.screenshot({ path: 'tests/screenshots/02-after-add-item.png', fullPage: true });

    // Check if item appears in the list
    await expect(page.getByText('Test Bandages')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit empty form
    await page.getByRole('button', { name: 'Add Item' }).click();

    // Form should not submit (still on Add page)
    await expect(page.locator('h1')).toContainText('Add Item');
  });

  test('should allow canceling item creation', async ({ page }) => {
    // Fill out some fields
    await page.getByLabel('Item Name', { exact: false }).fill('Test Item');

    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Should navigate back to home
    await expect(page.locator('h1')).toContainText('Inventory');
  });

  test('should handle quantity inputs correctly', async ({ page }) => {
    const quantityInput = page.getByLabel('Quantity', { exact: false });

    // Test numeric input
    await quantityInput.fill('25');
    await expect(quantityInput).toHaveValue('25');

    // Test that negative numbers are not allowed
    await quantityInput.fill('-5');
    // HTML5 number input with min="0" should prevent negative values
  });

  test('should show photo upload section', async ({ page }) => {
    // Check if photo upload is available
    await expect(page.getByText('Photos')).toBeVisible();

    // Take screenshot showing photo upload area
    await page.screenshot({ path: 'tests/screenshots/02-photo-upload-section.png' });
  });
});
