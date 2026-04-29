/******************************** Card.tsx ***************************************
 *
 *  Module: Card Component
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
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/95 ${className}`}
    >
      {children}
    </section>
  );
}
