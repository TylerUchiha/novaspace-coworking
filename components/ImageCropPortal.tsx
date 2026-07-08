import React from 'react';
import ImageCropModal from './ImageCropModal';
import type { UseImageCropPickerOptions } from '../hooks/useImageCropPicker';
import { useImageCropPicker } from '../hooks/useImageCropPicker';

export function ImageCropPortal({
  pending,
  aspect,
  title,
  onConfirm,
  onCancel,
}: {
  pending: ReturnType<typeof useImageCropPicker>['pending'];
  aspect?: number;
  title?: string;
  onConfirm: (file: File) => void | Promise<void>;
  onCancel: () => void;
}) {
  if (!pending) return null;
  return (
    <ImageCropModal
      imageSrc={pending.src}
      fileName={pending.fileName}
      mimeType={pending.mimeType}
      aspect={aspect}
      title={title}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export function useImageCropUpload(options: UseImageCropPickerOptions) {
  const picker = useImageCropPicker(options);
  const portal = (
    <ImageCropPortal
      pending={picker.pending}
      aspect={picker.aspect}
      onConfirm={picker.handleConfirm}
      onCancel={picker.handleCancel}
    />
  );
  return { ...picker, cropPortal: portal };
}

export default ImageCropPortal;
