/******************************** Skeleton.tsx ***************************************
 *
 *  Module: Skeleton Component
 *
 *  This module provides a reusable styled control for the frontend
 *  interface.
 *
 *  The module provides:
 *
 *  - consistent Tailwind styling.
 *  - typed React props for reuse.
 *  - accessible markup patterns where applicable.
 *
 *  Key Structures Used:
 *
 *  - React component props, class maps, and shared UI primitives.
 *
 *  This module ensures:
 *
 *  - common controls stay visually consistent.
 *  - pages avoid duplicating low-level UI markup.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
type SkeletonProps = {
  className?: string;
};

export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-700 ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10" />
    </div>
  );
}
