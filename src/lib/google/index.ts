/**
 * Google Workspace Integration Module
 *
 * Provides OAuth authentication and two-way sync with Google Sheets and Drive.
 *
 * Usage:
 * 1. Call initiateOAuthFlow() to start sign-in
 * 2. Handle callback with handleOAuthCallback()
 * 3. Use performInitialSync() for first sync
 * 4. Use syncManager for ongoing background sync
 */

// OAuth exports
export {
  initiateOAuthFlow,
  handleOAuthCallback,
  refreshAccessToken,
  getValidAccessToken,
  revokeGoogleAccess,
  isSignedIn,
  hasStoredTokens,
  getStoredTokens,
  OAuthError,
  type GoogleTokens,
} from './oauth';

// Google Sheets exports
export {
  getOrCreateSpreadsheet,
  findExistingSpreadsheet,
  createSpreadsheet,
  getRemoteItems,
  getRemoteCategories,
  getRemoteLocations,
  syncItemsToSheet,
  syncCategoriesToSheet,
  syncLocationsToSheet,
  SheetsApiError,
  type SpreadsheetInfo,
  type SyncResult,
  type SyncConflict,
} from './sheets';

// Google Drive exports
export {
  getOrCreateRootFolder,
  getOrCreatePhotosFolder,
  uploadPhoto,
  uploadPhotosForItem,
  downloadPhoto,
  downloadPhotos,
  deletePhoto,
  deletePhotosForItem,
  listAllPhotos,
  getPhotosForItem,
  getStorageQuota,
  DriveApiError,
  type DrivePhotoInfo,
} from './drive';

// Sync engine exports
export {
  getSyncState,
  performInitialSync,
  performIncrementalSync,
  syncManager,
  type SyncDirection,
  type SyncStatus,
  type SyncState,
  type InitialSyncOptions,
  type SyncEventCallbacks,
} from './sync';
