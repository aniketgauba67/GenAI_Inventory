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
    <span className={`inline-flex min-w-14 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {level}
    </span>
  );
}
