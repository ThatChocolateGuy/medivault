/**
 * Browser Console Script - Seed Test Data
 *
 * Copy and paste this entire script into your browser console (F12)
 * while on http://localhost:5177/ to seed test barcode data
 */

(async function seedTestData() {
  console.log('🌱 Starting to seed test barcode data...');

  // Test data
  const testData = [
    {
      name: 'Aspirin 500mg',
      barcode: '5901234123457',
      quantity: 100,
      minQuantity: 20,
      category: 'Medications',
      location: 'Shelf A',
      notes: 'Pain reliever and fever reducer',
      photos: []
    },
    {
      name: 'Bandages Box',
      barcode: '5901234567890',
      quantity: 50,
      minQuantity: 10,
      category: 'First Aid',
      location: 'Shelf B',
      notes: 'Assorted adhesive bandages',
      photos: []
    },
    {
      name: 'Surgical Gloves',
      barcode: '5901234111111',
      quantity: 15,
      minQuantity: 25,
      category: 'Supplies',
      location: 'Storage Room',
      notes: 'Size M, latex-free - LOW STOCK',
      photos: []
    },
    {
      name: 'Antibiotic Cream',
      barcode: 'MED-001-2024',
      quantity: 30,
      minQuantity: 10,
      category: 'Medications',
      location: 'Refrigerator',
      notes: 'Keep refrigerated',
      photos: []
    },
    {
      name: 'Digital Thermometer',
      barcode: 'EQP-THERM-100',
      quantity: 12,
      minQuantity: 5,
      category: 'Equipment',
      location: 'Shelf A',
      notes: 'Infrared, contactless',
      photos: []
    },
    {
      name: 'Hand Sanitizer 500ml',
      barcode: '012345678905',
      quantity: 45,
      minQuantity: 15,
      category: 'Supplies',
      location: 'Shelf B',
      notes: '70% alcohol',
      photos: []
    },
    {
      name: 'Ibuprofen 200mg',
      barcode: '036000291452',
      quantity: 8,
      minQuantity: 20,
      category: 'Medications',
      location: 'Shelf A',
      notes: 'Pain reliever - LOW STOCK',
      photos: []
    },
    {
      name: 'Alcohol Swabs',
      barcode: '96385074',
      quantity: 200,
      minQuantity: 50,
      category: 'Supplies',
      location: 'Storage Room',
      notes: 'Individual packets',
      photos: []
    },
    {
      name: 'Sterile Gauze Pads',
      barcode: 'GAUZE-2024',
      quantity: 75,
      minQuantity: 25,
      category: 'First Aid',
      location: 'Shelf B',
      notes: '4x4 inch, individually wrapped',
      photos: []
    },
    {
      name: 'N95 Respirator Masks',
      barcode: 'MASK-N95-500',
      quantity: 3,
      minQuantity: 50,
      category: 'Supplies',
      location: 'Storage Room',
      notes: 'NIOSH approved - CRITICAL LOW STOCK',
      photos: []
    }
  ];

  try {
    // Dynamically import the database operations
    const { createItem } = await import('/src/lib/db/operations.js');

    console.log('📦 Creating items...');
    let successCount = 0;
    let errorCount = 0;

    for (const item of testData) {
      try {
        await createItem(item);
        successCount++;
        console.log(`✅ Created: ${item.name} (${item.barcode})`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to create ${item.name}:`, error);
      }
    }

    console.log('');
    console.log('🎉 Seeding complete!');
    console.log(`✅ Success: ${successCount} items`);
    console.log(`❌ Errors: ${errorCount} items`);
    console.log('');
    console.log('📊 Refresh the page to see the new items!');

    // Return summary
    return {
      success: successCount,
      errors: errorCount,
      total: testData.length
    };
  } catch (error) {
    console.error('❌ Fatal error during seeding:', error);
    throw error;
  }
})();
