import type { ReactNode } from "react";

type StickyActionBarProps = {
  children: ReactNode;
};

export default function StickyActionBar({ children }: StickyActionBarProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200/90 bg-white/90 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-10px_28px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/92 dark:shadow-[0_-8px_24px_rgba(0,0,0,0.35)] sm:-mx-6 sm:px-6">
      {children}
    </div>
  );
}
