/**
 * Google Drive API Service
 *
 * Handles photo storage for MediVault inventory items.
 * Uses the Google Drive API to store photos in a dedicated folder.
 *
 * Strategy: Hybrid approach
 * - Metadata stored in Google Sheets (photo references)
 * - Actual photo files stored in Google Drive
 *
 * Benefits:
 * - Better storage organization
 * - Unlimited photo size (within Drive quota)
 * - Better offline sync support
 * - Photos remain accessible even if app is uninstalled
 */

import { getValidAccessToken } from './oauth';

// Google Drive API base URL
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

// Folder names
const ROOT_FOLDER_NAME = 'MediVault';
const PHOTOS_FOLDER_NAME = 'Photos';

/**
 * Error type for Drive API operations
 */
export type DriveApiErrorCode =
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'QUOTA_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'UPLOAD_FAILED';

export class DriveApiError extends Error {
  code: DriveApiErrorCode;

  constructor(message: string, code: DriveApiErrorCode) {
    super(message);
    this.name = 'DriveApiError';
    this.code = code;
  }
}

/**
 * Photo file info stored in Drive
 */
export interface DrivePhotoInfo {
  fileId: string;
  name: string;
  webContentLink?: string;
  thumbnailLink?: string;
  mimeType: string;
  size: number;
}

/**
 * Folder info
 */
interface FolderInfo {
  folderId: string;
  name: string;
}

/**
 * Make an authenticated request to Google Drive API
 */
async function driveRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await getValidAccessToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new DriveApiError('File or folder not found', 'NOT_FOUND');
    }
    if (response.status === 403) {
      const data = await response.json().catch(() => ({}));
      if (data.error?.errors?.[0]?.reason === 'storageQuotaExceeded') {
        throw new DriveApiError('Google Drive storage quota exceeded', 'QUOTA_EXCEEDED');
      }
      throw new DriveApiError('Permission denied', 'PERMISSION_DENIED');
    }

    const errorData = await response.json().catch(() => ({}));
    throw new DriveApiError(
      `API request failed: ${errorData.error?.message || response.statusText}`,
      'INVALID_RESPONSE'
    );
  }

  return response.json();
}

/**
 * Search for a folder by name
 */
async function findFolder(name: string, parentId?: string): Promise<FolderInfo | null> {
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
  const data = await driveRequest<{ files: Array<{ id: string; name: string }> }>(url);

  if (data.files && data.files.length > 0) {
    return {
      folderId: data.files[0].id,
      name: data.files[0].name,
    };
  }

  return null;
}

/**
 * Create a folder in Google Drive
 */
async function createFolder(name: string, parentId?: string): Promise<FolderInfo> {
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const url = `${DRIVE_API_BASE}/files`;
  const data = await driveRequest<{ id: string; name: string }>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  return {
    folderId: data.id,
    name: data.name,
  };
}

/**
 * Get or create the MediVault root folder
 */
export async function getOrCreateRootFolder(): Promise<FolderInfo> {
  const existing = await findFolder(ROOT_FOLDER_NAME);
  if (existing) {
    return existing;
  }

  console.log('📁 Creating MediVault root folder in Drive');
  return createFolder(ROOT_FOLDER_NAME);
}

/**
 * Get or create the Photos subfolder
 */
export async function getOrCreatePhotosFolder(): Promise<FolderInfo> {
  const rootFolder = await getOrCreateRootFolder();
  const existing = await findFolder(PHOTOS_FOLDER_NAME, rootFolder.folderId);

  if (existing) {
    return existing;
  }

  console.log('📁 Creating Photos folder in Drive');
  return createFolder(PHOTOS_FOLDER_NAME, rootFolder.folderId);
}

/**
 * Upload a photo to Google Drive
 * Accepts base64 data URL and uploads using multipart request with base64 transfer encoding
 */
