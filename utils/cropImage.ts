export interface CropAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.crossOrigin = 'anonymous';
    image.src = url;
  });
}

export async function getCroppedImageFile(
  imageSrc: string,
  pixelCrop: CropAreaPixels,
  fileName: string,
  mimeType = 'image/jpeg',
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create canvas context.');
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Could not crop image.'));
      },
      mimeType,
      0.92,
    );
  });

  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const safeName = fileName.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${safeName}.${ext}`, { type: mimeType });
}
