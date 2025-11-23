import { type ClassValue, clsx } from 'clsx';

// Tailwind CSS class merger
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Format date
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return formatDate(date);
}

// Image compression
export async function compressImage(file: File, maxWidth: number = 800): Promise<string> {
  // Validate file size (max 10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error(`Invalid file type: ${file.type}. Please select an image file.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Validate image dimensions
        if (width === 0 || height === 0) {
          reject(new Error('Invalid image dimensions'));
          return;
        }

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        try {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

          // Clean up canvas
          canvas.width = 0;
          canvas.height = 0;

          resolve(dataUrl);
        } catch (error) {
          reject(new Error(`Failed to compress image: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));

      const result = e.target?.result;
      if (!result || typeof result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      img.src = result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Validate barcode formats
export function isValidBarcode(barcode: string): boolean {
  // Common barcode formats: EAN-13, EAN-8, UPC-A, UPC-E, Code 128
  return /^[\d]{8,13}$/.test(barcode) || /^[\dA-Z\-.$ /+%]{1,}$/.test(barcode);
}

// Generate unique ID for offline operations
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
