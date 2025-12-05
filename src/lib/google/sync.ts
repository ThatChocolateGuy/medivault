/**
 * Sync Engine
 *
 * Coordinates two-way synchronization between local IndexedDB
 * and Google Workspace (Sheets + Drive).
 *
 * Features:
 * - Initial sync with direction choice
 * - Ongoing background sync
 * - Conflict resolution (last-write-wins by default)
 * - Offline queue processing
 * - Sync status tracking
 */

import { db, type InventoryItem, type Category, type Location } from '../db';
import {
  getOrCreateSpreadsheet,
  getRemoteItems,
  getRemoteCategories,
  getRemoteLocations,
  syncItemsToSheet,
  syncCategoriesToSheet,
  syncLocationsToSheet,
  updateMetadata,
  getMetadata,
  type SpreadsheetInfo,
  type SyncResult,
  type SyncConflict,
} from './sheets';
import {
  uploadPhotosForItem,
  downloadPhotos,
  getPhotosForItem,
  deletePhotosForItem,
  type DrivePhotoInfo,
} from './drive';
import { isSignedIn } from './oauth';

// Sync configuration
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const METADATA_KEYS = {
  LAST_SYNC: 'lastSyncAt',
  SYNC_VERSION: 'syncVersion',
  DEVICE_ID: 'deviceId',
};

/**
 * Sync direction for initial sync
 */
export type SyncDirection = 'cloudToDevice' | 'deviceToCloud' | 'merge';

/**
 * Sync status enum
 */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

/**
 * Sync state interface
 */
export interface SyncState {
  status: SyncStatus;
  lastSyncAt?: Date;
  spreadsheetInfo?: SpreadsheetInfo;
  error?: string;
  isOnline: boolean;
  pendingChanges: number;
}

/**
 * Initial sync options
 */
export interface InitialSyncOptions {
  direction: SyncDirection;
  spreadsheetId?: string;
}

/**
 * Sync event callback types
 */
export interface SyncEventCallbacks {
  onStatusChange?: (status: SyncStatus) => void;
  onProgress?: (progress: { phase: string; current: number; total: number }) => void;
  onConflict?: (conflicts: SyncConflict[]) => void;
  onComplete?: (result: SyncResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Generate a unique device ID for this installation
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('medivault_device_id');
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('medivault_device_id', deviceId);
  }
  return deviceId;
}

/**
 * Get the current sync state
 */
