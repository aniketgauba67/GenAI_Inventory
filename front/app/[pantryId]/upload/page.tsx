"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function UploadPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const pantryId = params.pantryId as string;
  const sessionPantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;

  useEffect(() => {
    if (status === "unauthenticated") return;
    if (status === "authenticated" && sessionPantryId && sessionPantryId !== pantryId) {
      router.replace(`/${sessionPantryId}/upload`);
    }
  }, [status, sessionPantryId, pantryId, router]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    ok: boolean;
    message?: string;
    files?: { filename: string; size_bytes: number }[];
    inventory?: Record<string, number>;
  } | null>(null);

  const clearPreviews = useCallback(() => {
    previews.forEach((url: string) => URL.revokeObjectURL(url));
    setPreviews([]);
  }, [previews]);

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles?.length) return;
      clearPreviews();
      const arr = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
      setFiles(arr);
      setPreviews(arr.map((f) => URL.createObjectURL(f)));
    },
    [clearPreviews]
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const removeImage = useCallback(
    (index: number) => {
      const url = previews[index];
      URL.revokeObjectURL(url);
      setFiles((prev: File[]) => prev.filter((_, i: number) => i !== index));
      setPreviews((prev: string[]) => prev.filter((_, i: number) => i !== index));
    },
    [previews]
  );

  const apiBase =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
      : "";

  async function handleSendToBackend() {
    if (files.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const res = await fetch(`${apiBase}/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setUploadResult({
          ok: true,
          message: `${data.count} file(s) received`,
          files: data.files?.filter((x: { ok?: boolean }) => x.ok).map((x: { filename?: string; size_bytes?: number }) => ({ filename: x.filename, size_bytes: x.size_bytes ?? 0 })),
          inventory: data.inventory,
        });
      } else {
        setUploadResult({ ok: false, message: data.error || "Upload failed" });
      }
    } catch (e) {
      setUploadResult({
        ok: false,
        message: e instanceof Error ? e.message : "Network error",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 pb-[env(safe-area-inset-bottom)] pb-8">
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-700 px-4 pt-[env(safe-area-inset-top)] pt-6 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            ←
          </Link>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Upload photo
          </h1>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pantry: {pantryId} · Tap to select or drag and drop
        </p>
      </header>

      <main className="px-4 pt-6 max-w-lg mx-auto">
        <label
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`
            flex flex-col items-center justify-center w-full min-h-[200px] sm:min-h-[240px]
            rounded-2xl border-2 border-dashed cursor-pointer
            transition-colors duration-200
            touch-manipulation
            ${isDragging ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500 bg-white dark:bg-zinc-800/50"}
          `}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onInputChange}
            className="sr-only"
            aria-label="Select image"
          />
          <span className="text-4xl mb-2" aria-hidden>
            📷
          </span>
          <span className="text-base font-medium text-zinc-700 dark:text-zinc-300 text-center px-4">
            Tap to select or
            <br />
            drag and drop here
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            PNG, JPG, WEBP
          </span>
        </label>

        {previews.length > 0 && (
          <section className="mt-6" aria-label="Upload preview">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">
              Selected ({previews.length})
            </h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {previews.map((src: string, i: number) => (
                <li key={src} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-700 group">
                  <Image
                    src={src}
                    alt={`Preview ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 33vw"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-lg leading-none hover:bg-black/70 active:scale-95 touch-manipulation"
                    aria-label={`Remove image ${i + 1}`}
                  >
                    ×
                  </button>
                  <span className="absolute bottom-2 left-2 text-xs text-white/90 truncate max-w-[80%] drop-shadow">
                    {files[i]?.name}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleSendToBackend}
              disabled={uploading}
              className="mt-4 w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {uploading ? "Sending…" : "Send to server"}
            </button>
            {uploadResult && (
              <div className="mt-3 space-y-1">
                <p
                  className={`text-sm ${uploadResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {uploadResult.message}
                </p>
                {uploadResult.ok && uploadResult.files && uploadResult.files.length > 0 && (
                  <ul className="text-xs text-zinc-500 dark:text-zinc-400 list-disc list-inside">
                    {uploadResult.files.map((f, i) => (
                      <li key={i}>
                        {f.filename} ({f.size_bytes.toLocaleString()} bytes)
                      </li>
                    ))}
                  </ul>
                )}
                {uploadResult.ok && uploadResult.inventory && Object.keys(uploadResult.inventory).length > 0 && (
                  <div className="mt-2 p-3 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-sm">
                    <p className="font-medium text-zinc-800 dark:text-zinc-200 mb-2">Inventory by category</p>
                    <ul className="space-y-1 text-zinc-700 dark:text-zinc-300">
                      {Object.entries(uploadResult.inventory)
                        .filter(([, q]) => q !== 0 && q !== undefined)
                        .map(([cat, q]) => (
                          <li key={cat} className="flex justify-between gap-2">
                            <span>{cat}</span>
                            <span>{Number(q)}</span>
                          </li>
                        ))}
                    </ul>
                    {Object.values(uploadResult.inventory).every((q) => q === 0 || q === undefined) && (
                      <p className="text-zinc-500 dark:text-zinc-400">No quantities detected.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
