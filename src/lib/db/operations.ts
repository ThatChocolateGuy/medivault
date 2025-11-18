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
        item.barcode?.toLowerCase().includes(lowerQuery) ||
        item.category.toLowerCase().includes(lowerQuery) ||
        item.location.toLowerCase().includes(lowerQuery) ||
        item.notes?.toLowerCase().includes(lowerQuery)
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
  });

  // Add to sync queue
  await addToSyncQueue('item', id, 'create', item);

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
  await addToSyncQueue('item', id, 'update', updates);
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
