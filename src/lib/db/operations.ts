import { db, type InventoryItem } from './index';

// Item operations
export async function getAllItems(): Promise<InventoryItem[]> {
  return await db.items.orderBy('updatedAt').reverse().toArray();
}

export async function getItemById(id: number): Promise<InventoryItem | undefined> {
  return await db.items.get(id);
}

export async function getItemByBarcode(barcode: string): Promise<InventoryItem | undefined> {
  return await db.items.where('barcode').equals(barcode).first();
}

export async function searchItems(query: string): Promise<InventoryItem[]> {
  const lowerQuery = query.toLowerCase();
  return await db.items
    .filter(
      (item) =>
        item.name.toLowerCase().includes(lowerQuery) ||
        (item.barcode?.toLowerCase().includes(lowerQuery) ?? false) ||
        item.category.toLowerCase().includes(lowerQuery) ||
        item.location.toLowerCase().includes(lowerQuery) ||
        (item.notes?.toLowerCase().includes(lowerQuery) ?? false)
    )
    .toArray();
}

export async function createItem(
  item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>
): Promise<number> {
  const now = new Date();
  const id = await db.items.add({
    ...item,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
  }) as number;

  // Add to sync queue
  await addToSyncQueue('item', id, 'create', item as unknown as Record<string, unknown>);

  return id;
}

export async function updateItem(
  id: number,
  updates: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>
): Promise<void> {
  await db.items.update(id, {
    ...updates,
    updatedAt: new Date(),
    syncStatus: 'pending',
  });

  // Add to sync queue
  await addToSyncQueue('item', id, 'update', updates as unknown as Record<string, unknown>);
}

export async function deleteItem(id: number): Promise<void> {
  await db.items.delete(id);

  // Add to sync queue
  await addToSyncQueue('item', id, 'delete', { id });
}

export async function adjustQuantity(id: number, delta: number): Promise<void> {
  const item = await db.items.get(id);
  if (!item) throw new Error('Item not found');

  const newQuantity = Math.max(0, item.quantity + delta);
  await updateItem(id, { quantity: newQuantity });
}

// Category operations
export async function getAllCategories() {
  return await db.categories.orderBy('name').toArray();
}

export async function createCategory(name: string, color?: string) {
  return await db.categories.add({
    name,
    color,
    createdAt: new Date(),
  });
}

// Location operations
export async function getAllLocations() {
  return await db.locations.orderBy('name').toArray();
}

export async function createLocation(name: string, description?: string) {
  return await db.locations.add({
    name,
    description,
    createdAt: new Date(),
  });
}

export async function getCategoryById(id: number) {
  return await db.categories.get(id);
}

export async function updateCategory(id: number, updates: { name?: string; color?: string }) {
  const trimmedName = updates.name?.trim();

  // Validate name if provided
  if (trimmedName !== undefined) {
    if (!trimmedName) {
      throw new Error('Category name cannot be empty');
    }
    if (trimmedName.length > 50) {
      throw new Error('Category name must be 50 characters or less');
    }
  }

  // Validate color if provided
  if (updates.color && !/^#[0-9A-Fa-f]{6}$/.test(updates.color)) {
    throw new Error('Invalid color format. Use hex format like #3b82f6');
  }

  const category = await db.categories.get(id);
  if (!category) throw new Error('Category not found');

  const oldName = category.name;
  const newName = trimmedName || oldName;

  // Check for duplicate name (case-insensitive, excluding current category)
  if (trimmedName && trimmedName !== oldName) {
    const duplicate = await db.categories
      .filter(c => c.name.toLowerCase() === trimmedName.toLowerCase() && c.id !== id)
      .first();
    if (duplicate) {
      throw new Error('A category with this name already exists');
    }
  }

  // Update the category and items in a transaction
  await db.transaction('rw', db.categories, db.items, db.syncQueue, async () => {
    await db.categories.update(id, {
      ...(updates.name !== undefined && { name: newName }),
      ...(updates.color !== undefined && { color: updates.color }),
    });

    // If name changed, update all items using the old category name
    if (newName !== oldName) {
      const itemsUpdated = await db.items
        .where('category').equals(oldName)
        .modify({ category: newName });
      if (import.meta.env.DEV) {
        console.log(`Updated ${itemsUpdated} items from category "${oldName}" to "${newName}"`);
      }
    }

    // Add to sync queue to track category update
    await addToSyncQueue('category', id, 'update', {
      id,
      oldName,
      newName,
      ...(updates.color !== undefined && { color: updates.color }),
    });
  });
}

