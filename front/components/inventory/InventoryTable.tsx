"use client";

import { useMemo, useState } from "react";
import LevelBadge from "./LevelBadge";
import RatioBar from "./RatioBar";

type InventoryTableProps = {
  categories: string[];
  ratios: Record<string, number>;
  levels: Record<string, string>;
};

type SortKey = "category" | "ratio" | "level";

export default function InventoryTable({ categories, ratios, levels }: InventoryTableProps) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("category");
  const [descending, setDescending] = useState(false);
  const [levelFilter, setLevelFilter] = useState<"all" | "High" | "Mid" | "Low" | "Out">("all");

  const rows = useMemo(() => {
    const filtered = categories
      .map((category) => ({
        category,
        ratio: Number(ratios[category] ?? 0),
        level: levels[category] ?? "Low",
      }))
      .filter((row) => row.category.toLowerCase().includes(query.toLowerCase()))
      .filter((row) => levelFilter === "all" || row.level === levelFilter);

    filtered.sort((a, b) => {
      if (sortBy === "ratio") return a.ratio - b.ratio;
      if (sortBy === "level") return a.level.localeCompare(b.level);
      return a.category.localeCompare(b.category);
    });

    if (descending) filtered.reverse();
    return filtered;
  }, [categories, ratios, levels, query, sortBy, descending, levelFilter]);

  const sortButtonClass = (key: SortKey) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition ${
      sortBy === key
        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
        : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
    }`;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-zinc-900">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Category status</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{rows.length} categories shown</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSortBy("category")}
              className={sortButtonClass("category")}
            >
              Category
            </button>
            <button
              type="button"
              onClick={() => setSortBy("ratio")}
              className={sortButtonClass("ratio")}
            >
              Ratio
            </button>
            <button
              type="button"
              onClick={() => setSortBy("level")}
              className={sortButtonClass("level")}
            >
              Level
            </button>
            <button
              type="button"
              onClick={() => setDescending((prev) => !prev)}
              className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              {descending ? "Desc" : "Asc"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter categories..."
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-zinc-800 dark:text-zinc-100 sm:max-w-xs"
        />
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "High", "Mid", "Low", "Out"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setLevelFilter(level)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  levelFilter === level
                    ? "bg-sky-600 text-white dark:bg-sky-500"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {level === "all" ? "All levels" : level}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No categories match your filters.
          </div>
        )}
        {rows.map((row) => (
          <div
            key={row.category}
            className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50/70 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-zinc-800/40 md:grid-cols-[1.2fr_2fr_auto]"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.category}</p>
            <RatioBar ratio={row.ratio} />
            <div className="justify-self-start md:justify-self-end">
              <LevelBadge level={row.level} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
