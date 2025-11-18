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
  data: any;
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
  // Check if already initialized
  const settingsCount = await db.settings.count();

  if (settingsCount === 0) {
    // Create default settings
    await db.settings.add({
      syncEnabled: false,
      lowStockAlerts: true,
    });

    // Add default categories
    const defaultCategories = [
      { name: 'Medications', color: '#3b82f6', createdAt: new Date() },
      { name: 'Supplies', color: '#10b981', createdAt: new Date() },
      { name: 'Equipment', color: '#f59e0b', createdAt: new Date() },
      { name: 'First Aid', color: '#ef4444', createdAt: new Date() },
    ];
    await db.categories.bulkAdd(defaultCategories);

    // Add default locations
    const defaultLocations = [
      { name: 'Shelf A', description: 'Top shelf', createdAt: new Date() },
      { name: 'Shelf B', description: 'Middle shelf', createdAt: new Date() },
      { name: 'Refrigerator', description: 'Temperature controlled', createdAt: new Date() },
      { name: 'Storage Room', description: 'Back storage', createdAt: new Date() },
    ];
    await db.locations.bulkAdd(defaultLocations);

    console.log('Database initialized with default data');
  }
}
