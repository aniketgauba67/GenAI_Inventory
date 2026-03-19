"use client";

type SummaryCardsProps = {
  levels: Record<string, string>;
  ratios: Record<string, number>;
};

function countLevels(levels: Record<string, string>) {
  const counts = { High: 0, Mid: 0, Low: 0, Out: 0 };
  Object.values(levels).forEach((level) => {
    if (level === "High") counts.High += 1;
    else if (level === "Mid") counts.Mid += 1;
    else if (level === "Out") counts.Out += 1;
    else counts.Low += 1;
  });
  return counts;
}

export default function SummaryCards({ levels, ratios }: SummaryCardsProps) {
  const counts = countLevels(levels);
  const ratioValues = Object.values(ratios).map((v) => Number(v) || 0);
  const avgRatio =
    ratioValues.length > 0
      ? ratioValues.reduce((sum, value) => sum + value, 0) / ratioValues.length
      : 0;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <div className="rounded-xl bg-white p-3 dark:bg-zinc-900">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">High</p>
        <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">{counts.High}</p>
      </div>
      <div className="rounded-xl bg-white p-3 dark:bg-zinc-900">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Mid</p>
        <p className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400">{counts.Mid}</p>
      </div>
      <div className="rounded-xl bg-white p-3 dark:bg-zinc-900">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Low</p>
        <p className="mt-1 text-lg font-semibold text-rose-600 dark:text-rose-400">{counts.Low}</p>
      </div>
      <div className="rounded-xl bg-white p-3 dark:bg-zinc-900">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Out</p>
        <p className="mt-1 text-lg font-semibold text-zinc-700 dark:text-zinc-200">{counts.Out}</p>
      </div>
      <div className="rounded-xl bg-white p-3 dark:bg-zinc-900">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Avg Ratio</p>
        <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          {(avgRatio * 100).toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
