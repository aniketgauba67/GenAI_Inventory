import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger";

type BadgeProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

const toneMap: Record<Tone, string> = {
  neutral: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
};

export default function Badge({ children, tone = "neutral", className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneMap[tone]} ${className}`}>
      {children}
    </span>
  );
}
