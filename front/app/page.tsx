"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();
  const pantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <main className="flex flex-col items-center gap-8 px-6 w-full max-w-xs">
        {status === "loading" && (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}

        {status === "unauthenticated" && (
          <div className="flex flex-col gap-4 w-full">
            <Link
              href="/login?callbackUrl=/volunteer"
              className="rounded-xl bg-zinc-900 px-8 py-4 text-base font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 text-center"
            >
              I am a volunteer
            </Link>
            <Link
              href="/login?callbackUrl=/manager"
              className="rounded-xl border border-zinc-300 px-8 py-4 text-base font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800 text-center"
            >
              I am a manager
            </Link>
          </div>
        )}

        {status === "authenticated" && pantryId && (
          <div className="flex flex-col gap-4 w-full">
            <Link
              href={`/${pantryId}/upload`}
              className="rounded-xl bg-zinc-900 px-8 py-4 text-base font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 text-center"
            >
              I am a volunteer
            </Link>
            <Link
              href="/manager"
              className="rounded-xl border border-zinc-300 px-8 py-4 text-base font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800 text-center"
            >
              I am a manager
            </Link>
          </div>
        )}

        {status === "authenticated" && !pantryId && (
          <p className="text-sm text-zinc-500">No pantry ID in session.</p>
        )}
      </main>
    </div>
  );
}
