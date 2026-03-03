"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type InventoryRecord = Record<string, number>;

type DraftData = {
  pantryId: string;
  inventory: InventoryRecord;
  files?: { filename?: string; size_bytes?: number }[];
};

type SubmitResponse = {
  ok: boolean;
  ratios?: Record<string, number>;
  levels?: Record<string, string>;
  error?: string;
};

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

export default function ReviewPage() {
  const params = useParams();
  const pantryId = params.pantryId as string;
  const [inventory, setInventory] = useState<InventoryRecord | null>(null);
  const [draftMeta, setDraftMeta] = useState<DraftData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [handoffReady, setHandoffReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);

  const apiBase =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
      : "";

  useEffect(() => {
    async function loadDraft() {
      try {
        const res = await fetch(`${apiBase}/inventory/draft/${pantryId}`);
        const data = await res.json();

        if (!res.ok || !data.ok || !data.draft) {
          setLoadError(data.error || "Could not load inventory draft from backend.");
          return;
        }

        setInventory(data.draft.inventory ?? null);
        setDraftMeta(data.draft);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Network error while loading draft.");
      }
    }

    if (apiBase) {
      loadDraft();
    }
  }, [apiBase, pantryId]);

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
    setHandoffReady(false);
    setSubmitError(null);
    setSubmitResult(null);
  }

  function prepareHandoff() {
    if (!inventory) return;
    const payload = {
      pantryId,
      reviewedAt: new Date().toISOString(),
      source: "volunteer-review",
      ok: true,
      count: draftMeta?.files?.length ?? 0,
      files: draftMeta?.files ?? [],
      rawInventory: inventory,
      reviewedInventory: inventory,
    };
    window.sessionStorage.setItem("inventoryReviewHandoff", JSON.stringify(payload));
    setHandoffReady(true);
  }

  async function submitInventory() {
    if (!inventory) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitResult(null);

    try {
      const res = await fetch(`${apiBase}/volunteer/inventory/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Submit the reviewed values exactly as shown in the form.
        body: JSON.stringify({
          pantryId,
          inventory,
        }),
      });

      const data = (await res.json()) as SubmitResponse;
      if (!res.ok || !data.ok) {
        setSubmitError(data.error || "Could not submit inventory.");
        return;
      }

      setSubmitResult(data);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Network error while submitting inventory.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-900 pb-8">
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-700 px-4 pt-6 pb-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Review detected inventory</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Pantry: {pantryId}</p>
      </header>

      <main className="px-4 pt-6 max-w-2xl mx-auto space-y-4">
        {loadError && (
          <div className="rounded-xl bg-white dark:bg-zinc-800 p-4 text-sm text-red-600 dark:text-red-300">
            {loadError}
            <div className="mt-3">
              <Link href={`/${pantryId}/upload`} className="text-blue-600 dark:text-blue-400 underline">
                Go to upload page
              </Link>
            </div>
          </div>
        )}

        {inventory && (
          <>
            <div className="rounded-xl bg-white dark:bg-zinc-800 p-4 text-sm text-zinc-600 dark:text-zinc-300">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">Detected counts</p>
              <p className="mt-1">
                These counts were detected from the uploaded shelf photo. Review them, edit if needed, then submit.
              </p>
              {draftMeta?.files && draftMeta.files.length > 0 && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Photos processed: {draftMeta.files.length}</p>
              )}
            </div>

            <section className="rounded-xl bg-white dark:bg-zinc-800 p-4">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Editable review form</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Update any category before submitting the current stock snapshot.
                </p>
              </div>
              <ul className="space-y-3">
                {rows.map(({ category, quantity }) => (
                  <li key={category} className="flex items-center justify-between gap-3">
                    <label htmlFor={category} className="text-sm text-zinc-700 dark:text-zinc-200">{category}</label>
                    <input
                      id={category}
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

            <section className="rounded-xl bg-white dark:bg-zinc-800 p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Submit current inventory</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Submit the reviewed counts to compute the current level for each category.
                </p>
              </div>
              <button
                type="button"
                onClick={submitInventory}
                disabled={submitting}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
              >
                {submitting ? "Submitting…" : "Submit inventory"}
              </button>

              <button
                type="button"
                onClick={prepareHandoff}
                className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Prepare handoff data for teammate
              </button>

              {submitError && (
                <div className="rounded-lg bg-red-100 dark:bg-red-900/40 p-3 text-sm text-red-700 dark:text-red-200">
                  {submitError}
                </div>
              )}

              {submitResult?.ok && submitResult.ratios && submitResult.levels && (
                <div className="rounded-lg bg-blue-100 dark:bg-blue-900/40 p-3 text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-medium">Current inventory levels</p>
                  <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
                    Submission saved. The levels below show the current inventory status for each category.
                  </p>
                  <div className="mt-3 space-y-2">
                    {orderedCategories.map((category) => (
                      <div key={category} className="flex items-center justify-between gap-4 border-b border-blue-200/60 pb-1 last:border-b-0 dark:border-blue-700/40">
                        <span>{category}</span>
                        <span className="text-right">
                          Ratio: {Number(submitResult.ratios?.[category] ?? 0).toFixed(2)} | Level: {submitResult.levels?.[category] ?? "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {handoffReady && (
                <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/40 p-3 text-sm text-emerald-800 dark:text-emerald-200 space-y-2">
                  <p className="font-medium">Handoff payload saved.</p>
                  <p>Teammate can read <code>sessionStorage["inventoryReviewHandoff"]</code>.</p>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
