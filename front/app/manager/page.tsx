"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "managerOrderFormDraft";

export default function ManagerViewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") return;
    if (status === "authenticated" && role !== "manager") {
      router.replace("/");
    }
  }, [status, role, router]);

  const apiBase =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
      : "";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList?.length) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      for (let i = 0; i < fileList.length; i++) {
        form.append("files", fileList[i]);
      }
      const res = await fetch(`${apiBase}/manager/order-form`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.ok && data.inventory) {
        const draft = {
          inventory: data.inventory,
          files: data.files ?? [],
          createdAt: new Date().toISOString(),
        };
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        }
        router.push("/manager/review");
      } else {
        setError(data.error || "Failed to read order form. Try another image.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (status === "loading" || (status === "authenticated" && role !== "manager")) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            ←
          </Link>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Manager View
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label="Select order form image"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-xl border-2 border-dashed border-zinc-300 bg-white py-8 text-base font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
        >
          {uploading ? "Reading order form…" : "Upload an order form"}
        </button>
        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </main>
    </div>
  );
}
