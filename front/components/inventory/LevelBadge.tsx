"use client";

type LevelBadgeProps = {
  level: string;
};

const levelStyles: Record<string, string> = {
  High: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  Mid: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Low: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  Out: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
};

export default function LevelBadge({ level }: LevelBadgeProps) {
  const style = levelStyles[level] ?? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200";
  return (
    <span className={`inline-flex min-w-12 justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      {level}
    </span>
  );
}
