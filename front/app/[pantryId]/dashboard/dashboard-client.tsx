"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type DashboardLink = {
  label: string;
  href: string;
  description: string;
};

type PantryCredential = {
  pantryId: string;
  password: string;
};

type DashboardClientProps = {
  pantryId: string;
  links: DashboardLink[];
  initialCredentials: PantryCredential[];
};

export default function DashboardClient({
  pantryId,
  links,
  initialCredentials,
}: DashboardClientProps) {
  const [credentials, setCredentials] = useState<PantryCredential[]>(initialCredentials);
  const [rowDrafts, setRowDrafts] = useState<Record<string, string>>({});
  const [rowNotice, setRowNotice] = useState<Record<string, string>>({});

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showOwnPasswordForm, setShowOwnPasswordForm] = useState(false);
  const [ownPassword, setOwnPassword] = useState("passkey");
  const [ownPasswordDraft, setOwnPasswordDraft] = useState(ownPassword);
  const [ownPasswordNotice, setOwnPasswordNotice] = useState<string | null>(null);

  const draftById = useMemo(() => {
    const next: Record<string, string> = {};
    credentials.forEach((cred) => {
      next[cred.pantryId] = rowDrafts[cred.pantryId] ?? cred.password;
    });
    return next;
  }, [credentials, rowDrafts]);

  function updateDraft(pantryIdValue: string, value: string) {
    setRowDrafts((prev) => ({ ...prev, [pantryIdValue]: value }));
  }

  function saveRowPassword(pantryIdValue: string) {
    const nextPassword = (draftById[pantryIdValue] ?? "").trim();
    if (!nextPassword) {
      setRowNotice((prev) => ({
        ...prev,
        [pantryIdValue]: "Password cannot be empty.",
      }));
      return;
    }

    setCredentials((prev) =>
      prev.map((cred) =>
        cred.pantryId === pantryIdValue ? { ...cred, password: nextPassword } : cred
      )
    );

    setRowNotice((prev) => ({
      ...prev,
      [pantryIdValue]: "Password updated locally (placeholder only).",
    }));
  }

  function saveOwnPassword() {
    const nextOwnPassword = ownPasswordDraft.trim();
    if (!nextOwnPassword) {
      setOwnPasswordNotice("Password cannot be empty.");
      return;
    }

    setOwnPassword(nextOwnPassword);
    setOwnPasswordNotice("Your password was updated locally (placeholder only).");
    setShowOwnPasswordForm(false);
    setSettingsOpen(false);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-100 px-4 py-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl dark:bg-cyan-500/10" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-500/10" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-3xl border border-white/70 bg-white/90 p-5 shadow-lg shadow-zinc-300/30 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-black/20 lg:sticky lg:top-6">
          <div className="mb-6 border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              Control Center
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Director Dashboard</h1>
          </div>

          <nav className="flex flex-col gap-2" aria-label="Dashboard navigation">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="group rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 transition hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{link.label}</p>
                <p className="text-xs text-zinc-500 transition group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300">
                  {link.description}
                </p>
              </Link>
            ))}
          </nav>
        </aside>

        <section className="relative rounded-3xl border border-white/70 bg-white/90 p-5 shadow-lg shadow-zinc-300/30 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-black/20 sm:p-7">
          <div className="absolute right-5 top-5 z-20 sm:right-7 sm:top-7">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen((prev) => !prev)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Settings
              </button>

              {settingsOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOwnPasswordForm((prev) => !prev);
                      setOwnPasswordNotice(null);
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Change My Password
                  </button>

                  {showOwnPasswordForm && (
                    <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Director account: {pantryId}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Current placeholder password: <span className="font-mono">{ownPassword}</span>
                      </p>
                      <input
                        value={ownPasswordDraft}
                        onChange={(e) => setOwnPasswordDraft(e.target.value)}
                        type="text"
                        placeholder="Enter new password"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                      />
                      <button
                        type="button"
                        onClick={saveOwnPassword}
                        className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        Save My Password
                      </button>
                      {ownPasswordNotice && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">{ownPasswordNotice}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mb-5 flex flex-col gap-3 pr-20 sm:flex-row sm:items-end sm:justify-between sm:pr-24">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                Credential Registry
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Pantry IDs and Passwords</h2>
              <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                Sample credentials are shown for now. This section will be replaced with live data
                from the pantry directory database.
              </p>
            </div>
            <div className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              {credentials.length} active placeholders
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full">
              <thead className="bg-zinc-100/80 dark:bg-zinc-800/70">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                    Pantry ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                    Password
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                    Update Password
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                {credentials.map((cred) => (
                  <tr
                    key={cred.pantryId}
                    className="align-top transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {cred.pantryId}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-zinc-700 dark:text-zinc-300">
                      {cred.password}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[240px] flex-col gap-2">
                        <input
                          value={draftById[cred.pantryId]}
                          onChange={(e) => updateDraft(cred.pantryId, e.target.value)}
                          type="text"
                          placeholder="New password"
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                        />
                        <button
                          type="button"
                          onClick={() => saveRowPassword(cred.pantryId)}
                          className="self-start rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                          Update
                        </button>
                        {rowNotice[cred.pantryId] && (
                          <p className="text-xs text-emerald-700 dark:text-emerald-400">
                            {rowNotice[cred.pantryId]}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
