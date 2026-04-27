"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppShellLink = {
  label: string;
  href: string;
};

type AppShellProps = {
  title: string;
  subtitle?: string;
  links?: AppShellLink[];
  rightAction?: ReactNode;
  children: ReactNode;
};

export default function AppShell({ title, subtitle, links, rightAction, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-[100dvh]">
      <header
        className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>
          {rightAction && (
            <div className="flex shrink-0 items-center gap-2">{rightAction}</div>
          )}
        </div>
        {links && links.length > 0 && (
          <nav
            className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-4 pb-2.5 sm:px-6"
            aria-label="Page links"
          >
            {links.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition ${
                    isActive
                      ? "border-sky-500 bg-sky-500 text-white shadow-sm shadow-sky-500/20 dark:border-sky-400 dark:bg-sky-500"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      <main
        className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>
    </div>
  );
}
