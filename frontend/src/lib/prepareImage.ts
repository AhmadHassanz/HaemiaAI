/** Bound upload and server decode memory for high-resolution phone photos. */
export async function prepareImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to read this photo. Please choose a JPEG, PNG, or WEBP image.'));
      image.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    if (scale === 1) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare this photo on your device.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    try {
      // PNG avoids introducing additional JPEG compression artifacts.
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Unable to resize this photo.')), 'image/png');
      });
      return new File([blob], 'eye-photo.png', { type: 'image/png' });
    } finally {
      canvas.width = canvas.height = 0;
    }
  } finally {
    image.src = '';
    URL.revokeObjectURL(url);
  }
}
