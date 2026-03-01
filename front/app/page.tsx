"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();
  const pantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
      <main className="flex flex-col items-center gap-8 px-6">
        {status === "loading" && (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}
        {status === "unauthenticated" && (
          <Link
            href="/login"
            className="rounded-xl bg-zinc-900 px-8 py-4 text-base font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            I am a volunteer
          </Link>
        )}
        {status === "authenticated" && pantryId && (
          <Link
            href={`/${pantryId}/upload`}
            className="rounded-xl bg-zinc-900 px-8 py-4 text-base font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            I am a volunteer
          </Link>
        )}
        {status === "authenticated" && !pantryId && (
          <p className="text-sm text-zinc-500">No pantry ID in session.</p>
        )}
      </main>
    </div>
  );
}
