"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import AppShell from "../../components/layout/AppShell";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";
import SectionHeader from "../../components/ui/SectionHeader";
import FlowStepper from "../../components/workflow/FlowStepper";
import UploadDropzone from "../../components/workflow/UploadDropzone";
import FileList from "../../components/workflow/FileList";
import { useToast } from "../../components/ui/Toast";
import EmptyState from "../../components/ui/EmptyState";

const STORAGE_KEY = "managerOrderFormDraft";

export default function ManagerViewPage() {
  const { showToast } = useToast();
  const { data: session } = useSession();
  const router = useRouter();
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const sessionPantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;
  const isDirector = sessionRole === "director" || sessionPantryId === "director";
  const [targetPantryId, setTargetPantryId] = useState("");
  const [pantries, setPantries] = useState<Array<{ pantryId: string; name: string }>>([]);
  const [pantryLoadError, setPantryLoadError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : "";

  useEffect(() => {
    if (!isDirector && sessionPantryId) {
      setTargetPantryId(sessionPantryId);
      return;
    }
    if (!isDirector || !apiBase) return;

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
  }, [apiBase, isDirector, sessionPantryId]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setFiles(Array.from(fileList).filter((f) => f.type.startsWith("image/")));
  }

  async function handleExtract() {
    if (!files.length) return;
    const effectivePantryId = isDirector ? targetPantryId : sessionPantryId || "";
    if (!effectivePantryId) {
      showToast("Select a pantry before extracting.", "error");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      for (let i = 0; i < files.length; i++) {
        form.append("files", files[i]);
      }
      const res = await fetch(`${apiBase}/manager/order-form`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.ok && data.inventory) {
        const draft = {
          pantryId: effectivePantryId,
          inventory: data.inventory,
          files: data.files ?? [],
          createdAt: new Date().toISOString(),
        };
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        }
        showToast("Order form extracted. Review baseline values before saving.", "success");
        router.push("/manager/review");
      } else {
        setError(data.error || "Failed to read order form. Try another image.");
        showToast(data.error || "Failed to read order form.", "error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      showToast("Network error while extracting order form.", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell
      title="Manager Upload"
      subtitle="Upload warehouse order forms and set pantry baseline"
      links={[
        { label: "Home", href: "/" },
        { label: "Review", href: "/manager/review" },
      ]}
      rightAction={
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
          Switch account
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-4">
        {isDirector && (
          <Card>
            <SectionHeader
              title="Choose target pantry"
              subtitle="Director form uploads need an explicit pantry selection before extraction."
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
              Current form target: {targetPantryId || "Select a pantry"}
            </p>
            {pantryLoadError && <Alert tone="error" className="mt-3">{pantryLoadError}</Alert>}
          </Card>
        )}
        <Card>
          <FlowStepper steps={["Upload", "Review", "Save Baseline"]} currentStep={0} />
        </Card>
        <Card className="text-sm text-zinc-600 dark:text-zinc-300">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">Manager flow</p>
          <p className="mt-1">
            Upload warehouse order form pages, review extracted category totals, then save as pantry baseline.
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Active pantry target: {targetPantryId || "Not selected"}
          </p>
        </Card>
        <Card>
          <SectionHeader title="Upload order forms" subtitle="You can upload multiple pages in one request." />
          <UploadDropzone
            onFiles={handleFiles}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            disabled={uploading}
            title="Upload warehouse order form pages"
            subtitle="You can upload both pages together"
          />
          {files.length === 0 && (
            <EmptyState
              className="mt-4"
              title="No form pages selected"
              description="Upload one or more order-form pages to extract category totals."
            />
          )}
          {files.length > 0 && (
            <div className="mt-4 space-y-4">
              <FileList files={files} onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))} />
              <Button type="button" onClick={handleExtract} disabled={uploading} block size="lg">
                {uploading ? "Extracting from form..." : "Extract category totals"}
              </Button>
            </div>
          )}
        </Card>
        {error && <Alert tone="error">{error}</Alert>}

        <Card className="mt-6">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Account</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            To login as another role, switch account here.
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
