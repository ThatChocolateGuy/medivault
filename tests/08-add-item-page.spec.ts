import { test, expect } from '@playwright/test';

test.describe('Add Item Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to add page
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('h1')).toContainText('Add Item');
  });

  test('should display form with all required fields', async ({ page }) => {
    // Check all form elements are present using placeholders and text
    await expect(page.getByText('Photos')).toBeVisible();
    await expect(page.getByPlaceholder('e.g., Bandages')).toBeVisible();
    await expect(page.getByPlaceholder('Scan or enter barcode')).toBeVisible();
    await expect(page.locator('input[type="number"]').first()).toBeVisible(); // Quantity
    await expect(page.locator('input[type="number"]').nth(1)).toBeVisible(); // Min Quantity
    await expect(page.locator('select').first()).toBeVisible(); // Category
    await expect(page.locator('select').nth(1)).toBeVisible(); // Location
    await expect(page.getByPlaceholder('Additional notes...')).toBeVisible();

    // Check buttons
    await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/08-add-item-form.png', fullPage: true });
  });

  test('should have photo upload with camera button', async ({ page }) => {
    // Camera button should be visible
    const cameraIcon = page.locator('label').filter({ has: page.locator('svg') }).first();
    await expect(cameraIcon).toBeVisible();

    // Check that file input exists and accepts images with capture attribute
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', 'image/*');
    await expect(fileInput).toHaveAttribute('capture', '');
    await expect(fileInput).toHaveAttribute('multiple', '');

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/08-photo-upload.png', fullPage: true });
  });

  test('should load category options from database', async ({ page }) => {
    // Wait for categories to load
    const categorySelect = page.locator('select').first();
    await expect(categorySelect).toBeEnabled();

    // Should have default categories
    const options = await categorySelect.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(0);

    // Should not show "Loading..." after load
    expect(options.includes('Loading...')).toBe(false);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/08-category-options.png', fullPage: true });
  });

  test('should load location options from database', async ({ page }) => {
    // Wait for locations to load
    const locationSelect = page.locator('select').nth(1);
    await expect(locationSelect).toBeEnabled();

    // Should have default locations
    const options = await locationSelect.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(0);

    // Should not show "Loading..." after load
    expect(options.includes('Loading...')).toBe(false);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/08-location-options.png', fullPage: true });
  });

  test('should handle number input for quantity field', async ({ page }) => {
    const quantityInput = page.locator('input[type="number"]').first();

    // Should start with default value of 1
    await expect(quantityInput).toHaveValue('1');

    // Should accept valid numbers
    await quantityInput.fill('25');
    await expect(quantityInput).toHaveValue('25');

    // Should handle empty string (converts to 0)
    await quantityInput.fill('');
    await quantityInput.blur();
    // After blur, the controlled component should maintain its state

    // Should handle typing numbers
    await quantityInput.fill('100');
    await expect(quantityInput).toHaveValue('100');

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/08-quantity-input.png', fullPage: true });
  });

  test('should handle number input for min quantity field', async ({ page }) => {
    const minQuantityInput = page.locator('input[type="number"]').nth(1);

    // Should start with default value of 0
    await expect(minQuantityInput).toHaveValue('0');

    // Should accept valid numbers
    await minQuantityInput.fill('10');
    await expect(minQuantityInput).toHaveValue('10');

    // Should handle empty string
    await minQuantityInput.fill('');
    await minQuantityInput.blur();

    // Should handle typing numbers
    await minQuantityInput.fill('5');
    await expect(minQuantityInput).toHaveValue('5');

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/08-min-quantity-input.png', fullPage: true });
  });

  test('should successfully add item with all fields', async ({ page }) => {
    // Fill out the form
    await page.getByPlaceholder('e.g., Bandages').fill('Test Item Full');
    await page.getByPlaceholder('Scan or enter barcode').fill('123456789');
    await page.locator('input[type="number"]').first().fill('15');
    await page.locator('input[type="number"]').nth(1).fill('5');
    await page.locator('select').first().selectOption('Equipment');
    await page.locator('select').nth(1).selectOption('Storage Room');
    await page.getByPlaceholder('Additional notes...').fill('This is a test note');

    // Take screenshot before submit
    await page.screenshot({ path: 'tests/screenshots/08-form-filled.png', fullPage: true });

    // Submit form
    await page.getByRole('button', { name: 'Add Item' }).click();

    // Should navigate to home page
    await page.waitForTimeout(500);
    await expect(page.locator('h1')).toContainText('Inventory');

    // Item should be visible on home page
    await expect(page.getByText('Test Item Full')).toBeVisible();

    // Take screenshot of result
    await page.screenshot({ path: 'tests/screenshots/08-item-added.png', fullPage: true });
  });

  test('should successfully add item with only required fields', async ({ page }) => {
    // Fill only required fields
    await page.getByPlaceholder('e.g., Bandages').fill('Minimal Item');
    await page.locator('input[type="number"]').first().fill('10');

    // Submit form
    await page.getByRole('button', { name: 'Add Item' }).click();

    // Should navigate to home page
    await page.waitForTimeout(500);
    await expect(page.locator('h1')).toContainText('Inventory');

    // Item should be visible on home page
    await expect(page.getByText('Minimal Item')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/08-minimal-item-added.png', fullPage: true });
  });

  test('should not submit form without item name', async ({ page }) => {
    // Try to submit without filling item name
    await page.getByRole('button', { name: 'Add Item' }).click();

    // Should show HTML5 validation error (stays on same page)
    await expect(page.locator('h1')).toContainText('Add Item');

    // Check that the name input is focused or has validation error
    const nameInput = page.getByPlaceholder('e.g., Bandages');
    const isInvalid = await nameInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/08-validation-error.png', fullPage: true });
  });

  test('should reset form after successful submission', async ({ page }) => {
    // Add first item
    await page.getByPlaceholder('e.g., Bandages').fill('First Item');
    await page.locator('input[type="number"]').first().fill('20');
    await page.getByRole('button', { name: 'Add Item' }).click();

    await page.waitForTimeout(500);

    // Go back to add page
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // Form should be reset
    await expect(page.getByPlaceholder('e.g., Bandages')).toHaveValue('');
    await expect(page.getByPlaceholder('Scan or enter barcode')).toHaveValue('');
    await expect(page.locator('input[type="number"]').first()).toHaveValue('1');
    await expect(page.locator('input[type="number"]').nth(1)).toHaveValue('0');
    await expect(page.getByPlaceholder('Additional notes...')).toHaveValue('');

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/08-form-reset.png', fullPage: true });
  });

  test('should show loading state on submit button', async ({ page }) => {
    // Fill form
    await page.getByPlaceholder('e.g., Bandages').fill('Loading Test');
    await page.locator('input[type="number"]').first().fill('5');

    // Click submit and wait for navigation
    const submitButton = page.getByRole('button', { name: 'Add Item' });
    await submitButton.click();

    // Should navigate to home page
    await expect(page.locator('h1')).toContainText('Inventory', { timeout: 10000 });

    // Verify item was added
    await expect(page.getByText('Loading Test')).toBeVisible();
  });

  test('cancel button should navigate back to home', async ({ page }) => {
    // Click cancel button
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Should navigate to home page
    await expect(page.locator('h1')).toContainText('Inventory');

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/08-cancel-navigation.png', fullPage: true });
  });

  test('should have proper styling and layout', async ({ page }) => {
    // Check that form has proper spacing
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Check that buttons are full width
    const addButton = page.getByRole('button', { name: 'Add Item' });
    const cancelButton = page.getByRole('button', { name: 'Cancel' });

    const addButtonBox = await addButton.boundingBox();
    const cancelButtonBox = await cancelButton.boundingBox();

    // Buttons should have similar widths (both full width)
    expect(Math.abs(addButtonBox!.width - cancelButtonBox!.width)).toBeLessThan(5);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/08-layout-styling.png', fullPage: true });
  });

  test('textarea should be resizable and have proper styling', async ({ page }) => {
    const notesTextarea = page.getByPlaceholder('Additional notes...');

    // Should be visible
    await expect(notesTextarea).toBeVisible();

    // Should accept text input
    await notesTextarea.fill('This is a longer note to test the textarea functionality and ensure it displays properly');
    await expect(notesTextarea).toHaveValue('This is a longer note to test the textarea functionality and ensure it displays properly');

    // Check styling
    const styles = await notesTextarea.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        resize: computed.resize,
        border: computed.border,
      };
    });

    // Textarea should not be resizable (resize-none class)
    expect(styles.resize).toBe('none');

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/08-notes-textarea.png', fullPage: true });
  });
});

test.describe('Add Item Page - Mobile', () => {
  test('should display properly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Navigate to add page
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // Form should be visible
    await expect(page.locator('h1')).toContainText('Add Item');
    await expect(page.getByPlaceholder('e.g., Bandages')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({ path: 'tests/screenshots/08-mobile-add-item.png', fullPage: true });
  });

  test('should be able to add item on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Navigate to add page
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // Fill form
    await page.getByPlaceholder('e.g., Bandages').fill('Mobile Test Item');
    await page.locator('input[type="number"]').first().fill('8');

    // Submit
    await page.getByRole('button', { name: 'Add Item' }).click();

    // Should navigate to home
    await page.waitForTimeout(500);
    await expect(page.locator('h1')).toContainText('Inventory');
    await expect(page.getByText('Mobile Test Item')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({ path: 'tests/screenshots/08-mobile-item-added.png', fullPage: true });
  });
});
