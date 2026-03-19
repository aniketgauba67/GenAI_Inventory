"use client";

type RatioBarProps = {
  ratio: number;
};

function getBarClass(ratio: number): string {
  if (ratio > 0.7) return "bg-emerald-500";
  if (ratio > 0.3) return "bg-amber-500";
  if (ratio <= 0) return "bg-zinc-400";
  return "bg-rose-500";
}

export default function RatioBar({ ratio }: RatioBarProps) {
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, ratio) : 0;
  const percent = Math.min(safeRatio * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className={`h-full rounded-full transition-all ${getBarClass(safeRatio)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-16 text-right text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {(safeRatio * 100).toFixed(1)}%
      </span>
    </div>
  );
}
