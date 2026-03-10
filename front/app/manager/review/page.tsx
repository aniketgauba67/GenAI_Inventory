"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type InventoryRecord = Record<string, number>;

type DraftData = {
  inventory: InventoryRecord;
  files?: { filename?: string; size_bytes?: number }[];
  createdAt?: string;
};

const STORAGE_KEY = "managerOrderFormDraft";

const orderedCategories = [
  "Beverages",
  "Juices",
  "Cereal",
  "Breakfast",
  "Meat",
  "Fish",
  "Poultry",
  "Frozen",
  "Vegetables",
  "Fruits",
  "Nuts",
  "Soup",
  "Grains",
  "Pasta",
  "Snacks",
  "Spices",
  "Sauces",
  "Condiments",
  "Misc Products",
];

export default function ManagerReviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [inventory, setInventory] = useState<InventoryRecord | null>(null);
  const [draftMeta, setDraftMeta] = useState<DraftData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const apiBase =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
      : "";

  useEffect(() => {
    if (status !== "authenticated") return;

    try {
      const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null;
      if (!raw) {
        setLoadError("No order form draft found. Upload an order form first.");
        return;
      }
      const draft: DraftData = JSON.parse(raw);
      if (!draft.inventory) {
        setLoadError("Invalid draft data.");
        return;
      }
      setInventory(draft.inventory);
      setDraftMeta(draft);
    } catch {
      setLoadError("Could not load draft.");
    }
  }, [status]);

  const rows = useMemo(() => {
    if (!inventory) return [];
    return orderedCategories.map((category) => ({
      category,
      quantity: Number(inventory[category] ?? 0),
    }));
  }, [inventory]);

  function updateQuantity(category: string, value: string) {
    const quantity = Number(value);
    if (Number.isNaN(quantity)) return;
    setInventory((prev) => ({ ...(prev ?? {}), [category]: Math.max(0, quantity) }));
  }

  async function submitBaseline() {
    if (!inventory) return;
    const pantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;
    if (!pantryId) {
      setSubmitError("Pantry ID missing from session.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`${apiBase}/manager/inventory/${pantryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        // Success: clear draft and redirect
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(STORAGE_KEY);
        }
        router.push("/manager");
      } else {
        setSubmitError(data.error || "Failed to update baseline inventory.");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 pb-8">
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-700 px-4 pt-6 pb-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Review order form
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Edit extracted quantities, then confirm to set baseline (total available stock).
        </p>
      </header>

      <main className="px-4 pt-6 max-w-2xl mx-auto space-y-4">
        {loadError && (
          <div className="rounded-xl bg-white dark:bg-zinc-800 p-4 text-sm text-red-600 dark:text-red-300">
            {loadError}
            <div className="mt-3">
              <Link href="/manager" className="text-blue-600 dark:text-blue-400 underline">
                Back to Manager
              </Link>
            </div>
          </div>
        )}

        {inventory && (
          <>
            <div className="rounded-xl bg-white dark:bg-zinc-800 p-4 text-sm text-zinc-600 dark:text-zinc-300">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">Extracted counts</p>
              <p className="mt-1">
                These counts were extracted from the order form image. Review and edit if needed.
              </p>
              {draftMeta?.files && draftMeta.files.length > 0 && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Image(s) processed: {draftMeta.files.length}
                </p>
              )}
            </div>

            <section className="rounded-xl bg-white dark:bg-zinc-800 p-4">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Editable baseline quantities
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Update any category before saving as baseline.
                </p>
              </div>
              <ul className="space-y-3">
                {rows.map(({ category, quantity }) => (
                  <li key={category} className="flex items-center justify-between gap-3">
                    <label htmlFor={`mgr-${category}`} className="text-sm text-zinc-700 dark:text-zinc-200">
                      {category}
                    </label>
                    <input
                      id={`mgr-${category}`}
                      type="number"
                      min={0}
                      value={quantity}
                      onChange={(e) => updateQuantity(category, e.target.value)}
                      className="w-28 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl bg-white dark:bg-zinc-800 p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Save Baseline Inventory
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  This will update the total available stock for your pantry.
                </p>
              </div>

              {submitError && (
                <div className="rounded-lg bg-red-100 dark:bg-red-900/40 p-3 text-sm text-red-700 dark:text-red-200">
                  {submitError}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={submitBaseline}
                  disabled={submitting}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                >
                  {submitting ? "Saving..." : "Confirm & Save Baseline"}
                </button>
                <Link
                  href="/manager"
                  className="block w-full rounded-xl bg-zinc-200 dark:bg-zinc-700 py-3 text-center text-sm font-medium text-zinc-800 dark:text-zinc-200 transition hover:bg-zinc-300 dark:hover:bg-zinc-600"
                >
                  Cancel
                </Link>
                <Link
                  href="/"
                  className="block w-full rounded-xl py-3 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400 transition hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  Go back to main
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
