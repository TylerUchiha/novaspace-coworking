import { useCallback, useEffect, useRef, useState } from 'react';

export interface PendingCropImage {
  src: string;
  fileName: string;
  mimeType: string;
}

export interface UseImageCropPickerOptions {
  aspect?: number;
  onCrop: (file: File) => void | Promise<void>;
}

export function useImageCropPicker({ aspect, onCrop }: UseImageCropPickerOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileQueueRef = useRef<File[]>([]);
  const [pending, setPending] = useState<PendingCropImage | null>(null);

  const showNextQueuedFile = useCallback(() => {
    const next = fileQueueRef.current.shift();
    if (!next) return;
    setPending({
      src: URL.createObjectURL(next),
      fileName: next.name,
      mimeType: next.type || 'image/jpeg',
    });
  }, []);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const queueFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      fileQueueRef.current.push(file);
      if (!pending) {
        showNextQueuedFile();
      }
    },
    [pending, showNextQueuedFile],
  );

  const queueFiles = useCallback(
    (files: File[]) => {
      files.filter((file) => file.type.startsWith('image/')).forEach((file) => {
        fileQueueRef.current.push(file);
      });
      if (!pending) {
        showNextQueuedFile();
      }
    },
    [pending, showNextQueuedFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) queueFile(file);
    },
    [queueFile],
  );

  const handleCancel = useCallback(() => {
    if (pending) URL.revokeObjectURL(pending.src);
    setPending(null);
    fileQueueRef.current = [];
  }, [pending]);

  const handleConfirm = useCallback(
    async (croppedFile: File) => {
      if (pending) URL.revokeObjectURL(pending.src);
      setPending(null);
      await onCrop(croppedFile);
      showNextQueuedFile();
    },
    [onCrop, pending, showNextQueuedFile],
  );

  useEffect(() => {
    return () => {
      if (pending) URL.revokeObjectURL(pending.src);
    };
  }, [pending]);

  return {
    aspect,
    inputRef,
    openPicker,
    queueFile,
    queueFiles,
    pending,
    handleFileChange,
    handleCancel,
    handleConfirm,
    inputProps: {
      ref: inputRef,
      type: 'file' as const,
      accept: 'image/*',
      className: 'hidden',
      onChange: handleFileChange,
    },
  };
}
