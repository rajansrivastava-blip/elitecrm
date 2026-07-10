/**
 * Resizes and compresses an uploaded image file into a square, low-footprint JPEG data URL.
 * This keeps the base64 string extremely small (<15KB) to prevent QuotaExceededError in localStorage 
 * and avoid performance/payload-too-large issues in CRM networks/databases.
 */
export function compressAndResizeImage(
  file: File, 
  maxWidth: number = 120, 
  maxHeight: number = 120, 
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        const width = img.width;
        const height = img.height;

        // Crop to square centering the content (avatars are round/square)
        const size = Math.min(width, height);
        const xOffset = (width - size) / 2;
        const yOffset = (height - size) / 2;

        canvas.width = maxWidth;
        canvas.height = maxHeight;

        ctx.drawImage(
          img,
          xOffset,
          yOffset,
          size,
          size,
          0,
          0,
          maxWidth,
          maxHeight
        );

        // Convert to space-efficient compressed JPEG
        const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedBase64);
      };
      img.onerror = (err) => {
        reject(err);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsDataURL(file);
  });
}
