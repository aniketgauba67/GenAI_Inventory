/******************************** LevelBadge.tsx ***************************************
 *
 *  Module: LevelBadge Component
 *
 *  This module renders inventory status data in a reusable frontend
 *  component.
 *
 *  The module provides:
 *
 *  - inventory quantity or status display.
 *  - shared formatting for customer and staff screens.
 *
 *  Key Structures Used:
 *
 *  - React props, category labels, ratios, and level values.
 *
 *  This module ensures:
 *
 *  - inventory data is displayed consistently across views.
 *  - status details stay easy to scan.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
"use client";

type LevelBadgeProps = {
  level: string;
  size?: "sm" | "lg";
  friendlyText?: boolean;
  className?: string;
};

const levelStyles: Record<string, string> = {
  High: "tone-emerald bg-[#e5f2df] text-[#237b3c]",
  Mid: "tone-amber bg-[#fff1c8] text-[#a86f10]",
  Low: "tone-rose bg-[#ffe6dd] text-[#b44736]",
  Out: "tone-zinc bg-[#f8ded9] text-[#a53a34]",
};

const levelLabels: Record<string, { short: string; friendly: string }> = {
  High: { short: "High", friendly: "High stock" },
  Mid: { short: "Medium", friendly: "Medium stock" },
  Low: { short: "Low", friendly: "Needs restock" },
  Out: { short: "Out", friendly: "Out of stock" },
};

export default function LevelBadge({
  level,
  size = "sm",
  friendlyText = false,
  className = "",
}: LevelBadgeProps) {
  const style = levelStyles[level] ?? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200";
  const labelSet = levelLabels[level] ?? levelLabels.Out;
  const sizeClass =
    size === "lg"
      ? "min-w-28 px-3.5 py-2 text-sm"
      : "min-w-14 px-2.5 py-1 text-xs";
  return (
    <span
      role="img"
      aria-label={`Stock level: ${friendlyText ? labelSet.friendly : labelSet.short}`}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold ${sizeClass} ${style} ${className}`}
    >
      <span className={`${size === "lg" ? "h-2 w-2" : "h-1.5 w-1.5"} rounded-full bg-current opacity-80`} aria-hidden="true" />
      {friendlyText ? labelSet.friendly : labelSet.short}
    </span>
  );
}
