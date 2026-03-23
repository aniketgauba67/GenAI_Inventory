import Link from "next/link";
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
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          {rightAction}
        </div>
        {links && links.length > 0 && (
          <nav className="mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6" aria-label="Page links">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
