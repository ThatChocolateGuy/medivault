import Dexie, { type EntityTable } from 'dexie';

// Database schema types
export interface InventoryItem {
  id?: number;
  name: string;
  barcode?: string;
  quantity: number;
  minQuantity?: number;
  category: string;
  location: string;
  notes?: string;
  photos: string[]; // Array of base64 encoded images
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'synced' | 'pending' | 'error';
  syncedAt?: Date;
}

export interface Category {
  id?: number;
  name: string;
  color?: string;
  createdAt: Date;
}

export interface Location {
  id?: number;
  name: string;
  description?: string;
  createdAt: Date;
}

export interface SyncOperation {
  id?: number;
  entityType: 'item' | 'category' | 'location';
  entityId: number;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  attemptedAt?: Date;
}

export interface AppSettings {
  id?: number;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  spreadsheetId?: string;
  lastSyncAt?: Date;
  syncEnabled: boolean;
  lowStockAlerts: boolean;
}

// Database class
class InventoryDatabase extends Dexie {
  items!: EntityTable<InventoryItem, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  locations!: EntityTable<Location, 'id'>;
  syncQueue!: EntityTable<SyncOperation, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor() {
    super('MedicalInventoryDB');

    this.version(1).stores({
      items: '++id, name, barcode, category, location, quantity, syncStatus, createdAt, updatedAt',
      categories: '++id, name, createdAt',
      locations: '++id, name, createdAt',
      syncQueue: '++id, entityType, entityId, status, createdAt',
      settings: '++id',
    });
  }
}

// Create database instance
export const db = new InventoryDatabase();

// Initialize default data
export async function initializeDatabase() {
  // Check if already initialized by looking at categories (more reliable than settings)
  const categoriesCount = await db.categories.count();

  if (categoriesCount === 0) {
    // Add default categories only if they don't exist
    const defaultCategories = [
      { name: 'Medications', color: '#3b82f6', createdAt: new Date() },
      { name: 'Supplies', color: '#10b981', createdAt: new Date() },
      { name: 'Equipment', color: '#f59e0b', createdAt: new Date() },
      { name: 'First Aid', color: '#ef4444', createdAt: new Date() },
    ];

    try {
      await db.categories.bulkAdd(defaultCategories);
    } catch (error) {
      // Ignore duplicate key errors (race condition from React StrictMode)
      console.log('Categories already exist, skipping initialization');
    }
  }

  // Check and add locations separately
  const locationsCount = await db.locations.count();
  if (locationsCount === 0) {
    const defaultLocations = [
      { name: 'Shelf A', description: 'Top shelf', createdAt: new Date() },
      { name: 'Shelf B', description: 'Middle shelf', createdAt: new Date() },
      { name: 'Refrigerator', description: 'Temperature controlled', createdAt: new Date() },
      { name: 'Storage Room', description: 'Back storage', createdAt: new Date() },
    ];

    try {
      await db.locations.bulkAdd(defaultLocations);
    } catch (error) {
      // Ignore duplicate key errors
      console.log('Locations already exist, skipping initialization');
    }
  }

  // Initialize settings if needed
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    try {
      await db.settings.add({
        syncEnabled: false,
        lowStockAlerts: true,
      });
    } catch (error) {
      // Ignore duplicate key errors
      console.log('Settings already exist, skipping initialization');
    }
  }

  console.log('Database initialized with default data');
}

// Utility function to remove duplicate categories and locations
export async function deduplicateDatabase() {
  // Deduplicate categories
  const allCategories = await db.categories.toArray();
  const uniqueCategories = new Map<string, Category>();

  for (const cat of allCategories) {
    if (!uniqueCategories.has(cat.name)) {
      uniqueCategories.set(cat.name, cat);
    }
  }

  if (uniqueCategories.size < allCategories.length) {
    await db.categories.clear();
    await db.categories.bulkAdd(Array.from(uniqueCategories.values()));
    console.log(`Removed ${allCategories.length - uniqueCategories.size} duplicate categories`);
  }

  // Deduplicate locations
  const allLocations = await db.locations.toArray();
  const uniqueLocations = new Map<string, Location>();

  for (const loc of allLocations) {
    if (!uniqueLocations.has(loc.name)) {
      uniqueLocations.set(loc.name, loc);
    }
  }

  if (uniqueLocations.size < allLocations.length) {
    await db.locations.clear();
    await db.locations.bulkAdd(Array.from(uniqueLocations.values()));
    console.log(`Removed ${allLocations.length - uniqueLocations.size} duplicate locations`);
  }
}
