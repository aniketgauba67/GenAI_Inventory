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

  const rows = useMemo(() => {
    const filtered = categories
      .map((category) => ({
        category,
        ratio: Number(ratios[category] ?? 0),
        level: levels[category] ?? "Low",
      }))
      .filter((row) => row.category.toLowerCase().includes(query.toLowerCase()));

    filtered.sort((a, b) => {
      if (sortBy === "ratio") return a.ratio - b.ratio;
      if (sortBy === "level") return a.level.localeCompare(b.level);
      return a.category.localeCompare(b.category);
    });

    if (descending) filtered.reverse();
    return filtered;
  }, [categories, ratios, levels, query, sortBy, descending]);

  return (
    <section className="rounded-xl bg-white p-4 dark:bg-zinc-900">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter categories..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:max-w-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSortBy("category")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${sortBy === "category" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"}`}
          >
            Category
          </button>
          <button
            type="button"
            onClick={() => setSortBy("ratio")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${sortBy === "ratio" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"}`}
          >
            Ratio
          </button>
          <button
            type="button"
            onClick={() => setSortBy("level")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${sortBy === "level" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"}`}
          >
            Level
          </button>
          <button
            type="button"
            onClick={() => setDescending((prev) => !prev)}
            className="rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
          >
            {descending ? "Desc" : "Asc"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.category}
            className="grid grid-cols-1 gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 md:grid-cols-[1.2fr_2fr_auto]"
          >
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{row.category}</p>
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