export async function deleteCategory(id: number) {
  await db.transaction('rw', db.categories, db.items, db.syncQueue, async () => {
    const category = await db.categories.get(id);
    if (!category) throw new Error('Category not found');

    // Check if category is in use
    const itemCount = await db.items.where('category').equals(category.name).count();
    if (itemCount > 0) {
      throw new Error(`Cannot delete category. ${itemCount} item(s) are using it.`);
    }

    // Check if it's the last category
    const totalCategories = await db.categories.count();
    if (totalCategories <= 1) {
      throw new Error('Cannot delete the last category');
    }

    await db.categories.delete(id);
    // Add to sync queue to track category deletion
    await addToSyncQueue('category', id, 'delete', { id, name: category.name });
  });
}

export async function checkCategoryInUse(name: string): Promise<{ inUse: boolean; count: number }> {
  const count = await db.items.where('category').equals(name).count();
  return { inUse: count > 0, count };
}

export async function getLocationById(id: number) {
  return await db.locations.get(id);
}

export async function updateLocation(id: number, updates: { name?: string; description?: string }) {
  const trimmedName = updates.name?.trim();
  const trimmedDescription = updates.description?.trim();

  // Validate name if provided
  if (trimmedName !== undefined) {
    if (!trimmedName) {
      throw new Error('Location name cannot be empty');
    }
    if (trimmedName.length > 50) {
      throw new Error('Location name must be 50 characters or less');
    }
  }

  // Validate description if provided
  if (trimmedDescription && trimmedDescription.length > 200) {
    throw new Error('Description must be 200 characters or less');
  }

  const location = await db.locations.get(id);
  if (!location) throw new Error('Location not found');

  const oldName = location.name;
  const newName = trimmedName || oldName;

  // Check for duplicate name (case-insensitive, excluding current location)
  if (trimmedName && trimmedName !== oldName) {
    const duplicate = await db.locations
      .filter(l => l.name.toLowerCase() === trimmedName.toLowerCase() && l.id !== id)
      .first();
    if (duplicate) {
      throw new Error('A location with this name already exists');
    }
  }

  // Update the location and items in a transaction
  let itemsUpdated = 0;
  await db.transaction('rw', db.locations, db.items, db.syncQueue, async () => {
    await db.locations.update(id, {
      ...(updates.name !== undefined && { name: newName }),
      ...(updates.description !== undefined && { description: trimmedDescription }),
    });

    // If name changed, update all items using the old location name
    if (newName !== oldName) {
      itemsUpdated = await db.items
        .where('location').equals(oldName)
        .modify({ location: newName });
    }

    // Add to sync queue to track location update
    await addToSyncQueue('location', id, 'update', {
      id,
      oldName,
      newName,
      ...(updates.description !== undefined && { description: trimmedDescription }),
    });
  });
  if (newName !== oldName) {
    if (import.meta.env.DEV) {
      console.log(`Updated ${itemsUpdated} items from location "${oldName}" to "${newName}"`);
    }
  }
}

export async function deleteLocation(id: number) {
  await db.transaction('rw', db.locations, db.items, db.syncQueue, async () => {
    const location = await db.locations.get(id);
    if (!location) throw new Error('Location not found');

    // Check if location is in use
    const itemCount = await db.items.where('location').equals(location.name).count();
    if (itemCount > 0) {
      throw new Error(`Cannot delete location. ${itemCount} item(s) are using it.`);
    }

    // Check if it's the last location
    const totalLocations = await db.locations.count();
    if (totalLocations <= 1) {
      throw new Error('Cannot delete the last location');
    }

    await db.locations.delete(id);
    // Add to sync queue to track location deletion
    await addToSyncQueue('location', id, 'delete', { id, name: location.name });
  });
}