export async function getSyncState(): Promise<SyncState> {
  const settings = await db.settings.toCollection().first();
  const pendingOps = await db.syncQueue.where('status').equals('pending').count();

  return {
    status: 'idle',
    lastSyncAt: settings?.lastSyncAt,
    spreadsheetInfo: settings?.spreadsheetId
      ? {
          spreadsheetId: settings.spreadsheetId,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${settings.spreadsheetId}`,
        }
      : undefined,
    isOnline: navigator.onLine,
    pendingChanges: pendingOps,
  };
}

/**
 * Update sync state in the database
 */
async function updateSyncState(updates: Partial<{ lastSyncAt: Date; spreadsheetId: string }>): Promise<void> {
  const settings = await db.settings.toCollection().first();
  if (settings?.id) {
    await db.settings.update(settings.id, updates);
  }
}

/**
 * Compare items for conflict detection
 * Returns true if there's a conflict that needs resolution
 */
function hasConflict(local: InventoryItem, remote: Partial<InventoryItem>): boolean {
  if (!remote.updatedAt || !local.updatedAt) return false;

  const localTime = local.updatedAt.getTime();
  const remoteTime = new Date(remote.updatedAt).getTime();

  // If timestamps are within 1 second, consider them the same
  if (Math.abs(localTime - remoteTime) < 1000) return false;

  // Both modified since last sync - potential conflict
  return local.syncStatus === 'pending' && localTime !== remoteTime;
}

/**
 * Resolve conflict using last-write-wins strategy
 */
function resolveConflict(
  local: InventoryItem,
  remote: Partial<InventoryItem>,
  _strategy: 'lastWriteWins' | 'localWins' | 'remoteWins' = 'lastWriteWins'
): 'useLocal' | 'useRemote' {
  // For now, always use last-write-wins
  const localTime = local.updatedAt.getTime();
  const remoteTime = new Date(remote.updatedAt!).getTime();

  return localTime > remoteTime ? 'useLocal' : 'useRemote';
}

/**
 * Perform initial sync with specified direction
 */
export async function performInitialSync(
  options: InitialSyncOptions,
  callbacks?: SyncEventCallbacks
): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    success: false,
    itemsSynced: 0,
    categoriesSynced: 0,
    locationsSynced: 0,
    conflicts: [],
    errors: [],
    duration: 0,
  };

  try {
    callbacks?.onStatusChange?.('syncing');
    callbacks?.onProgress?.({ phase: 'Connecting to Google...', current: 0, total: 100 });

    if (!isSignedIn()) {
      throw new Error('Not signed in to Google. Please connect your account first.');
    }

    // Get or create spreadsheet
    callbacks?.onProgress?.({ phase: 'Setting up spreadsheet...', current: 10, total: 100 });
    const spreadsheet = await getOrCreateSpreadsheet();

    // Store spreadsheet ID
    await updateSyncState({ spreadsheetId: spreadsheet.spreadsheetId });

    switch (options.direction) {
      case 'deviceToCloud':
        await syncLocalToCloud(spreadsheet.spreadsheetId, callbacks);
        break;
      case 'cloudToDevice':
        await syncCloudToLocal(spreadsheet.spreadsheetId, callbacks);
        break;
      case 'merge':
        await mergeBidirectional(spreadsheet.spreadsheetId, result, callbacks);
        break;
    }

    // Update last sync timestamp
    const now = new Date();
    await updateSyncState({ lastSyncAt: now });
    await updateMetadata(spreadsheet.spreadsheetId, METADATA_KEYS.LAST_SYNC, now.toISOString());
    await updateMetadata(spreadsheet.spreadsheetId, METADATA_KEYS.DEVICE_ID, getDeviceId());

    // Count synced items
    const [items, categories, locations] = await Promise.all([
      db.items.count(),
      db.categories.count(),
      db.locations.count(),
    ]);

    result.itemsSynced = items;
    result.categoriesSynced = categories;
    result.locationsSynced = locations;
    result.success = true;

    callbacks?.onStatusChange?.('success');
    callbacks?.onComplete?.(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    callbacks?.onStatusChange?.('error');
    callbacks?.onError?.(error instanceof Error ? error : new Error(errorMessage));
  }

  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Sync all local data to cloud (overwrite remote)
 */
async function syncLocalToCloud(
  spreadsheetId: string,
  callbacks?: SyncEventCallbacks
): Promise<void> {
  callbacks?.onProgress?.({ phase: 'Loading local data...', current: 20, total: 100 });

  // Get all local data
  const [items, categories, locations] = await Promise.all([
    db.items.toArray(),
    db.categories.toArray(),
    db.locations.toArray(),
  ]);

  // Sync categories first (dependencies)
  callbacks?.onProgress?.({ phase: 'Syncing categories...', current: 30, total: 100 });
  await syncCategoriesToSheet(spreadsheetId, categories);

  // Sync locations
  callbacks?.onProgress?.({ phase: 'Syncing locations...', current: 40, total: 100 });
  await syncLocationsToSheet(spreadsheetId, locations);

  // Upload photos and sync items
  callbacks?.onProgress?.({ phase: 'Syncing items and photos...', current: 50, total: 100 });

  const itemsWithPhotoIds: InventoryItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    callbacks?.onProgress?.({
      phase: `Uploading photos for ${item.name}...`,
      current: 50 + Math.floor((i / items.length) * 40),
      total: 100,
    });

    // Upload photos if any
    if (item.photos && item.photos.length > 0 && item.id) {
      await uploadPhotosForItem(item.photos, item.id);
    }

    // Mark item as synced
    const syncedItem = { ...item, syncStatus: 'synced' as const };
    itemsWithPhotoIds.push(syncedItem);

    // Update local item status
    if (item.id) {
      await db.items.update(item.id, { syncStatus: 'synced', syncedAt: new Date() });
    }
  }

  await syncItemsToSheet(spreadsheetId, itemsWithPhotoIds);

  // Clear sync queue
  callbacks?.onProgress?.({ phase: 'Cleaning up...', current: 95, total: 100 });
  await db.syncQueue.where('status').equals('pending').modify({ status: 'completed' });

  callbacks?.onProgress?.({ phase: 'Complete!', current: 100, total: 100 });
}

/**
 * Sync all cloud data to local (overwrite local)
 */
async function syncCloudToLocal(
  spreadsheetId: string,
  callbacks?: SyncEventCallbacks
): Promise<void> {
  callbacks?.onProgress?.({ phase: 'Fetching remote data...', current: 20, total: 100 });

  // Get all remote data
  const [remoteItems, remoteCategories, remoteLocations] = await Promise.all([
    getRemoteItems(spreadsheetId),
    getRemoteCategories(spreadsheetId),
    getRemoteLocations(spreadsheetId),
  ]);

  // Clear local data and replace with remote
  callbacks?.onProgress?.({ phase: 'Updating categories...', current: 30, total: 100 });
  await db.categories.clear();
  if (remoteCategories.length > 0) {
    await db.categories.bulkAdd(
      remoteCategories.map((c) => ({
        name: c.name!,
        color: c.color,
        createdAt: c.createdAt || new Date(),
      }))
    );
  }

  callbacks?.onProgress?.({ phase: 'Updating locations...', current: 40, total: 100 });
  await db.locations.clear();
  if (remoteLocations.length > 0) {
    await db.locations.bulkAdd(
      remoteLocations.map((l) => ({
        name: l.name!,
        description: l.description,
        createdAt: l.createdAt || new Date(),
      }))
    );
  }

  callbacks?.onProgress?.({ phase: 'Updating items and downloading photos...', current: 50, total: 100 });
  await db.items.clear();

  for (let i = 0; i < remoteItems.length; i++) {
    const remoteItem = remoteItems[i];
    callbacks?.onProgress?.({
      phase: `Downloading photos for ${remoteItem.name}...`,
      current: 50 + Math.floor((i / remoteItems.length) * 40),
      total: 100,
    });

    // Download photos from Drive
    let photos: string[] = [];
    if (remoteItem.id) {
      const drivePhotos = await getPhotosForItem(remoteItem.id);
      if (drivePhotos.length > 0) {
        const photoIds = drivePhotos.map((p: DrivePhotoInfo) => p.fileId);
        photos = await downloadPhotos(photoIds);
      }
    }

    await db.items.add({
      name: remoteItem.name!,
      barcode: remoteItem.barcode,
      quantity: remoteItem.quantity ?? 0,
      minQuantity: remoteItem.minQuantity,
      category: remoteItem.category!,
      location: remoteItem.location!,
      notes: remoteItem.notes,
      photos,
      createdAt: remoteItem.createdAt || new Date(),
      updatedAt: remoteItem.updatedAt || new Date(),
      syncStatus: 'synced',
      syncedAt: new Date(),
    });
  }

  // Clear sync queue
  callbacks?.onProgress?.({ phase: 'Cleaning up...', current: 95, total: 100 });
  await db.syncQueue.clear();

  callbacks?.onProgress?.({ phase: 'Complete!', current: 100, total: 100 });
}

/**
 * Merge local and cloud data bidirectionally
 */
async function mergeBidirectional(
  spreadsheetId: string,
  result: SyncResult,
  callbacks?: SyncEventCallbacks
): Promise<void> {
  callbacks?.onProgress?.({ phase: 'Fetching remote data...', current: 20, total: 100 });

  // Get remote data
  const [remoteItems, remoteCategories, remoteLocations] = await Promise.all([
    getRemoteItems(spreadsheetId),
    getRemoteCategories(spreadsheetId),
    getRemoteLocations(spreadsheetId),
  ]);

  // Get local data
  const [localItems, localCategories, localLocations] = await Promise.all([
    db.items.toArray(),
    db.categories.toArray(),
    db.locations.toArray(),
  ]);

  callbacks?.onProgress?.({ phase: 'Merging categories...', current: 30, total: 100 });

  // Merge categories (by name)
  const mergedCategories = new Map<string, Category>();
  for (const cat of localCategories) {
    mergedCategories.set(cat.name.toLowerCase(), cat);
  }
  for (const remoteCat of remoteCategories) {
    if (!mergedCategories.has(remoteCat.name!.toLowerCase())) {
      mergedCategories.set(remoteCat.name!.toLowerCase(), {
        name: remoteCat.name!,
        color: remoteCat.color,
        createdAt: remoteCat.createdAt || new Date(),
      });
    }
  }

  // Update local categories
  await db.categories.clear();
  await db.categories.bulkAdd(Array.from(mergedCategories.values()));

  callbacks?.onProgress?.({ phase: 'Merging locations...', current: 40, total: 100 });

  // Merge locations (by name)
  const mergedLocations = new Map<string, Location>();
  for (const loc of localLocations) {
    mergedLocations.set(loc.name.toLowerCase(), loc);
  }
  for (const remoteLoc of remoteLocations) {
    if (!mergedLocations.has(remoteLoc.name!.toLowerCase())) {
      mergedLocations.set(remoteLoc.name!.toLowerCase(), {
        name: remoteLoc.name!,
        description: remoteLoc.description,
        createdAt: remoteLoc.createdAt || new Date(),
      });
    }
  }

  // Update local locations
  await db.locations.clear();
  await db.locations.bulkAdd(Array.from(mergedLocations.values()));

  callbacks?.onProgress?.({ phase: 'Merging items...', current: 50, total: 100 });

  // Merge items (by ID or name)
  const remoteItemMap = new Map<number, Partial<InventoryItem>>();
  const remoteItemByName = new Map<string, Partial<InventoryItem>>();

  for (const item of remoteItems) {
    if (item.id) remoteItemMap.set(item.id, item);
    if (item.name) remoteItemByName.set(item.name.toLowerCase(), item);
  }

  const conflicts: SyncConflict[] = [];
  const itemsToSync: InventoryItem[] = [];

  for (const localItem of localItems) {
    const remoteItem = localItem.id
      ? remoteItemMap.get(localItem.id)
      : remoteItemByName.get(localItem.name.toLowerCase());

    if (remoteItem) {
      // Item exists in both - check for conflicts
      if (hasConflict(localItem, remoteItem)) {
        const resolution = resolveConflict(localItem, remoteItem);
        if (resolution === 'useRemote') {
          // Download remote photos
          let photos = localItem.photos;
          if (remoteItem.id) {
            const drivePhotos = await getPhotosForItem(remoteItem.id);
            if (drivePhotos.length > 0) {
              photos = await downloadPhotos(drivePhotos.map((p: DrivePhotoInfo) => p.fileId));
            }
          }

          await db.items.update(localItem.id!, {
            ...remoteItem,
            photos,
            syncStatus: 'synced',
            syncedAt: new Date(),
          });
        } else {
          // Keep local, will be synced to cloud
          itemsToSync.push(localItem);
        }

        conflicts.push({
          entityType: 'item',
          entityId: localItem.id!,
          localData: localItem,
          remoteData: remoteItem,
          conflictType: 'both_modified',
        });
      } else if (localItem.syncStatus === 'pending') {
        // Local changes need to be synced
        itemsToSync.push(localItem);
      }

      remoteItemMap.delete(localItem.id!);
      remoteItemByName.delete(localItem.name.toLowerCase());
    } else {
      // Item only exists locally - sync to cloud
      itemsToSync.push(localItem);
    }
  }

  // Add items that only exist remotely
  for (const remoteItem of remoteItemMap.values()) {
    let photos: string[] = [];
    if (remoteItem.id) {
      const drivePhotos = await getPhotosForItem(remoteItem.id);
      if (drivePhotos.length > 0) {
        photos = await downloadPhotos(drivePhotos.map((p: DrivePhotoInfo) => p.fileId));
      }
    }

    await db.items.add({
      name: remoteItem.name!,
      barcode: remoteItem.barcode,
      quantity: remoteItem.quantity ?? 0,
      minQuantity: remoteItem.minQuantity,
      category: remoteItem.category!,
      location: remoteItem.location!,
      notes: remoteItem.notes,
      photos,
      createdAt: remoteItem.createdAt || new Date(),
      updatedAt: remoteItem.updatedAt || new Date(),
      syncStatus: 'synced',
      syncedAt: new Date(),
    });
  }

  result.conflicts = conflicts;
  if (conflicts.length > 0) {
    callbacks?.onConflict?.(conflicts);
  }

  callbacks?.onProgress?.({ phase: 'Uploading changes to cloud...', current: 70, total: 100 });

  // Upload local changes to cloud
  for (const item of itemsToSync) {
    if (item.photos && item.photos.length > 0 && item.id) {
      await uploadPhotosForItem(item.photos, item.id);
    }
    await db.items.update(item.id!, { syncStatus: 'synced', syncedAt: new Date() });
  }

  // Sync merged data to cloud
  callbacks?.onProgress?.({ phase: 'Syncing to cloud...', current: 85, total: 100 });

  const allItems = await db.items.toArray();
  await syncItemsToSheet(spreadsheetId, allItems);
  await syncCategoriesToSheet(spreadsheetId, Array.from(mergedCategories.values()));
  await syncLocationsToSheet(spreadsheetId, Array.from(mergedLocations.values()));

  // Clear sync queue
  callbacks?.onProgress?.({ phase: 'Cleaning up...', current: 95, total: 100 });
  await db.syncQueue.where('status').equals('pending').modify({ status: 'completed' });

  callbacks?.onProgress?.({ phase: 'Complete!', current: 100, total: 100 });
}

/**
 * Perform incremental sync (for ongoing background sync)
 */
export async function performIncrementalSync(callbacks?: SyncEventCallbacks): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    success: false,
    itemsSynced: 0,
    categoriesSynced: 0,
    locationsSynced: 0,
    conflicts: [],
    errors: [],
    duration: 0,
  };

  try {
    callbacks?.onStatusChange?.('syncing');

    if (!isSignedIn()) {
      throw new Error('Not signed in to Google');
    }

    if (!navigator.onLine) {
      callbacks?.onStatusChange?.('offline');
      result.errors.push('Device is offline');
      return result;
    }

    const state = await getSyncState();
    if (!state.spreadsheetInfo?.spreadsheetId) {
      throw new Error('No spreadsheet configured. Please perform initial sync first.');
    }

    const spreadsheetId = state.spreadsheetInfo.spreadsheetId;

    // Get pending sync operations
    const pendingOps = await db.syncQueue.where('status').equals('pending').toArray();

    if (pendingOps.length === 0) {
      // No local changes, just check for remote changes
      callbacks?.onProgress?.({ phase: 'Checking for remote changes...', current: 50, total: 100 });

      const remoteLastSync = await getMetadata(spreadsheetId, METADATA_KEYS.LAST_SYNC);
      if (remoteLastSync && state.lastSyncAt) {
        const remoteTime = new Date(remoteLastSync).getTime();
        const localTime = state.lastSyncAt.getTime();

        if (remoteTime > localTime) {
          // Remote has newer data, merge
          await mergeBidirectional(spreadsheetId, result, callbacks);
        }
      }
    } else {
      // Process pending operations
      callbacks?.onProgress?.({
        phase: 'Syncing local changes...',
        current: 30,
        total: 100,
      });

      // Get all local data
      const [items, categories, locations] = await Promise.all([
        db.items.toArray(),
        db.categories.toArray(),
        db.locations.toArray(),
      ]);

      // Upload pending item photos
      for (const item of items) {
        if (item.syncStatus === 'pending' && item.photos && item.photos.length > 0 && item.id) {
          // Delete old photos first
          const existingPhotos = await getPhotosForItem(item.id);
          if (existingPhotos.length > 0) {
            await deletePhotosForItem(existingPhotos.map((p: DrivePhotoInfo) => p.fileId));
          }
          await uploadPhotosForItem(item.photos, item.id);
        }
      }

      // Sync all data to sheets
      await syncItemsToSheet(spreadsheetId, items);
      await syncCategoriesToSheet(spreadsheetId, categories);
      await syncLocationsToSheet(spreadsheetId, locations);

      // Mark all items as synced
      await db.items.toCollection().modify({ syncStatus: 'synced', syncedAt: new Date() });

      // Mark sync operations as completed
      await db.syncQueue.where('status').equals('pending').modify({ status: 'completed' });

      result.itemsSynced = pendingOps.filter((op) => op.entityType === 'item').length;
      result.categoriesSynced = pendingOps.filter((op) => op.entityType === 'category').length;
      result.locationsSynced = pendingOps.filter((op) => op.entityType === 'location').length;
    }

    // Update last sync timestamp
    const now = new Date();
    await updateSyncState({ lastSyncAt: now });
    await updateMetadata(spreadsheetId, METADATA_KEYS.LAST_SYNC, now.toISOString());

    result.success = true;
    callbacks?.onStatusChange?.('success');
    callbacks?.onComplete?.(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    callbacks?.onStatusChange?.('error');
    callbacks?.onError?.(error instanceof Error ? error : new Error(errorMessage));
  }

  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Sync manager for background sync
 */
class SyncManager {
  private intervalId?: ReturnType<typeof setInterval>;
  private callbacks?: SyncEventCallbacks;

  /**
   * Start background sync
   */
  start(callbacks?: SyncEventCallbacks): void {
    this.callbacks = callbacks;

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Start periodic sync
    this.intervalId = setInterval(() => {
      this.sync();
    }, SYNC_INTERVAL_MS);

    console.log('🔄 Sync manager started');
  }

  /**
   * Stop background sync
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    console.log('⏹️ Sync manager stopped');
  }

  /**
   * Trigger immediate sync
   */
  async sync(): Promise<SyncResult | null> {
    if (!isSignedIn()) {
      return null;
    }

    return performIncrementalSync(this.callbacks);
  }

  private handleOnline = (): void => {
    console.log('📶 Device online, triggering sync...');
    this.sync();
  };

  private handleOffline = (): void => {
    console.log('📴 Device offline');
    this.callbacks?.onStatusChange?.('offline');
  };
}

// Export singleton instance
export const syncManager = new SyncManager();
