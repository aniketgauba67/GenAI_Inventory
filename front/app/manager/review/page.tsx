"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  pantryId?: string;
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
  const { showToast } = useToast();
  const { data: session, status } = useSession();
  const router = useRouter();
  const sessionPantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;

  const [inventory, setInventory] = useState<InventoryRecord | null>(null);
  const [targetPantryId, setTargetPantryId] = useState<string>("");
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
        showToast("No order form draft found.", "error");
        return;
      }
      const draft: DraftData = JSON.parse(raw);
      if (!draft.inventory) {
        setLoadError("Invalid draft data.");
        showToast("Invalid order form draft data.", "error");
        return;
      }
      const resolvedPantryId = draft.pantryId || sessionPantryId || "";
      if (!resolvedPantryId) {
        setLoadError("No target pantry selected.");
        showToast("No target pantry selected.", "error");
        return;
      }
      setTargetPantryId(resolvedPantryId);
      setInventory(draft.inventory);
      setDraftMeta(draft);
    } catch {
      setLoadError("Could not load draft.");
      showToast("Could not load order form draft.", "error");
    }
  }, [sessionPantryId, showToast, status]);

  const rows = useMemo(() => {
    if (!inventory) return [];
    return orderedCategories.map((category) => ({
      category,
      quantity: Number(inventory[category] ?? 0),
    }));
  }, [inventory]);

  const totalBaseline = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    [rows]
  );

  function updateQuantity(category: string, value: string) {
    const quantity = Number(value);
    if (Number.isNaN(quantity)) return;
    setInventory((prev) => ({ ...(prev ?? {}), [category]: Math.max(0, quantity) }));
  }

  async function submitBaseline() {
    if (!inventory) return;
    if (!targetPantryId) {
      setSubmitError("Pantry ID missing from session.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`${apiBase}/manager/inventory/${targetPantryId}`, {
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
        showToast("Baseline inventory saved.", "success");
        router.push("/manager");
      } else {
        setSubmitError(data.error || "Failed to update baseline inventory.");
        showToast(data.error || "Failed to update baseline inventory.", "error");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Network error");
      showToast("Network error while saving baseline inventory.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return null;
  }

  return (
    <AppShell
      title="Manager Review"
      subtitle={`Review extracted order-form counts and save baseline inventory for pantry ${targetPantryId || "-"}`}
      rightAction={<Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>Switch account</Button>}
      links={[
        { label: "Home", href: "/" },
        { label: "Upload", href: "/manager" },
      ]}
    >
      <div className="mx-auto max-w-3xl space-y-4 pb-24">
        <Card>
          <FlowStepper steps={["Upload", "Review", "Save Baseline"]} currentStep={1} />
        </Card>
        {loadError && (
          <Alert tone="error">
            {loadError}
            <div className="mt-3">
              <Link href="/manager" className="text-blue-600 dark:text-blue-400 underline">
                Back to Manager
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
              <p className="font-medium text-zinc-900 dark:text-zinc-100">Extracted counts</p>
              <p className="mt-1">
                These counts were extracted from the order form image. Review and edit if needed.
              </p>
              {draftMeta?.files && draftMeta.files.length > 0 && (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Image(s) processed: {draftMeta.files.length}
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Total baseline items: {totalBaseline}
              </p>
            </Card>

            <Card>
              <SectionHeader
                title="Editable baseline quantities"
                subtitle="Update any category before saving as baseline."
              />
              <CategoryGroupEditor values={inventory} onChange={updateQuantity} inputPrefix="mgr" />
            </Card>

            <Card className="space-y-4">
              <SectionHeader
                title="Save Baseline Inventory"
                subtitle="This will update the total available stock for your pantry."
              />

              {submitError && (
                <Alert tone="error">{submitError}</Alert>
              )}

              <div className="flex flex-col gap-3">
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
                <Button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  block
                  variant="ghost"
                  size="lg"
                >
                  Switch account
                </Button>
              </div>
            </Card>
            <StickyActionBar>
              <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
                <Button
                  type="button"
                  onClick={submitBaseline}
                  disabled={submitting}
                  block
                  size="lg"
                >
                  {submitting ? "Saving baseline..." : "Confirm and save baseline"}
                </Button>
              </div>
            </StickyActionBar>
          </>
        )}
        {!loadError && inventory && Object.keys(inventory).length === 0 && (
          <EmptyState
            title="No baseline values found"
            description="Return to manager upload and extract order form data again."
            action={
              <Link href="/manager" className="text-sky-600 underline dark:text-sky-400">
                Go to manager upload
              </Link>
            }
          />
        )}
      </div>
    </AppShell>
  );
}
