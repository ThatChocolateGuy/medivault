import { test, expect, type Page } from '@playwright/test';

// Helper function to add an item
async function addItem(page: Page, itemData: {
  name: string;
  quantity: number;
  minQuantity?: number;
  category?: string;
  location?: string;
  notes?: string;
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

  if (itemData.notes) {
    await page.getByPlaceholder('Additional notes...').fill(itemData.notes);
  }

  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.waitForTimeout(500);
}

test.describe('Item Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to item detail page on card click', async ({ page }) => {
    // Add an item first
    await addItem(page, {
      name: 'Test Detail Item',
      quantity: 10,
      minQuantity: 5,
      category: 'Equipment',
      notes: 'Test notes for detail page',
    });

    // Go back to home
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    // Click on the item card
    await page.getByText('Test Detail Item').click();
    await page.waitForTimeout(500);

    // Should show item details page with back button
    await expect(page.locator('h1')).toContainText('Item Details');
    await expect(page.locator('button[aria-label="Back"]')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-detail-page.png', fullPage: true });
  });

  test('should display all item information in view mode', async ({ page }) => {
    // Add item with all fields
    await addItem(page, {
      name: 'Complete Test Item',
      quantity: 25,
      minQuantity: 10,
      category: 'Medications',
      location: 'Refrigerator',
      notes: 'Important test notes',
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    // Click to view details
    await page.getByText('Complete Test Item').click();
    await page.waitForTimeout(500);

    // Verify all information is displayed
    await expect(page.locator('h2')).toContainText('Complete Test Item');
    await expect(page.getByText('25')).toBeVisible(); // Quantity
    await expect(page.getByText('min: 10')).toBeVisible(); // Min quantity
    await expect(page.getByText('Medications')).toBeVisible(); // Category
    await expect(page.getByText('Refrigerator')).toBeVisible(); // Location
    await expect(page.getByText('Important test notes')).toBeVisible(); // Notes

    // Check timestamps are shown
    await expect(page.getByText(/Created/)).toBeVisible();
    await expect(page.getByText(/Updated/)).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-view-mode-complete.png', fullPage: true });
  });

  test('should show Edit and Delete buttons', async ({ page }) => {
    await addItem(page, {
      name: 'Item with Actions',
      quantity: 5,
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Item with Actions').click();
    await page.waitForTimeout(500);

    // Check action buttons
    await expect(page.getByRole('button', { name: 'Edit Item' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete Item' })).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-action-buttons.png', fullPage: true });
  });

  test('should switch to edit mode when Edit button is clicked', async ({ page }) => {
    await addItem(page, {
      name: 'Item to Edit',
      quantity: 15,
      notes: 'Original notes',
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Item to Edit').click();
    await page.waitForTimeout(500);

    // Click Edit button
    await page.getByRole('button', { name: 'Edit Item' }).click();
    await page.waitForTimeout(300);

    // Should show edit form
    await expect(page.locator('h1')).toContainText('Edit Item');
    await expect(page.getByPlaceholder('e.g., Bandages')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-edit-mode.png', fullPage: true });
  });

  test('should cancel edit and return to view mode', async ({ page }) => {
    await addItem(page, {
      name: 'Cancel Edit Test',
      quantity: 20,
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Cancel Edit Test').click();
    await page.waitForTimeout(500);

    // Go to edit mode
    await page.getByRole('button', { name: 'Edit Item' }).click();
    await page.waitForTimeout(300);

    // Make a change
    await page.getByPlaceholder('e.g., Bandages').fill('Changed Name');

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(300);

    // Should be back in view mode with original name
    await expect(page.locator('h1')).toContainText('Item Details');
    await expect(page.locator('h2')).toContainText('Cancel Edit Test');
    await expect(page.locator('h2')).not.toContainText('Changed Name');

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-cancel-edit.png', fullPage: true });
  });

  test('should save edited item details', async ({ page }) => {
    await addItem(page, {
      name: 'Item to Save',
      quantity: 10,
      minQuantity: 5,
      notes: 'Original notes',
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Item to Save').click();
    await page.waitForTimeout(500);

    // Edit the item
    await page.getByRole('button', { name: 'Edit Item' }).click();
    await page.waitForTimeout(300);

    await page.getByPlaceholder('e.g., Bandages').fill('Updated Item Name');
    await page.locator('input[type="number"]').first().fill('30');
    await page.getByPlaceholder('Additional notes...').fill('Updated notes content');

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.waitForTimeout(500);

    // Should be back in view mode with updated info
    await expect(page.locator('h1')).toContainText('Item Details');
    await expect(page.locator('h2')).toContainText('Updated Item Name');
    await expect(page.getByText('30')).toBeVisible();
    await expect(page.getByText('Updated notes content')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-saved-changes.png', fullPage: true });
  });

  test('should show delete confirmation dialog', async ({ page }) => {
    await addItem(page, {
      name: 'Item to Delete',
      quantity: 5,
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Item to Delete').click();
    await page.waitForTimeout(500);

    // Click Delete button
    await page.getByRole('button', { name: 'Delete Item' }).click();
    await page.waitForTimeout(300);

    // Should show confirmation dialog
    await expect(page.getByText('Delete Item?')).toBeVisible();
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible();
    await expect(page.getByText('"Item to Delete"')).toBeVisible();

    // Should have Cancel and Delete buttons
    const cancelButton = page.getByRole('button', { name: 'Cancel' }).last();
    const deleteButton = page.getByRole('button', { name: 'Delete' }).last();
    await expect(cancelButton).toBeVisible();
    await expect(deleteButton).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-delete-dialog.png', fullPage: true });
  });

  test('should cancel delete and stay on detail page', async ({ page }) => {
    await addItem(page, {
      name: 'Cancel Delete Test',
      quantity: 8,
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Cancel Delete Test').click();
    await page.waitForTimeout(500);

    // Open delete dialog
    await page.getByRole('button', { name: 'Delete Item' }).click();
    await page.waitForTimeout(300);

    // Cancel delete
    const cancelButton = page.getByRole('button', { name: 'Cancel' }).last();
    await cancelButton.click();
    await page.waitForTimeout(300);

    // Should still be on detail page
    await expect(page.locator('h2')).toContainText('Cancel Delete Test');

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-cancel-delete.png', fullPage: true });
  });

  test('should delete item and return to home page', async ({ page }) => {
    await addItem(page, {
      name: 'Item to Really Delete',
      quantity: 3,
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Item to Really Delete').click();
    await page.waitForTimeout(500);

    // Delete the item
    await page.getByRole('button', { name: 'Delete Item' }).click();
    await page.waitForTimeout(300);

    const deleteButton = page.getByRole('button', { name: 'Delete' }).last();
    await deleteButton.click();
    await page.waitForTimeout(500);

    // Should navigate back to home
    await expect(page.locator('h1')).toContainText('Inventory');

    // Item should not be visible
    const itemText = page.getByText('Item to Really Delete');
    const isVisible = await itemText.isVisible().catch(() => false);
    expect(isVisible).toBe(false);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-after-delete.png', fullPage: true });
  });

  test('should navigate back to home with back button', async ({ page }) => {
    await addItem(page, {
      name: 'Back Button Test',
      quantity: 12,
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Back Button Test').click();
    await page.waitForTimeout(500);

    // Click back button
    await page.locator('button[aria-label="Back"]').click();
    await page.waitForTimeout(300);

    // Should be back on home page
    await expect(page.locator('h1')).toContainText('Inventory');
    await expect(page.getByText('Back Button Test')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-back-navigation.png', fullPage: true });
  });

  test('should show low stock badge in detail view', async ({ page }) => {
    await addItem(page, {
      name: 'Low Stock Item',
      quantity: 2,
      minQuantity: 10,
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Low Stock Item').click();
    await page.waitForTimeout(500);

    // Should show low stock badge
    await expect(page.getByText('Low Stock', { exact: true })).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-low-stock-detail.png', fullPage: true });
  });

  test('should preserve category and location in edit mode', async ({ page }) => {
    await addItem(page, {
      name: 'Preserve Data Test',
      quantity: 15,
      category: 'First Aid',
      location: 'Storage Room',
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Preserve Data Test').click();
    await page.waitForTimeout(500);

    // Go to edit mode
    await page.getByRole('button', { name: 'Edit Item' }).click();
    await page.waitForTimeout(300);

    // Check that category and location are pre-selected
    const categorySelect = page.locator('select').first();
    await expect(categorySelect).toHaveValue('First Aid');

    const locationSelect = page.locator('select').nth(1);
    await expect(locationSelect).toHaveValue('Storage Room');

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-preserve-selections.png', fullPage: true });
  });

  test('should handle item without optional fields', async ({ page }) => {
    await addItem(page, {
      name: 'Minimal Item',
      quantity: 5,
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Minimal Item').click();
    await page.waitForTimeout(500);

    // Should display even without optional fields
    await expect(page.locator('h2')).toContainText('Minimal Item');
    await expect(page.getByText('5')).toBeVisible();

    // Notes section should not appear if no notes
    const notesText = page.getByText('Notes');
    const hasNotes = await notesText.isVisible().catch(() => false);
    expect(hasNotes).toBe(false);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/09-minimal-item.png', fullPage: true });
  });
});

test.describe('Item Detail Page - Mobile', () => {
  test('should display properly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await addItem(page, {
      name: 'Mobile Detail Test',
      quantity: 20,
      notes: 'Test on mobile device',
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Mobile Detail Test').click();
    await page.waitForTimeout(500);

    // Should display properly
    await expect(page.locator('h2')).toContainText('Mobile Detail Test');
    await expect(page.getByRole('button', { name: 'Edit Item' })).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({ path: 'tests/screenshots/09-mobile-detail.png', fullPage: true });
  });

  test('should edit item on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await addItem(page, {
      name: 'Mobile Edit Test',
      quantity: 10,
    });

    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('Mobile Edit Test').click();
    await page.waitForTimeout(500);

    // Edit item
    await page.getByRole('button', { name: 'Edit Item' }).click();
    await page.waitForTimeout(300);

    await page.getByPlaceholder('e.g., Bandages').fill('Mobile Edited');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.waitForTimeout(500);

    // Verify changes
    await expect(page.locator('h2')).toContainText('Mobile Edited');

    // Take mobile screenshot
    await page.screenshot({ path: 'tests/screenshots/09-mobile-edited.png', fullPage: true });
  });
});
