/******************************** Select.tsx ***************************************
 *
 *  Module: Select Component
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
import type { SelectHTMLAttributes, ReactNode } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export default function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <select
      className={`w-full rounded-xl border border-slate-300/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-500 dark:focus:ring-slate-700 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
