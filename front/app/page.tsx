"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LevelBadge from "../components/inventory/LevelBadge";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";

type PantryRecord = {
  pantryId: string;
  name: string;
  location: string | null;
  lastUpdated: string | null;
  levels: Record<string, string>;
  originalQuantities: Record<string, number>;
};

const CATEGORY_ORDER = [
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

const accessLinks = [
  { label: "Volunteer", href: "/login?callbackUrl=/volunteer" },
  { label: "Manager", href: "/login?callbackUrl=/manager" },
  { label: "Director", href: "/login?callbackUrl=/director/dashboard" },
];

function pickRandomPantryId(pantries: PantryRecord[]): string {
  if (pantries.length === 0) return "";
  const randomIndex = Math.floor(Math.random() * pantries.length);
  return pantries[randomIndex].pantryId;
}

export default function HomePage() {
  const [pantries, setPantries] = useState<PantryRecord[]>([]);
  const [selectedPantryId, setSelectedPantryId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBase =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : "";

  useEffect(() => {
    let ignore = false;

    async function loadPantries() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBase}/customer/pantries`, { cache: "no-store" });
        const data = (await response.json()) as {
          ok?: boolean;
          pantries?: PantryRecord[];
          error?: string;
        };

        if (!response.ok || !data.ok || !Array.isArray(data.pantries)) {
          if (!ignore) {
            setError(data.error || "Could not load pantry availability.");
            setPantries([]);
          }
          return;
        }

        if (!ignore) {
          setPantries(data.pantries);
          setSelectedPantryId(pickRandomPantryId(data.pantries));
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Could not load pantry availability.");
          setPantries([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    if (apiBase) {
      void loadPantries();
    }

    return () => {
      ignore = true;
    };
  }, [apiBase]);

  const filteredPantries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return pantries;

    return pantries.filter((pantry) => {
      return (
        pantry.pantryId.toLowerCase().includes(normalizedQuery) ||
        pantry.name.toLowerCase().includes(normalizedQuery) ||
        (pantry.location || "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [pantries, query]);

  const activePantry = useMemo(() => {
    if (pantries.length === 0) return null;

    const selected = pantries.find((pantry) => pantry.pantryId === selectedPantryId) || null;
    const selectedVisible = filteredPantries.find((pantry) => pantry.pantryId === selectedPantryId) || null;

    if (selectedVisible) return selectedVisible;
    if (filteredPantries.length > 0) return filteredPantries[0];
    return selected || pantries[0];
  }, [pantries, filteredPantries, selectedPantryId]);

  return (
    <main className="min-h-screen px-3 py-5 sm:px-5 sm:py-7 lg:px-8 xl:px-10">
      <div className="w-full max-w-none space-y-4">
        <Card className="p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Customer Pantry View
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Pantry Locations and Availability
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Browse pantry addresses and availability levels by category.
          </p>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card className="h-fit p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Access
            </p>
            <div className="mt-3 space-y-2">
              {accessLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="block rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search pantry by id, name, or address"
                  className="sm:max-w-md"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {loading ? "Loading pantries..." : `${filteredPantries.length} pantry result(s)`}
                </p>
              </div>
            </Card>

            {error && (
              <Card className="border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </Card>
            )}

            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
              <Card className="p-4">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pantry List</p>
                <div className="mt-3 space-y-2">
                  {!loading && filteredPantries.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No pantries match your search.
                    </p>
                  )}
                  {filteredPantries.map((pantry) => {
                    const selected = activePantry?.pantryId === pantry.pantryId;
                    return (
                      <button
                        key={pantry.pantryId}
                        type="button"
                        onClick={() => setSelectedPantryId(pantry.pantryId)}
                        className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                          selected
                            ? "border-sky-500 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40"
                            : "border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {pantry.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Pantry ID: {pantry.pantryId}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {pantry.location || "Address not available"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-4 sm:p-5">
                {!activePantry && !loading && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No pantry selected.
                  </p>
                )}
                {activePantry && (
                  <>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {activePantry.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {activePantry.location || "Address not available"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Pantry ID: {activePantry.pantryId}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Last updated: {activePantry.lastUpdated ? new Date(activePantry.lastUpdated).toLocaleString() : "Not available"}
                    </p>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                      {CATEGORY_ORDER.map((category) => (
                        <div
                          key={category}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <div className="min-w-0">
                            <span className="text-sm text-slate-700 dark:text-slate-200">{category}</span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Original: {Number(activePantry.originalQuantities?.[category] ?? 0)}
                            </p>
                          </div>
                          <LevelBadge level={activePantry.levels[category] || "Low"} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