export async function uploadPhoto(
  base64DataUrl: string,
  fileName: string,
  itemId: number
): Promise<DrivePhotoInfo> {
  const accessToken = await getValidAccessToken();
  const photosFolder = await getOrCreatePhotosFolder();

  // Parse base64 data URL
  const matches = base64DataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    throw new DriveApiError('Invalid base64 data URL', 'UPLOAD_FAILED');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];

  // Generate unique filename with item ID prefix
  const uniqueFileName = `item-${itemId}-${Date.now()}-${fileName}`;

  // Calculate approximate file size from base64 (for return value)
  const approximateSize = Math.floor((base64Data.length * 3) / 4);

  // Create file metadata
  const metadata = {
    name: uniqueFileName,
    parents: [photosFolder.folderId],
    mimeType,
  };

  // Use multipart upload with base64 transfer encoding (efficient for Drive API)
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata);

  // Build multipart body - using base64 transfer encoding directly avoids costly conversion
  const bodyParts = [metadataPart, delimiter + `Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n` + base64Data + closeDelimiter];

  const response = await fetch(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,webContentLink,thumbnailLink,mimeType,size`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: bodyParts.join(''),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new DriveApiError(
      `Photo upload failed: ${errorData.error?.message || response.statusText}`,
      'UPLOAD_FAILED'
    );
  }

  const data = await response.json();

  console.log(`✅ Uploaded photo: ${uniqueFileName}`);

  return {
    fileId: data.id,
    name: data.name,
    webContentLink: data.webContentLink,
    thumbnailLink: data.thumbnailLink,
    mimeType: data.mimeType,
    size: parseInt(data.size) || approximateSize,
  };
}

/**
 * Upload multiple photos for an item
 */
export async function uploadPhotosForItem(
  photos: string[],
  itemId: number
): Promise<DrivePhotoInfo[]> {
  const uploadedPhotos: DrivePhotoInfo[] = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const fileName = `photo-${i + 1}.jpg`;

    try {
      const uploadedPhoto = await uploadPhoto(photo, fileName, itemId);
      uploadedPhotos.push(uploadedPhoto);
    } catch (error) {
      console.error(`❌ Failed to upload photo ${i + 1} for item ${itemId}:`, error);
      // Continue with other photos even if one fails
    }
  }

  return uploadedPhotos;
}

/**
 * Download a photo from Google Drive
 * Returns base64 data URL
 */
export async function downloadPhoto(fileId: string): Promise<string> {
  const accessToken = await getValidAccessToken();

  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new DriveApiError('Failed to download photo', 'NOT_FOUND');
  }

  const blob = await response.blob();

  // Convert blob to base64 data URL
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new DriveApiError('Failed to convert photo to base64', 'INVALID_RESPONSE'));
      }
    };
    reader.onerror = () => reject(new DriveApiError('Failed to read photo data', 'INVALID_RESPONSE'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Download multiple photos by file IDs
 */
export async function downloadPhotos(fileIds: string[]): Promise<string[]> {
  const photos: string[] = [];

  for (const fileId of fileIds) {
    try {
      const photo = await downloadPhoto(fileId);
      photos.push(photo);
    } catch (error) {
      console.error(`❌ Failed to download photo ${fileId}:`, error);
      // Continue with other photos even if one fails
    }
  }

  return photos;
}

/**
 * Delete a photo from Google Drive
 */
export async function deletePhoto(fileId: string): Promise<void> {
  const accessToken = await getValidAccessToken();

  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new DriveApiError('Failed to delete photo', 'INVALID_RESPONSE');
  }

  console.log(`✅ Deleted photo: ${fileId}`);
}

/**
 * Delete all photos for an item
 */
export async function deletePhotosForItem(fileIds: string[]): Promise<void> {
  for (const fileId of fileIds) {
    try {
      await deletePhoto(fileId);
    } catch (error) {
      console.error(`❌ Failed to delete photo ${fileId}:`, error);
    }
  }
}

/**
 * List all photos in the MediVault Photos folder
 */
export async function listAllPhotos(): Promise<DrivePhotoInfo[]> {
  const photosFolder = await getOrCreatePhotosFolder();

  const query = `'${photosFolder.folderId}' in parents and trashed=false`;
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,webContentLink,thumbnailLink,mimeType,size)&pageSize=1000`;

  const data = await driveRequest<{
    files: Array<{
      id: string;
      name: string;
      webContentLink?: string;
      thumbnailLink?: string;
      mimeType: string;
      size: string;
    }>;
  }>(url);

  return data.files.map((file) => ({
    fileId: file.id,
    name: file.name,
    webContentLink: file.webContentLink,
    thumbnailLink: file.thumbnailLink,
    mimeType: file.mimeType,
    size: parseInt(file.size) || 0,
  }));
}

/**
 * Get photos for a specific item by item ID prefix
 */
export async function getPhotosForItem(itemId: number): Promise<DrivePhotoInfo[]> {
  const allPhotos = await listAllPhotos();
  const prefix = `item-${itemId}-`;

  return allPhotos.filter((photo) => photo.name.startsWith(prefix));
}

/**
 * Get storage quota information
 */
export async function getStorageQuota(): Promise<{
  limit: number;
  usage: number;
  usageInDrive: number;
}> {
  const url = `${DRIVE_API_BASE}/about?fields=storageQuota`;
  const data = await driveRequest<{
    storageQuota: {
      limit: string;
      usage: string;
      usageInDrive: string;
    };
  }>(url);

  return {
    limit: parseInt(data.storageQuota.limit) || 0,
    usage: parseInt(data.storageQuota.usage) || 0,
    usageInDrive: parseInt(data.storageQuota.usageInDrive) || 0,
  };
}
