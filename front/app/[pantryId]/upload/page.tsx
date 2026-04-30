/******************************** page.tsx ***************************************
 *
 *  Module: Frontend App Route
 *
 *  This module renders a Next.js route for the GenAI Inventory user
 *  interface.
 *
 *  The module provides:
 *
 *  - route-level layout or page rendering.
 *  - connections to shared frontend components and helpers.
 *
 *  Key Structures Used:
 *
 *  - Next.js App Router files, React components, and route params.
 *
 *  This module ensures:
 *
 *  - the screen follows the shared application workflow.
 *  - route code remains close to its user-facing page.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useToast } from "../../../components/ui/Toast";
import EmptyState from "../../../components/ui/EmptyState";
import { getApiBase } from "../../../lib/api";

const UPLOAD_TIMEOUT_MS = 90000;

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
  const [isPantryOpen, setIsPantryOpen] = useState<boolean | null>(null);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    ok: boolean;
    message?: string;
    files?: { filename: string; size_bytes: number }[];
    inventory?: Record<string, number>;
  } | null>(null);

  const previewsRef = useRef<string[]>([]);

  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  useEffect(() => {
    return () => {
      previewsRef.current.forEach((url: string) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleFiles = useCallback(
    (newFiles: FileList | File[] | null) => {
      if (!newFiles?.length) return;
      const arr = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
      if (!arr.length) return;

      setFiles((prev: File[]) => [...prev, ...arr]);
      setPreviews((prev: string[]) => [...prev, ...arr.map((f) => URL.createObjectURL(f))]);
    },
    []
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

  const apiBase = getApiBase();

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

  useEffect(() => {
    if (!apiBase || !pantryId) return;
    let ignore = false;
    async function fetchStatus() {
      try {
        const res = await fetch(`${apiBase}/customer/pantries`, { cache: "no-store" });
        const data = await res.json();
        if (!ignore && data.ok && Array.isArray(data.pantries)) {
          const match = data.pantries.find((p: { pantryId: string }) => String(p.pantryId) === String(pantryId));
          if (match) {
            setIsPantryOpen(match.isOpen ?? true);
            setIsManualOverride(match.manualOverride ?? false);
          }
        }
      } catch { /* ignore */ }
    }
    void fetchStatus();
    return () => { ignore = true; };
  }, [apiBase, pantryId]);

  async function handleToggleStatus() {
    const effectiveId = isDirector ? targetPantryId : pantryId;
    if (!effectiveId || togglingStatus) return;
    setTogglingStatus(true);
    try {
      const res = await fetch(`${apiBase}/auth/pantry/toggle-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pantryId: effectiveId }),
      });
      const data = await res.json();
      if (data.ok) {
        setIsPantryOpen(data.isOpen);
        setIsManualOverride(data.manualOverride ?? true);
        showToast(data.message, "success");
      } else {
        showToast(data.error || "Failed to toggle status.", "error");
      }
    } catch {
      showToast("Network error while toggling status.", "error");
    } finally {
      setTogglingStatus(false);
    }
  }

  async function handleClearOverride() {
    const effectiveId = isDirector ? targetPantryId : pantryId;
    if (!effectiveId || togglingStatus) return;
    setTogglingStatus(true);
    try {
      const res = await fetch(`${apiBase}/auth/pantry/clear-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pantryId: effectiveId }),
      });
      const data = await res.json();
      if (data.ok) {
        setIsPantryOpen(data.isOpen);
        setIsManualOverride(false);
        showToast(data.message, "success");
      } else {
        showToast(data.error || "Failed to clear override.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      setTogglingStatus(false);
    }
  }

  async function handleSendToBackend() {
    if (files.length === 0) return;
    const effectivePantryId = isDirector ? targetPantryId : pantryId;
    if (!effectivePantryId) {
      showToast("Select a pantry before uploading.", "error");
      return;
    }
    setUploading(true);
    setUploadResult(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      form.append("pantry_id", effectivePantryId);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({ ok: false, error: "Upload failed." }));
      if (res.ok && data.ok && data.inventory) {
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
        const message =
          data.error ||
          (res.ok && data.ok
            ? "Detection did not return inventory. Try a clearer shelf photo."
            : `Upload failed (${res.status})`);
        setUploadResult({ ok: false, message });
        showToast(message, "error");
      }
    } catch (e) {
      const message =
        e instanceof Error && e.name === "AbortError"
          ? "Inventory detection timed out. Try one clear photo at a time."
          : e instanceof Error
            ? e.message
            : "Network error";
      setUploadResult({
        ok: false,
        message,
      });
      showToast(message, "error");
    } finally {
      window.clearTimeout(timeoutId);
      setUploading(false);
    }
  }

  return (
    <AppShell
      title="Volunteer Upload"
      subtitle={`Pantry ${pantryId} · Upload shelf photos for detection`}
      rightAction={
        <div className="flex items-center gap-2">
          {isPantryOpen !== null && (
            <>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={togglingStatus}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isPantryOpen
                    ? "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/50"
                    : "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
                }`}
              >
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${isPantryOpen ? "bg-teal-500" : "bg-rose-500"}`} />
                {togglingStatus ? "..." : isPantryOpen ? "Open" : "Closed"}
                {isManualOverride && !togglingStatus && <span className="ml-0.5 text-[10px] opacity-70">Manual</span>}
              </button>
              {isManualOverride && (
                <button
                  type="button"
                  onClick={handleClearOverride}
                  disabled={togglingStatus}
                  className="min-h-[44px] rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Auto
                </button>
              )}
            </>
          )}
          <Button variant="ghost" size="md" className="min-h-[44px] px-5 text-base" onClick={() => signOut({ callbackUrl: "/" })}>
            Switch account
          </Button>
        </div>
      }
      links={[
        { label: "Home", href: "/" },
        { label: "Review", href: `/${pantryId}/review` },
      ]}
    >
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(circle_at_18%_12%,rgba(13,148,136,0.18),transparent_34%),radial-gradient(circle_at_82%_0%,rgba(249,115,22,0.14),transparent_30%)]" />
        <div className="mx-auto max-w-3xl space-y-5">
        {isDirector && (
          <Card className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60">
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
        <Card className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60">
          <FlowStepper steps={["Upload", "Review", "Submit"]} currentStep={0} status={uploading ? "uploading" : undefined} />
        </Card>
        {uploading && (
          <Alert tone="info" className="text-base">Processing images and detecting inventory. This can take up to a minute.</Alert>
        )}
        <Card className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 text-base text-zinc-600 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-zinc-300">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Volunteer flow</p>
          <p className="mt-1 leading-7">1. Upload shelf photo(s) 2. Review detected counts 3. Submit inventory levels</p>
          {isDirector && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Director target pantry: {targetPantryId || "Not selected"}
            </p>
          )}
        </Card>
        <Card className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60">
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
          <Card className="mt-6 rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60" aria-label="Upload preview">
            <h2 className="mb-3 text-base font-semibold text-zinc-700 dark:text-zinc-300">
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
                    className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70 hover:scale-110 active:scale-95"
                    aria-label={`Remove image ${i + 1}`}
                  >
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <span className="absolute bottom-2 left-2 max-w-[80%] truncate text-xs text-white/90 drop-shadow">
                    {files[i]?.name}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              onClick={handleSendToBackend}
              disabled={uploading || files.length === 0}
              block
              variant="secondary"
              size="lg"
              className="mt-4 inline-flex items-center justify-center gap-2 text-base"
            >
              {uploading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              )}
              {uploading ? "Detecting inventory..." : "Detect inventory"}
            </Button>
            {uploadResult && (
              <div className="mt-3 space-y-1">
                <Alert tone={uploadResult.ok ? "success" : "error"}>{uploadResult.message}</Alert>
                {uploadResult.ok && uploadResult.files && uploadResult.files.length > 0 && (
                  <ul className="list-inside list-disc text-sm text-zinc-500 dark:text-zinc-400">
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

        </div>
      </div>
    </AppShell>
  );
}
