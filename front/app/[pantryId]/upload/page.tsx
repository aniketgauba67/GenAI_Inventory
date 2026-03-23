"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Alert from "../../../components/ui/Alert";
import SectionHeader from "../../../components/ui/SectionHeader";
import FlowStepper from "../../../components/workflow/FlowStepper";
import UploadDropzone from "../../../components/workflow/UploadDropzone";
import FileList from "../../../components/workflow/FileList";
import { useToast } from "../../../components/ui/Toast";
import EmptyState from "../../../components/ui/EmptyState";

export default function UploadPage() {
  const { showToast } = useToast();
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const pantryId = params.pantryId as string;
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const sessionPantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;
  const isDirector = sessionRole === "director" || sessionPantryId === "director";

  useEffect(() => {
    if (status === "unauthenticated") return;
    if (
      status === "authenticated" &&
      sessionPantryId &&
      sessionPantryId !== pantryId &&
      sessionPantryId !== "director"
    ) {
      router.replace(`/${sessionPantryId}/upload`);
    }
  }, [status, sessionPantryId, pantryId, router]);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [targetPantryId, setTargetPantryId] = useState("");
  const [pantries, setPantries] = useState<Array<{ pantryId: string; name: string }>>([]);
  const [pantryLoadError, setPantryLoadError] = useState<string | null>(null);
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
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : "";

  useEffect(() => {
    if (!isDirector) {
      setTargetPantryId(pantryId);
      return;
    }
    if (!apiBase) return;

    async function loadPantries() {
      setPantryLoadError(null);
      try {
        const res = await fetch(`${apiBase}/auth/pantry-credentials`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.ok || !Array.isArray(data.pantries)) {
          setPantryLoadError(data.error || "Could not load pantry list.");
          return;
        }
        const mapped = data.pantries.map((p: { pantryId: string; name: string }) => ({
          pantryId: String(p.pantryId),
          name: p.name,
        }));
        setPantries(mapped);
        setTargetPantryId((prev) => prev || mapped[0]?.pantryId || "");
      } catch {
        setPantryLoadError("Could not load pantry list.");
      }
    }

    void loadPantries();
  }, [apiBase, isDirector, pantryId]);

  async function handleSendToBackend() {
    if (files.length === 0) return;
    const effectivePantryId = isDirector ? targetPantryId : pantryId;
    if (!effectivePantryId) {
      showToast("Select a pantry before uploading.", "error");
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("pantry_id", effectivePantryId);
      const res = await fetch(`${apiBase}/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const successfulFiles = data.files
          ?.filter((x: { ok?: boolean }) => x.ok)
          .map((x: { filename?: string; size_bytes?: number }) => ({
            filename: x.filename,
            size_bytes: x.size_bytes ?? 0,
          }));

        setUploadResult({
          ok: true,
          message: `${data.count} file(s) received`,
          files: successfulFiles,
          inventory: data.inventory,
        });
        showToast(`Detected inventory from ${data.count} file(s).`, "success");

        if (typeof window !== "undefined" && data.inventory) {
          window.sessionStorage.setItem(
            "latestInventoryReview",
            JSON.stringify({
              pantryId: effectivePantryId,
              inventory: data.inventory,
              files: successfulFiles,
              createdAt: new Date().toISOString(),
            })
          );
          router.push(`/${pantryId}/review${isDirector ? `?targetPantryId=${effectivePantryId}` : ""}`);
        }
      } else {
        setUploadResult({ ok: false, message: data.error || "Upload failed" });
        showToast(data.error || "Upload failed", "error");
      }
    } catch (e) {
      setUploadResult({
        ok: false,
        message: e instanceof Error ? e.message : "Network error",
      });
      showToast("Network error while uploading files.", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell
      title="Volunteer Upload"
      subtitle={`Pantry ${pantryId} · Upload shelf photos for detection`}
      rightAction={
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
          Switch account
        </Button>
      }
      links={[
        { label: "Home", href: "/" },
        { label: "Review", href: `/${pantryId}/review` },
      ]}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        {isDirector && (
          <Card>
            <SectionHeader
              title="Choose target pantry"
              subtitle="Director uploads need an explicit pantry selection before detection starts."
            />
            <select
              value={targetPantryId}
              onChange={(e) => setTargetPantryId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {pantries.map((p) => (
                <option key={p.pantryId} value={p.pantryId}>
                  {p.pantryId} - {p.name}
                </option>
              ))}
            </select>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Current upload target: {targetPantryId || "Select a pantry"}
            </p>
            {pantryLoadError && <Alert tone="error" className="mt-3">{pantryLoadError}</Alert>}
          </Card>
        )}
        <Card>
          <FlowStepper steps={["Upload", "Review", "Submit"]} currentStep={0} />
        </Card>
        {uploading && (
          <Alert tone="info">Processing images and detecting inventory. This can take a few seconds.</Alert>
        )}
        <Card className="text-sm text-zinc-600 dark:text-zinc-300">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">Volunteer flow</p>
          <p className="mt-1">1. Upload shelf photo(s) 2. Review detected counts 3. Submit inventory levels</p>
          {isDirector && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Director target pantry: {targetPantryId || "Not selected"}
            </p>
          )}
        </Card>
        <Card>
          <SectionHeader title="Upload images" subtitle="Tap to select files or drag and drop" />
          <UploadDropzone
            onFiles={handleFiles}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            disabled={uploading}
            title="Upload pantry shelf photos"
            subtitle="Add one or more photos in PNG, JPG, or WEBP format"
          />
          {files.length === 0 && (
            <EmptyState
              className="mt-4"
              title="No photos selected yet"
              description="Select shelf photos first, then run detection."
            />
          )}
        </Card>

        {previews.length > 0 && (
          <Card className="mt-6" aria-label="Upload preview">
            <h2 className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Selected ({previews.length})
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {previews.map((src: string, i: number) => (
                <li
                  key={src}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-700"
                >
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
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-lg leading-none text-white transition hover:bg-black/70 active:scale-95"
                    aria-label={`Remove image ${i + 1}`}
                  >
                    x
                  </button>
                  <span className="absolute bottom-2 left-2 max-w-[80%] truncate text-xs text-white/90 drop-shadow">
                    {files[i]?.name}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <FileList files={files} onRemove={removeImage} />
            </div>
            <Button
              type="button"
              onClick={handleSendToBackend}
              disabled={uploading || files.length === 0}
              block
              variant="secondary"
              size="lg"
              className="mt-4"
            >
              {uploading ? "Detecting inventory..." : "Detect inventory"}
            </Button>
            {uploadResult && (
              <div className="mt-3 space-y-1">
                <Alert tone={uploadResult.ok ? "success" : "error"}>{uploadResult.message}</Alert>
                {uploadResult.ok && uploadResult.files && uploadResult.files.length > 0 && (
                  <ul className="list-inside list-disc text-xs text-zinc-500 dark:text-zinc-400">
                    {uploadResult.files.map((f, i) => (
                      <li key={i}>
                        {f.filename} ({f.size_bytes.toLocaleString()} bytes)
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        )}

        <Card className="mt-6">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Account</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Need to use a different volunteer, manager, or director login?
          </p>
          <Button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            block
            variant="ghost"
            className="mt-3"
          >
            Switch account
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
