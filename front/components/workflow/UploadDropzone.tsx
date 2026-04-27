"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Button from "../ui/Button";
import { isNative, takePhoto, pickPhotos, filesToFileList } from "../../lib/camera";

type UploadDropzoneProps = {
  onFiles: (files: FileList | null) => void;
  disabled?: boolean;
  isDragging?: boolean;
  setIsDragging?: (value: boolean) => void;
  title?: string;
  subtitle?: string;
  accept?: string;
  multiple?: boolean;
};

export default function UploadDropzone({
  onFiles,
  disabled = false,
  isDragging = false,
  setIsDragging,
  title = "Tap to select or drag and drop",
  subtitle = "PNG, JPG, WEBP",
  accept = "image/*",
  multiple = true,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging?.(false);
    if (!disabled) onFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled) setIsDragging?.(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging?.(false);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    onFiles(e.target.files);
  }

  async function handleTakePhoto() {
    setCameraError(null);
    setCameraLoading(true);
    try {
      const file = await takePhoto();
      onFiles(filesToFileList([file]));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("cancel")) {
        setCameraError("Camera permission denied or unavailable.");
      }
    } finally {
      setCameraLoading(false);
    }
  }

  async function handlePickPhotos() {
    setCameraError(null);
    setCameraLoading(true);
    try {
      const files = await pickPhotos();
      if (files.length > 0) onFiles(filesToFileList(files));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("cancel")) {
        setCameraError("Could not access photo library.");
      }
    } finally {
      setCameraLoading(false);
    }
  }

  // Native (iOS / Android) — show camera + gallery buttons
  if (isNative()) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleTakePhoto}
          disabled={disabled || cameraLoading}
          className={`flex min-h-[140px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-sky-400 bg-sky-50 transition active:scale-95 dark:border-sky-600 dark:bg-sky-950/30 ${
            disabled || cameraLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-sky-100 dark:hover:bg-sky-900/40"
          }`}
          aria-label="Take a photo with camera"
        >
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-2xl text-white shadow-md" aria-hidden>
            📷
          </span>
          <span className="text-base font-semibold text-sky-700 dark:text-sky-300">
            {cameraLoading ? "Opening camera…" : "Take Photo"}
          </span>
        </button>

        <button
          type="button"
          onClick={handlePickPhotos}
          disabled={disabled || cameraLoading}
          className={`flex min-h-[100px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-slate-50 transition active:scale-95 dark:border-slate-600 dark:bg-slate-800/50 ${
            disabled || cameraLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-slate-400 hover:bg-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800"
          }`}
          aria-label="Choose photos from library"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-xl dark:bg-slate-700" aria-hidden>
            🖼️
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Choose from Library</span>
        </button>

        {cameraError && (
          <p role="alert" className="text-center text-xs text-rose-600 dark:text-rose-400">
            {cameraError}
          </p>
        )}
      </div>
    );
  }

  // Web — standard drag-and-drop dropzone
  return (
    <div
      onClick={() => { if (!disabled) inputRef.current?.click(); }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="File upload area — press Enter or Space to choose files"
      className={`group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
        isDragging
          ? "border-sky-500 bg-sky-50 shadow-inner shadow-sky-100 dark:bg-sky-950/30"
          : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/80 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-slate-500 dark:hover:bg-slate-800/80"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="sr-only"
        disabled={disabled}
      />
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-300 bg-white text-2xl shadow-sm dark:border-slate-600 dark:bg-slate-900" aria-hidden>
        ⬆
      </span>
      <p className="mt-3 text-base font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      {isDragging && (
        <p className="mt-2 text-xs font-medium text-sky-700 dark:text-sky-300">Drop files to upload</p>
      )}
      <Button
        type="button"
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        variant="ghost"
        size="sm"
        disabled={disabled}
        className="mt-4"
      >
        Choose files
      </Button>
    </div>
  );
}