export async function checkLocationInUse(name: string): Promise<{ inUse: boolean; count: number }> {
  const count = await db.items.where('location').equals(name).count();
  return { inUse: count > 0, count };
}

// Low stock items
export async function getLowStockItems(): Promise<InventoryItem[]> {
  return await db.items
    .filter((item) => item.minQuantity !== undefined && item.quantity <= item.minQuantity)
    .toArray();
}

// Statistics
export async function getInventoryStats() {
  const totalItems = await db.items.count();
  const lowStockItems = await getLowStockItems();
  const totalQuantity = await db.items.toArray().then((items) =>
    items.reduce((sum, item) => sum + item.quantity, 0)
  );

  return {
    totalItems,
    lowStockCount: lowStockItems.length,
    totalQuantity,
  };
}

// Sync queue operations
async function addToSyncQueue(
  entityType: 'item' | 'category' | 'location',
  entityId: number,
  operation: 'create' | 'update' | 'delete',
  data: Record<string, unknown>
): Promise<void> {
  await db.syncQueue.add({
    entityType,
    entityId,
    operation,
    data,
    status: 'pending',
    createdAt: new Date(),
  });
}

export async function getPendingSyncOperations() {
  return await db.syncQueue.where('status').equals('pending').toArray();
}

export async function markSyncOperationComplete(id: number): Promise<void> {
  await db.syncQueue.update(id, { status: 'completed' });
}

export async function markSyncOperationFailed(id: number, error: string): Promise<void> {
  await db.syncQueue.update(id, {
    status: 'failed',
    error,
    attemptedAt: new Date(),
  });
}

// Import operations

/**
 * Import options for controlling import behavior
 */
export interface ImportOptions {
  duplicateStrategy: 'skip' | 'overwrite' | 'rename';
  createMissingCategories: boolean;
  createMissingLocations: boolean;
  preserveIds: boolean;
}

/**
 * Result of an import operation
 */
export interface ImportResult {
  success: boolean;
  itemsImported: number;
  itemsSkipped: number;
  itemsOverwritten: number;
  itemsRenamed: number;
  categoriesCreated: number;
  locationsCreated: number;
  errors: string[];
  warnings: string[];
  duration: number;
}

/**
 * Check if an item already exists in the database
 * Returns match information if found
 */
export async function checkItemExists(
  item: Partial<InventoryItem>
): Promise<{ exists: boolean; existingId?: number; matchType?: 'id' | 'name' | 'barcode' }> {
  // Check by ID if present
  if (item.id) {
    const existingItem = await db.items.get(item.id);
    if (existingItem) {
      return { exists: true, existingId: existingItem.id, matchType: 'id' };
    }
  }

  // Check by barcode if present
  if (item.barcode) {
    const existingItem = await db.items.where('barcode').equals(item.barcode).first();
    if (existingItem) {
      return { exists: true, existingId: existingItem.id, matchType: 'barcode' };
    }
  }

  // Check by name (case-insensitive)
  if (item.name) {
    const existingItem = await db.items
      .filter((i) => i.name.toLowerCase() === item.name!.toLowerCase())
      .first();
    if (existingItem) {
      return { exists: true, existingId: existingItem.id, matchType: 'name' };
    }
  }

  return { exists: false };
}

/**
 * Generates a unique item name by appending a number
 * e.g., "Aspirin" -> "Aspirin (2)"
 */
function generateUniqueItemName(baseName: string, existingNames: Set<string>): string {
  let counter = 2;
  let newName = `${baseName} (${counter})`;

  while (existingNames.has(newName.toLowerCase())) {
    counter++;
    newName = `${baseName} (${counter})`;
  }

  return newName;
}

/**
 * Bulk create categories from an array of category names
 * Returns the number of categories created
 */
