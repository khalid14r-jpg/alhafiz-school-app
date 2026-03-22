/**
 * Compresses an image base64 string by resizing it and reducing quality.
 * @param base64Str The source base64 string.
 * @param maxWidth Maximum width of the output image.
 * @param maxHeight Maximum height of the output image.
 * @param quality Quality of the output JPEG (0.0 to 1.0).
 * @returns A promise that resolves to the compressed base64 string.
 */
export const compressImage = (
  base64Str: string,
  maxWidth = 800,
  maxHeight = 600,
  quality = 0.6
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      // Use image/jpeg for better compression than png
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => reject(err);
  });
};

/**
 * Converts a standard YouTube or Vimeo URL to its embed version.
 * @param url The source URL.
 * @returns The embed URL or the original URL if no match is found.
 */
export const getEmbedUrl = (url: string): string => {
  if (!url) return '';

  // YouTube
  // Matches:
  // - youtube.com/watch?v=ID
  // - youtube.com/v/ID
  // - youtube.com/embed/ID
  // - youtu.be/ID
  // - youtube.com/shorts/ID
  // - youtube.com/live/ID
  // - m.youtube.com/...
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const ytMatch = url.match(ytRegex);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // YouTube Playlist
  const ytPlaylistRegex = /[?&]list=([^#&?]+)/i;
  const ytPlaylistMatch = url.match(ytPlaylistRegex);
  if (url.includes('youtube.com') && ytPlaylistMatch && ytPlaylistMatch[1]) {
    return `https://www.youtube.com/embed/videoseries?list=${ytPlaylistMatch[1]}`;
  }

  // Vimeo
  const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/i;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return url;
};
