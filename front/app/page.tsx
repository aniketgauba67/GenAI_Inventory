"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const pantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;
  const [directorMessage, setDirectorMessage] = useState<string | null>(null);

  function handleDirectorClick() {
    setDirectorMessage(null);

    if (status === "loading") return;

    if (status !== "authenticated") {
      router.push("/login?callbackUrl=/director/dashboard");
      return;
    }

    if (pantryId === "director") {
      router.push("/director/dashboard");
      return;
    }

    setDirectorMessage("You do not have the required credentials for the director dashboard.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <main className="w-full max-w-3xl">
        <Card className="flex flex-col gap-8 p-8 sm:p-10">
        <div className="text-center">
          <p className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300">
            Food Pantry Operations
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">Inventory Control Center</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Choose your role to continue with shelf detection, inventory review, and stock-level submission.
          </p>
        </div>

        {status === "loading" && (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}

        {status === "unauthenticated" && (
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <Link
              href="/login?callbackUrl=/volunteer"
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Volunteer</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Upload shelf photos and review detected counts.</p>
            </Link>
            <Link
              href="/login?callbackUrl=/manager"
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Manager</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Upload warehouse forms and update baseline stock.</p>
            </Link>
          </div>
        )}

        {status === "authenticated" && pantryId && (
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <Link
              href={`/${pantryId}/upload`}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Volunteer</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Go to upload and submit current shelf counts.</p>
            </Link>
            <Link
              href="/manager"
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Manager</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Open manager tools and baseline updates.</p>
            </Link>
          </div>
        )}

        {status === "authenticated" && !pantryId && (
          <p className="text-sm text-zinc-500">No pantry ID in session.</p>
        )}

        {status === "authenticated" && (
          <Button block variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
            Switch account
          </Button>
        )}

        <div className="w-full border-t border-slate-200 pt-6 dark:border-slate-700">
          <Button block variant="ghost" size="lg" onClick={handleDirectorClick} disabled={status === "loading"}>
            I am the director
          </Button>
          {directorMessage && (
            <p className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
              {directorMessage}
            </p>
          )}
        </div>
        </Card>
      </main>
    </div>
  );
}