async function bulkCreateCategories(categoryNames: string[]): Promise<number> {
  if (categoryNames.length === 0) return 0;

  const existingCategories = await db.categories.toArray();
  const existingNames = new Set(existingCategories.map((c) => c.name.toLowerCase()));

  const newCategories = categoryNames
    .filter((name) => !existingNames.has(name.toLowerCase()))
    .map((name) => ({
      name: name.trim(), // Remove any whitespace to ensure clean category names
      color: '#6b7280', // Default gray color
      createdAt: new Date(),
    }));

  if (newCategories.length > 0) {
    await db.categories.bulkAdd(newCategories);
  }

  return newCategories.length;
}

/**
 * Bulk create locations from an array of location names
 * Returns the number of locations created
 */
async function bulkCreateLocations(locationNames: string[]): Promise<number> {
  if (locationNames.length === 0) return 0;

  const existingLocations = await db.locations.toArray();
  const existingNames = new Set(existingLocations.map((l) => l.name.toLowerCase()));

  const newLocations = locationNames
    .filter((name) => !existingNames.has(name.toLowerCase()))
    .map((name) => ({
      name: name.trim(), // Remove any whitespace to ensure clean location names
      description: '',
      createdAt: new Date(),
    }));

  if (newLocations.length > 0) {
    await db.locations.bulkAdd(newLocations);
  }

  return newLocations.length;
}

/**
 * Import inventory items with transaction support and rollback on error
 * Handles duplicates according to the specified strategy
 * Creates missing categories/locations if configured
 */
