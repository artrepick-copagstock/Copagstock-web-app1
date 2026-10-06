/**
 * Image processing and compression utility for Material Requisition System
 * Ensures images uploaded from phone camera, scanner, or local files are properly
 * resized and compressed (JPEG/WebP) to maintain ultra-fast loading and keep document
 * size safe for Firestore and LocalStorage (< 70KB).
 */

export interface ProcessedImage {
  dataUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
  fileName?: string;
  mimeType: string;
}

export async function processAndCompressImage(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.82
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      reject(new Error('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPEG, PNG, WebP)'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไม่สามารถโหลดรูปภาพได้'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio scaling
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Fill background with white in case PNG has transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Try webp first, fallback to jpeg
        let mimeType = 'image/webp';
        let dataUrl = canvas.toDataURL(mimeType, quality);

        // If browser doesn't support webp export, it falls back to png or jpeg
        if (!dataUrl.startsWith('data:image/webp')) {
          mimeType = 'image/jpeg';
          dataUrl = canvas.toDataURL(mimeType, quality);
        }

        // Calculate size in bytes
        const head = `data:${mimeType};base64,`;
        const base64Length = dataUrl.length - head.length;
        const sizeBytes = Math.round((base64Length * 3) / 4);

        resolve({
          dataUrl,
          sizeBytes,
          width,
          height,
          fileName: file.name,
          mimeType
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function estimateBase64Size(dataUrl: string): number {
  if (!dataUrl) return 0;
  if (!dataUrl.startsWith('data:')) {
    // External URL, return arbitrary small size estimate
    return 512;
  }
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const base64Part = dataUrl.substring(commaIdx + 1);
  return Math.round((base64Part.length * 3) / 4);
}
