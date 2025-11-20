# Quick Start: Manual Scanner Testing

Follow these steps to manually test the barcode scanner with your camera:

## Step 1: Seed Test Data

1. Open your app at **<http://localhost:5177/>** in Edge
2. Open browser console (F12 or Ctrl+Shift+I)
3. Copy the entire contents of `seed-browser-console.js`
4. Paste into the console and press Enter
5. You should see:

   ```md
   🌱 Starting to seed test barcode data...
   ✅ Created: Aspirin 500mg (5901234123457)
   ✅ Created: Bandages Box (5901234567890)
   ... (8 more items)
   🎉 Seeding complete!
   ✅ Success: 10 items
   ```

6. Refresh the page to see the items in your inventory

## Step 2: Open Barcode Images

1. Open `printable-barcodes.html` in a **different browser tab or window**
2. You'll see 10 test items with barcodes + 4 unknown barcodes

**Options:**

- **Option A (Recommended):** Display `printable-barcodes.html` on a second screen
- **Option B:** Print the page and scan the printed barcodes
- **Option C:** Use your phone/tablet to display the barcodes

## Step 3: Test Scanner

1. In your main Edge tab (<http://localhost:5177/>), click the **"Scan"** button
2. Click **"Start Scanning"**
3. Allow camera permissions if prompted
4. Point your camera at one of the barcodes from the HTML page

## Expected Results

### ✅ Items That Should Be Found

| Barcode | Item Name | Stock Status |
|---------|-----------|--------------|
| `5901234123457` | Aspirin 500mg | Normal |
| `5901234567890` | Bandages Box | Normal |
| `5901234111111` | Surgical Gloves | ⚠️ LOW STOCK |
| `MED-001-2024` | Antibiotic Cream | Normal |
| `EQP-THERM-100` | Digital Thermometer | Normal |
| `012345678905` | Hand Sanitizer 500ml | Normal |
| `036000291452` | Ibuprofen 200mg | ⚠️ LOW STOCK |
| `96385074` | Alcohol Swabs | Normal |
| `GAUZE-2024` | Sterile Gauze Pads | Normal |
| `MASK-N95-500` | N95 Respirator Masks | 🚨 CRITICAL LOW |

**Expected Behavior:**

- Scanner detects barcode
- Shows "Item Found!" message
- Displays item details (name, quantity, category, location)
- "View Item Details" button appears
- Low stock items should show low stock indicator

### ❌ Items That Should NOT Be Found

| Barcode | Format |
|---------|--------|
| `9999999999999` | EAN-13 |
| `UNKNOWN-123` | Code 128 |
| `999999999999` | UPC-A |
| `NOT-FOUND` | Code 39 |

**Expected Behavior:**

- Scanner detects barcode
- Shows "Item Not Found" message
- Displays the scanned barcode
- "Add New Item" button appears
- Clicking "Add New Item" navigates to Add Item page with barcode pre-filled

## Troubleshooting

### Camera Not Initializing

- Check browser console for errors
- Ensure HTTPS or localhost (camera requires secure context)
- Try refreshing the page
- Check camera permissions in Edge settings

### Barcode Not Detected

- Ensure good lighting
- Hold camera steady 6-12 inches from barcode
- Try different angles
- Ensure barcode is in focus
- Check that barcode format is supported

### Console Shows Errors

If you see errors in console:

1. Check that the scanner fix was applied (should show no "Cannot read properties of null" errors)
2. Look for permission errors (camera access denied)
3. Try closing and reopening the scanner

## Verification Checklist

- [ ] Test data seeded successfully (10 items)
- [ ] Scanner opens without errors
- [ ] Camera initializes properly (no console errors)
- [ ] Can detect EAN-13 barcodes (e.g., Aspirin `5901234123457`)
- [ ] Can detect Code 128 barcodes (e.g., Antibiotic Cream `MED-001-2024`)
- [ ] Can detect UPC-A barcodes (e.g., Hand Sanitizer `012345678905`)
- [ ] Can detect EAN-8 barcodes (e.g., Alcohol Swabs `96385074`)
- [ ] Can detect Code 39 barcodes (e.g., Gauze `GAUZE-2024`)
- [ ] "Item Found" flow works correctly
- [ ] "Item Not Found" flow works correctly
- [ ] Low stock items display properly
- [ ] Clicking "View Item Details" navigates to detail page
- [ ] Clicking "Add New Item" pre-fills barcode on add page

## Files Reference

- **Seed Script:** `tests/fixtures/seed-browser-console.js`
- **Barcode Images:** `tests/fixtures/printable-barcodes.html`
- **Test Data:** `tests/fixtures/barcode-test-data.ts`
- **Full Guide:** `tests/fixtures/BARCODE_TESTING_GUIDE.md`

## Quick Console Commands

```javascript
// Check how many items are in inventory
(await import('/src/lib/db/operations.js')).getAllItems().then(items => console.log(`Items: ${items.length}`))

// Get low stock items
(await import('/src/lib/db/operations.js')).getLowStockItems().then(items => console.log('Low stock:', items))

// Search for item by barcode
(await import('/src/lib/db/operations.js')).getItemByBarcode('5901234123457').then(item => console.log('Found:', item))

// Clear all items (if you need to start over)
(await import('/src/lib/db/index.js')).db.items.clear().then(() => console.log('All items cleared'))
```

## Next Steps After Verification

Once scanner is working properly:

1. Test all 10 barcodes to verify different formats
2. Test all 4 unknown barcodes to verify "not found" flow
3. Test low stock detection (Surgical Gloves, Ibuprofen, N95 Masks)
4. Test navigation from scanner to item detail page
5. Test adding new item with pre-filled barcode from unknown scan

## Need Help?

- Check browser console for errors (F12)
- Review `BARCODE_TESTING_GUIDE.md` for detailed troubleshooting
- Ensure scanner fix was committed (commit `6736c05`)
- Verify dev server is running on correct port (5177 in your case)
