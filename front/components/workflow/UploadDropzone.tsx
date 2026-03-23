import { useRef, type ChangeEvent, type DragEvent } from "react";
import Button from "../ui/Button";

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

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging?.(false);
    if (!disabled) onFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (!disabled) setIsDragging?.(true);
  }

  function handleDragLeave(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging?.(false);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    onFiles(e.target.files);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      role="region"
      aria-label="File upload dropzone"
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
        onClick={() => inputRef.current?.click()}
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