export async function importItems(
  items: Partial<InventoryItem>[],
  options: ImportOptions
): Promise<ImportResult> {
  const startTime = Date.now();
  const result: ImportResult = {
    success: false,
    itemsImported: 0,
    itemsSkipped: 0,
    itemsOverwritten: 0,
    itemsRenamed: 0,
    categoriesCreated: 0,
    locationsCreated: 0,
    errors: [],
    warnings: [],
    duration: 0,
  };

  try {
    // Validate all items have required fields
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name || !item.category || !item.location) {
        result.errors.push(
          `Item ${i + 1}: Missing required fields (name, category, or location)`
        );
      }
      if (item.quantity === undefined || item.quantity < 0) {
        result.errors.push(`Item ${i + 1} (${item.name}): Invalid quantity`);
      }
    }

    if (result.errors.length > 0) {
      throw new Error(`Validation failed: ${result.errors.length} error(s)`);
    }

    // Perform import in a transaction for atomicity
    await db.transaction('rw', db.items, db.categories, db.locations, db.syncQueue, async () => {
      // Step 1: Create missing categories if configured
      if (options.createMissingCategories) {
        const uniqueCategories = [...new Set(items.map((i) => i.category!))];
        result.categoriesCreated = await bulkCreateCategories(uniqueCategories);
      } else {
        // Validate all categories exist
        const existingCategories = await db.categories.toArray();
        const existingCategoryNames = new Set(existingCategories.map((c) => c.name));
        const missingCategories = items
          .map((i) => i.category!)
          .filter((c) => !existingCategoryNames.has(c));
        if (missingCategories.length > 0) {
          throw new Error(
            `Missing categories: ${[...new Set(missingCategories)].join(', ')}. ` +
              `Enable "Create missing categories" to add them automatically.`
          );
        }
      }

      // Step 2: Create missing locations if configured
      if (options.createMissingLocations) {
        const uniqueLocations = [...new Set(items.map((i) => i.location!))];
        result.locationsCreated = await bulkCreateLocations(uniqueLocations);
      } else {
        // Validate all locations exist
        const existingLocations = await db.locations.toArray();
        const existingLocationNames = new Set(existingLocations.map((l) => l.name));
        const missingLocations = items
          .map((i) => i.location!)
          .filter((l) => !existingLocationNames.has(l));
        if (missingLocations.length > 0) {
          throw new Error(
            `Missing locations: ${[...new Set(missingLocations)].join(', ')}. ` +
              `Enable "Create missing locations" to add them automatically.`
          );
        }
      }

      // Step 3: Build set of existing item names for rename strategy
      const existingItems = await db.items.toArray();
      const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase()));

      // Step 4: Process each item according to duplicate strategy
      for (const item of items) {
        const existenceCheck = await checkItemExists(item);

        if (existenceCheck.exists) {
          // Handle duplicate
          switch (options.duplicateStrategy) {
            case 'skip':
              result.itemsSkipped++;
              break;

            case 'overwrite':
              // Update existing item, preserving photos if not provided in import
              if (existenceCheck.existingId) {
                const now = new Date();
                const existingItem = await db.items.get(existenceCheck.existingId);

                await db.items.update(existenceCheck.existingId, {
                  name: item.name!,
                  barcode: item.barcode,
                  quantity: item.quantity!,
                  minQuantity: item.minQuantity,
                  category: item.category!,
                  location: item.location!,
                  notes: item.notes,
                  // Preserve existing photos if import doesn't have any (CSV-only import)
                  // Only update photos if import explicitly provides them (ZIP import)
                  photos: item.photos !== undefined ? item.photos : (existingItem?.photos || []),
                  updatedAt: item.updatedAt || now,
                  syncStatus: 'pending',
                });

                await addToSyncQueue('item', existenceCheck.existingId, 'update', {
                  ...(item as Record<string, unknown>),
                  source: 'import',
                });

                result.itemsOverwritten++;
              }
              break;

            case 'rename': {
              // Generate unique name and create new item
              const uniqueName = generateUniqueItemName(item.name!, existingNames);
              existingNames.add(uniqueName.toLowerCase());

              const now = new Date();
              const renamedItem = {
                name: uniqueName,
                barcode: item.barcode,
                quantity: item.quantity!,
                minQuantity: item.minQuantity,
                category: item.category!,
                location: item.location!,
                notes: item.notes,
                photos: item.photos || [],
                createdAt: item.createdAt || now,
                updatedAt: item.updatedAt || now,
                syncStatus: 'pending' as const,
              };

              const newId = (await db.items.add(renamedItem)) as number;

              await addToSyncQueue('item', newId, 'create', {
                ...(renamedItem as unknown as Record<string, unknown>),
                source: 'import',
              });

              result.itemsRenamed++;
              break;
            }
          }
        } else {
          // New item - add to database
          const now = new Date();
          const newItem = {
            name: item.name!,
            barcode: item.barcode,
            quantity: item.quantity!,
            minQuantity: item.minQuantity,
            category: item.category!,
            location: item.location!,
            notes: item.notes,
            photos: item.photos || [],
            createdAt: item.createdAt || now,
            updatedAt: item.updatedAt || now,
            syncStatus: 'pending' as const,
          };

          // If preserveIds is true and item has an ID, try to use it
          let newId: number;
          if (options.preserveIds && item.id) {
            try {
              newId = (await db.items.add({ ...newItem, id: item.id })) as number;
            } catch {
              // If ID already exists, let Dexie auto-generate a new one
              newId = (await db.items.add(newItem)) as number;
              result.warnings.push(
                `Item "${item.name}" ID ${item.id} already exists, assigned new ID ${newId}`
              );
            }
          } else {
            newId = (await db.items.add(newItem)) as number;
          }

          existingNames.add(newItem.name.toLowerCase());

          await addToSyncQueue('item', newId, 'create', {
            ...(newItem as unknown as Record<string, unknown>),
            source: 'import',
          });

          result.itemsImported++;
        }
      }
    });

    // Transaction completed successfully
    result.success = true;
  } catch (error) {
    // Transaction rolled back automatically
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    result.success = false;
  }

  result.duration = Date.now() - startTime;
  return result;
}

// Data management operations

/**
 * Clear all inventory items from the database
 * Preserves categories and locations to keep the app functional
 * Clears the sync queue as well since all items are deleted
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.items, db.syncQueue], async () => {
    await db.items.clear();
    await db.syncQueue.clear();
  });
}
