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

  // Update the category
  await db.categories.update(id, {
    ...(updates.name !== undefined && { name: newName }),
    ...(updates.color !== undefined && { color: updates.color }),
  });

  // If name changed, update all items using the old category name
  if (newName !== oldName) {
    const itemsUpdated = await db.items
      .where('category').equals(oldName)
      .modify({ category: newName });
    if (process.env.NODE_ENV === 'development') {
      console.log(`Updated ${itemsUpdated} items from category "${oldName}" to "${newName}"`);
    }
  }
}

export async function deleteCategory(id: number) {
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
  await addToSyncQueue({
    type: 'category',
    action: 'delete',
    data: { id, name: category.name }
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

  // Update the location
  await db.locations.update(id, {
    ...(updates.name !== undefined && { name: newName }),
    ...(updates.description !== undefined && { description: trimmedDescription }),
  });

  // If name changed, update all items using the old location name
  if (newName !== oldName) {
    const itemsUpdated = await db.items
      .where('location').equals(oldName)
      .modify({ location: newName });
    console.log(`Updated ${itemsUpdated} items from location "${oldName}" to "${newName}"`);
  }
}

export async function deleteLocation(id: number) {
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
