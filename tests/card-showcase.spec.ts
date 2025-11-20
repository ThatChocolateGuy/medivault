import { test, expect } from '@playwright/test';

test('showcase improved item cards', async ({ page }) => {
  await page.goto('/');

  // Navigate to add page using bottom nav
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // Add a normal item
  await page.getByLabel('Item Name', { exact: false }).fill('Bandages');
  await page.getByLabel('Quantity', { exact: false }).fill('25');
  await page.getByLabel('Min Quantity', { exact: false }).fill('10');
  await page.getByLabel('Category', { exact: false }).selectOption('Consumables');
  await page.getByLabel('Location', { exact: false }).selectOption('Cabinet A');
  await page.getByRole('button', { name: 'Add Item' }).click();

  await page.waitForTimeout(500);

  // Add a low stock item
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Item Name', { exact: false }).fill('Gauze Pads');
  await page.getByLabel('Quantity', { exact: false }).fill('3');
  await page.getByLabel('Min Quantity', { exact: false }).fill('10');
  await page.getByLabel('Category', { exact: false }).selectOption('Consumables');
  await page.getByLabel('Location', { exact: false }).selectOption('Drawer 1');
  await page.getByRole('button', { name: 'Add Item' }).click();

  await page.waitForTimeout(500);

  // Add another normal item
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Item Name', { exact: false }).fill('Thermometer');
  await page.getByLabel('Quantity', { exact: false }).fill('5');
  await page.getByLabel('Min Quantity', { exact: false }).fill('2');
  await page.getByLabel('Category', { exact: false }).selectOption('Equipment');
  await page.getByLabel('Location', { exact: false }).selectOption('Storage Room');
  await page.getByRole('button', { name: 'Add Item' }).click();

  await page.waitForTimeout(1000);

  // Go back to home to see cards
  await page.getByRole('button', { name: 'Home', exact: true }).click();

  await page.waitForTimeout(500);

  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/improved-item-cards.png', fullPage: true });
});
