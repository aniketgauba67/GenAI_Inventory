"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import InventoryTable from "../../../components/inventory/InventoryTable";
import SummaryCards from "../../../components/inventory/SummaryCards";
import AppShell from "../../../components/layout/AppShell";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Alert from "../../../components/ui/Alert";
import SectionHeader from "../../../components/ui/SectionHeader";
import FlowStepper from "../../../components/workflow/FlowStepper";
import CategoryGroupEditor from "../../../components/workflow/CategoryGroupEditor";
import StickyActionBar from "../../../components/workflow/StickyActionBar";
import EmptyState from "../../../components/ui/EmptyState";
import Skeleton from "../../../components/ui/Skeleton";
import { useToast } from "../../../components/ui/Toast";

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
  const { showToast } = useToast();
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const pantryId = params.pantryId as string;
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const sessionPantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;
  const isDirector = sessionRole === "director" || sessionPantryId === "director";
  const targetPantryFromQuery = searchParams.get("targetPantryId");
  const effectivePantryId = isDirector && targetPantryFromQuery ? targetPantryFromQuery : pantryId;
  const [inventory, setInventory] = useState<InventoryRecord | null>(null);
  const [draftMeta, setDraftMeta] = useState<DraftData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);

  const apiBase =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : "";

  useEffect(() => {
    async function loadDraft() {
      try {
        const res = await fetch(`${apiBase}/inventory/draft/${effectivePantryId}`);
        const data = await res.json();

        if (!res.ok || !data.ok || !data.draft) {
          setLoadError(data.error || "Could not load inventory draft from backend.");
          showToast(data.error || "Could not load inventory draft.", "error");
          return;
        }

        setInventory(data.draft.inventory ?? null);
        setDraftMeta(data.draft);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Network error while loading draft.");
        showToast("Network error while loading review draft.", "error");
      }
    }

    if (apiBase) {
      loadDraft();
    }
  }, [apiBase, effectivePantryId, showToast]);

  const rows = useMemo(() => {
    if (!inventory) return [];
    return orderedCategories.map((category) => ({
      category,
      quantity: Number(inventory[category] ?? 0),
    }));
  }, [inventory]);

  const totalDetected = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    [rows]
  );

  function updateQuantity(category: string, value: string) {
    const quantity = Number(value);
    if (Number.isNaN(quantity)) return;
    setInventory((prev) => ({ ...(prev ?? {}), [category]: Math.max(0, quantity) }));
    setSubmitError(null);
    setSubmitResult(null);
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
        body: JSON.stringify({
          pantryId: effectivePantryId,
          inventory,
        }),
      });

      const data = (await res.json()) as SubmitResponse;
      if (!res.ok || !data.ok) {
        setSubmitError(data.error || "Could not submit inventory.");
        showToast(data.error || "Could not submit inventory.", "error");
        return;
      }

      setSubmitResult(data);
      showToast("Inventory submitted successfully.", "success");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Network error while submitting inventory.");
      showToast("Network error while submitting inventory.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Volunteer Review"
      subtitle={`Pantry ${effectivePantryId} · Review and submit detected counts`}
      rightAction={
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
          Switch account
        </Button>
      }
      links={[
        { label: "Home", href: "/" },
        { label: "Upload", href: `/${pantryId}/upload` },
      ]}
    >
      <div className="mx-auto max-w-5xl space-y-4 pb-24">
        <Card>
          <FlowStepper steps={["Upload", "Review", "Submit"]} currentStep={1} />
        </Card>
        {loadError && (
          <Alert tone="error">
            {loadError}
            <div className="mt-3">
              <Link
                href={`/${pantryId}/upload${isDirector && effectivePantryId ? `?targetPantryId=${effectivePantryId}` : ""}`}
                className="text-blue-600 underline dark:text-blue-400"
              >
                Go to upload page
              </Link>
            </div>
          </Alert>
        )}
        {!loadError && !inventory && (
          <Card>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
          </Card>
        )}

        {inventory && (
          <>
            <Card className="text-sm text-zinc-600 dark:text-zinc-300">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">Detected counts</p>
              <p className="mt-1">
                These counts were detected from the uploaded shelf photo. Review them, edit if needed, then submit.
              </p>
              {draftMeta?.files && draftMeta.files.length > 0 && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Photos processed: {draftMeta.files.length}</p>
              )}
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Total detected items: {totalDetected}</p>
              {isDirector && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Director target pantry: {effectivePantryId}
                </p>
              )}
            </Card>

            <Card>
              <SectionHeader
                title="Editable review form"
                subtitle="Update any category before submitting the current stock snapshot."
              />
              <CategoryGroupEditor values={inventory} onChange={updateQuantity} inputPrefix="vol" />
            </Card>

            <Card className="space-y-3">
              <SectionHeader
                title="Submit current inventory"
                subtitle="Submit the reviewed counts to compute the current level for each category."
              />
              {submitting && <Alert tone="info">Submitting inventory and computing category levels...</Alert>}
              {submitError && <Alert tone="error">{submitError}</Alert>}

              <Link
                href="/"
                className="block w-full rounded-xl py-3 text-center text-sm font-medium text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Go back to main
              </Link>

              <Button type="button" onClick={() => signOut({ callbackUrl: "/" })} block variant="ghost" size="lg">
                Switch account
              </Button>

              {submitResult?.ok && submitResult.ratios && submitResult.levels && (
                <Alert tone="success">Submission saved successfully.</Alert>
              )}
            </Card>
            {submitResult?.ok && submitResult.ratios && submitResult.levels && (
              <Card className="space-y-4">
                <SectionHeader
                  title="Current inventory dashboard"
                  subtitle="Ratios and levels are computed from the latest submitted inventory."
                />
                <SummaryCards levels={submitResult.levels} ratios={submitResult.ratios} />
                <InventoryTable
                  categories={orderedCategories}
                  levels={submitResult.levels}
                  ratios={submitResult.ratios}
                />
              </Card>
            )}
            <StickyActionBar>
              <div className="mx-auto flex w-full max-w-5xl flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <Button type="button" onClick={submitInventory} disabled={submitting} block size="lg">
                  {submitting ? "Submitting..." : "Submit inventory"}
                </Button>
                <span className="text-center text-xs text-slate-500 dark:text-slate-400 sm:text-left">
                  This writes the latest inventory snapshot for pantry {effectivePantryId}.
                </span>
              </div>
            </StickyActionBar>
          </>
        )}
        {!loadError && inventory && Object.keys(inventory).length === 0 && (
          <EmptyState
            title="No inventory values found"
            description="Return to upload and run detection again before submitting."
            action={
              <Link
                href={`/${pantryId}/upload${isDirector && effectivePantryId ? `?targetPantryId=${effectivePantryId}` : ""}`}
                className="text-sky-600 underline dark:text-sky-400"
              >
                Go to upload
              </Link>
            }
          />
        )}
      </div>
    </AppShell>
  );
}
