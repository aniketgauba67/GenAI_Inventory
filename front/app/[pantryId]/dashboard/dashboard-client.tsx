"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import SectionHeader from "../../../components/ui/SectionHeader";
import EmptyState from "../../../components/ui/EmptyState";
import Skeleton from "../../../components/ui/Skeleton";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import { useToast } from "../../../components/ui/Toast";

type DashboardLink = {
  label: string;
  href: string;
  description: string;
};

type PantryCredential = {
  pantryId: string;
  name: string;
  location: string | null;
  hasCredentials: boolean;
};

type PantryManageDraft = {
  name: string;
  location: string;
  newPassword: string;
};

type DashboardClientProps = {
  pantryId: string;
  links: DashboardLink[];
};

export default function DashboardClient({
  pantryId,
  links,
}: DashboardClientProps) {
  const { showToast } = useToast();
  const apiBase =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
      : "";
  const [credentials, setCredentials] = useState<PantryCredential[]>([]);
  const [rowDrafts, setRowDrafts] = useState<Record<string, PantryManageDraft>>({});
  const [rowNotice, setRowNotice] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);
  const [loadingCredentials, setLoadingCredentials] = useState(true);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [credentialQuery, setCredentialQuery] = useState("");
  const [credentialFilter, setCredentialFilter] = useState<"all" | "configured" | "missing">("all");

  const [showCreatePantryForm, setShowCreatePantryForm] = useState(false);
  const [newPantryName, setNewPantryName] = useState("");
  const [newPantryLocation, setNewPantryLocation] = useState("");
  const [newPantryPassword, setNewPantryPassword] = useState("");
  const [createPantryNotice, setCreatePantryNotice] = useState<string | null>(null);
  const [createPantryError, setCreatePantryError] = useState<string | null>(null);
  const [creatingPantry, setCreatingPantry] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showOwnPasswordForm, setShowOwnPasswordForm] = useState(false);
  const [ownPasswordDraft, setOwnPasswordDraft] = useState("");
  const [ownPasswordNotice, setOwnPasswordNotice] = useState<string | null>(null);
  const [ownPasswordError, setOwnPasswordError] = useState<string | null>(null);
  const [savingOwnPassword, setSavingOwnPassword] = useState(false);
  const [deleteTargetPantryId, setDeleteTargetPantryId] = useState<string | null>(null);

  async function loadCredentials() {
    setLoadingCredentials(true);
    setCredentialsError(null);

    try {
      const response = await fetch(`${apiBase}/auth/pantry-credentials`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        ok?: boolean;
        pantries?: PantryCredential[];
        error?: string;
      };

      if (!response.ok || !data.ok || !data.pantries) {
        setCredentialsError(data.error || "Failed to load pantry credentials.");
        showToast(data.error || "Failed to load pantry credentials.", "error");
        return;
      }

      setCredentials(data.pantries);
    } catch (error) {
      setCredentialsError(
        error instanceof Error ? error.message : "Failed to load pantry credentials."
      );
      showToast("Failed to load pantry credentials.", "error");
    } finally {
      setLoadingCredentials(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await loadCredentials();
    })();

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, showToast]);

  const configuredCount = useMemo(
    () => credentials.filter((cred) => cred.hasCredentials).length,
    [credentials]
  );

  const missingCount = Math.max(credentials.length - configuredCount, 0);

  const filteredCredentials = useMemo(() => {
    return credentials
      .filter((cred) => {
        if (credentialFilter === "configured" && !cred.hasCredentials) return false;
        if (credentialFilter === "missing" && cred.hasCredentials) return false;
        if (!credentialQuery.trim()) return true;
        const q = credentialQuery.toLowerCase();
        return (
          cred.pantryId.toLowerCase().includes(q) ||
          cred.name.toLowerCase().includes(q) ||
          (cred.location ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.pantryId.localeCompare(b.pantryId));
  }, [credentials, credentialFilter, credentialQuery]);

  useEffect(() => {
    if (!ownPasswordNotice) return;
    const timeoutId = window.setTimeout(() => setOwnPasswordNotice(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [ownPasswordNotice]);

  useEffect(() => {
    if (!createPantryNotice) return;
    const timeoutId = window.setTimeout(() => setCreatePantryNotice(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [createPantryNotice]);

  useEffect(() => {
    const timers: number[] = [];
    Object.entries(rowNotice).forEach(([pantryIdValue, notice]) => {
      if (!notice) return;
      const id = window.setTimeout(() => {
        setRowNotice((prev) => ({ ...prev, [pantryIdValue]: "" }));
      }, 2500);
      timers.push(id);
    });

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [rowNotice]);

  function ensureRowDraft(pantryIdValue: string) {
    setRowDrafts((prev) => {
      if (prev[pantryIdValue]) return prev;
      return {
        ...prev,
        [pantryIdValue]: {
          name: "",
          location: "",
          newPassword: "",
        },
      };
    });
  }

  function updateRowDraftField(
    pantryIdValue: string,
    field: keyof PantryManageDraft,
    value: string
  ) {
    setRowDrafts((prev) => ({
      ...prev,
      [pantryIdValue]: {
        name: prev[pantryIdValue]?.name ?? "",
        location: prev[pantryIdValue]?.location ?? "",
        newPassword: prev[pantryIdValue]?.newPassword ?? "",
        [field]: value,
      },
    }));
  }

  function toggleRowMenu(pantryIdValue: string) {
    ensureRowDraft(pantryIdValue);
    setOpenRowMenu((prev) => (prev === pantryIdValue ? null : pantryIdValue));
  }

  async function saveRowUpdate(pantryIdValue: string) {
    const draft = rowDrafts[pantryIdValue] ?? { name: "", location: "", newPassword: "" };
    const payload = {
      pantryId: pantryIdValue,
      name: draft.name,
      location: draft.location,
      newPassword: draft.newPassword,
    };

    const hasAnyChange =
      payload.name.trim().length > 0 ||
      payload.location.trim().length > 0 ||
      payload.newPassword.trim().length > 0;
    if (!hasAnyChange) {
      setRowError((prev) => ({
        ...prev,
        [pantryIdValue]: "Fill at least one field to update.",
      }));
      return;
    }

    setSavingRows((prev) => ({ ...prev, [pantryIdValue]: true }));
    setRowError((prev) => ({ ...prev, [pantryIdValue]: "" }));
    setRowNotice((prev) => ({ ...prev, [pantryIdValue]: "" }));

    try {
      const response = await fetch(`${apiBase}/auth/pantry/manage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setRowError((prev) => ({
          ...prev,
          [pantryIdValue]: data.error || "Failed to update pantry information.",
        }));
        showToast(data.error || "Failed to update pantry information.", "error");
        return;
      }

      setRowDrafts((prev) => ({
        ...prev,
        [pantryIdValue]: { name: "", location: "", newPassword: "" },
      }));
      setRowNotice((prev) => ({
        ...prev,
        [pantryIdValue]: data.message || "Pantry updated.",
      }));
      showToast(data.message || "Pantry updated.", "success");
      setOpenRowMenu(null);
      await loadCredentials();
    } catch (error) {
      setRowError((prev) => ({
        ...prev,
        [pantryIdValue]:
          error instanceof Error ? error.message : "Failed to update pantry information.",
      }));
      showToast("Failed to update pantry information.", "error");
    } finally {
      setSavingRows((prev) => ({ ...prev, [pantryIdValue]: false }));
    }
  }

  async function deleteRowCredentials(pantryIdValue: string) {
    setSavingRows((prev) => ({ ...prev, [pantryIdValue]: true }));
    setRowError((prev) => ({ ...prev, [pantryIdValue]: "" }));
    setRowNotice((prev) => ({ ...prev, [pantryIdValue]: "" }));

    try {
      const response = await fetch(`${apiBase}/auth/pantry/credentials/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pantryId: pantryIdValue }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setRowError((prev) => ({
          ...prev,
          [pantryIdValue]: data.error || "Failed to remove pantry credentials.",
        }));
        showToast(data.error || "Failed to remove pantry credentials.", "error");
        return;
      }

      setRowNotice((prev) => ({
        ...prev,
        [pantryIdValue]: data.message || "Pantry credentials removed.",
      }));
      showToast(data.message || "Pantry credentials removed.", "success");
      setOpenRowMenu(null);
      await loadCredentials();
    } catch (error) {
      setRowError((prev) => ({
        ...prev,
        [pantryIdValue]:
          error instanceof Error ? error.message : "Failed to remove pantry credentials.",
      }));
      showToast("Failed to remove pantry credentials.", "error");
    } finally {
      setSavingRows((prev) => ({ ...prev, [pantryIdValue]: false }));
    }
  }

  async function createPantryLogin() {
    const name = newPantryName.trim();
    const password = newPantryPassword.trim();
    const location = newPantryLocation.trim();

    if (!name || !password) {
      setCreatePantryError("Pantry name and password are required.");
      setCreatePantryNotice(null);
      return;
    }

    setCreatingPantry(true);
    setCreatePantryError(null);
    setCreatePantryNotice(null);

    try {
      const response = await fetch(`${apiBase}/auth/pantry/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          location,
          newPassword: password,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        pantry?: { pantryId: string };
      };

      if (!response.ok || !data.ok) {
        setCreatePantryError(data.error || "Failed to create pantry login.");
        showToast(data.error || "Failed to create pantry login.", "error");
        return;
      }

      setCreatePantryNotice(data.message || "Created pantry login.");
      showToast(data.message || "Created pantry login.", "success");
      setNewPantryName("");
      setNewPantryLocation("");
      setNewPantryPassword("");
      setShowCreatePantryForm(false);
      await loadCredentials();
    } catch (error) {
      setCreatePantryError(
        error instanceof Error ? error.message : "Failed to create pantry login."
      );
      showToast("Failed to create pantry login.", "error");
    } finally {
      setCreatingPantry(false);
    }
  }

  async function saveOwnPassword() {
    const nextOwnPassword = ownPasswordDraft.trim();
    if (!nextOwnPassword) {
      setOwnPasswordError("Password cannot be empty.");
      setOwnPasswordNotice(null);
      return;
    }

    setSavingOwnPassword(true);
    setOwnPasswordError(null);
    setOwnPasswordNotice(null);

    try {
      const response = await fetch(`${apiBase}/auth/director/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "director@example.com",
          newPassword: nextOwnPassword,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setOwnPasswordError(data.error || "Failed to update director password.");
        showToast(data.error || "Failed to update director password.", "error");
        return;
      }

      setOwnPasswordDraft("");
      setOwnPasswordNotice(data.message || "Director password updated.");
      showToast(data.message || "Director password updated.", "success");
      setShowOwnPasswordForm(false);
      setSettingsOpen(false);
    } catch (error) {
      setOwnPasswordError(
        error instanceof Error ? error.message : "Failed to update director password."
      );
      showToast("Failed to update director password.", "error");
    } finally {
      setSavingOwnPassword(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-100 px-4 py-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-orange-200/30 blur-3xl dark:bg-orange-500/10" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl dark:bg-orange-500/10" />
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
                className="group rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{link.label}</p>
                <p className="text-xs text-zinc-500 transition group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300">
                  {link.description}
                </p>
              </Link>
            ))}
          </nav>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Account
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Switch to another role or pantry login.
            </p>
            <Button type="button" onClick={() => signOut({ callbackUrl: "/" })} block variant="ghost" className="mt-3">
              Switch account
            </Button>
          </div>
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
                      setOwnPasswordError(null);
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
                        This will update the stored password for director@example.com in the database.
                      </p>
                      <input
                        value={ownPasswordDraft}
                        onChange={(e) => setOwnPasswordDraft(e.target.value)}
                        type="password"
                        placeholder="Enter new password"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                      />
                      <button
                        type="button"
                        onClick={saveOwnPassword}
                        disabled={savingOwnPassword}
                        className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        {savingOwnPassword ? "Saving..." : "Save My Password"}
                      </button>
                      {ownPasswordError && (
                        <p className="text-xs text-red-600 dark:text-red-400">{ownPasswordError}</p>
                      )}
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
            <SectionHeader
              title="Pantry Access Management"
              subtitle="Create and maintain pantry credentials. Passwords remain hashed and are never shown in plain text."
              className="mb-0"
            />
            <div className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              {loadingCredentials ? "Loading..." : `${filteredCredentials.length} shown / ${credentials.length} total`}
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Card className="rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total Pantries</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{credentials.length}</p>
            </Card>
            <Card className="rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Configured</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{configuredCount}</p>
            </Card>
            <Card className="rounded-2xl p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Missing Login</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">{missingCount}</p>
            </Card>
          </div>

          <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <button
              type="button"
              onClick={() => {
                setShowCreatePantryForm((prev) => !prev);
                setCreatePantryNotice(null);
                setCreatePantryError(null);
              }}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {showCreatePantryForm ? "Close" : "Create Pantry Login"}
          </button>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Use this only when a pantry needs first-time credentials or a reset.
          </p>

          {showCreatePantryForm && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  value={newPantryName}
                  onChange={(e) => setNewPantryName(e.target.value)}
                  type="text"
                  placeholder="Pantry name"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                />
                <input
                  value={newPantryLocation}
                  onChange={(e) => setNewPantryLocation(e.target.value)}
                  type="text"
                  placeholder="Location"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                />
                <input
                  value={newPantryPassword}
                  onChange={(e) => setNewPantryPassword(e.target.value)}
                  type="password"
                  placeholder="Initial password"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                />
                <button
                  type="button"
                  onClick={createPantryLogin}
                  disabled={creatingPantry}
                  className="sm:col-span-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {creatingPantry ? "Creating..." : "Create"}
                </button>
              </div>
            )}

            {createPantryError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{createPantryError}</p>
            )}
            {createPantryNotice && (
              <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                {createPantryNotice}
              </p>
            )}
          </div>

          <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input
                value={credentialQuery}
                onChange={(e) => setCredentialQuery(e.target.value)}
                placeholder="Search pantry ID, name, location..."
                className="sm:max-w-md"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCredentialFilter("all")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${credentialFilter === "all" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setCredentialFilter("configured")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${credentialFilter === "configured" ? "bg-emerald-600 text-white dark:bg-emerald-500" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"}`}
                >
                  Configured
                </button>
                <button
                  type="button"
                  onClick={() => setCredentialFilter("missing")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${credentialFilter === "missing" ? "bg-amber-500 text-white dark:bg-amber-500" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"}`}
                >
                  Missing
                </button>
              </div>
            </div>
          </div>

          {credentialsError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {credentialsError}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full">
              <thead className="bg-zinc-100/80 dark:bg-zinc-800/70">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                    Pantry ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                    Pantry
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                    Credential Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                    Manage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                {loadingCredentials && (
                  <>
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={`skeleton-${idx}`}>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-28" /></td>
                      </tr>
                    ))}
                  </>
                )}
                {!loadingCredentials && filteredCredentials.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6"
                    >
                      <EmptyState
                        title="No matching pantries"
                        description="Adjust search or filter to view pantry credentials."
                      />
                    </td>
                  </tr>
                )}
                {filteredCredentials.map((cred) => (
                  <tr
                    key={cred.pantryId}
                    className="align-top transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {cred.pantryId}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{cred.name}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {cred.location || "No location"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                      <Badge tone={cred.hasCredentials ? "success" : "warning"}>
                        {cred.hasCredentials ? "Configured" : "Missing"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[240px] flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => toggleRowMenu(cred.pantryId)}
                          className="self-start rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                          {openRowMenu === cred.pantryId ? "Close" : "Manage"}
                        </button>

                        {openRowMenu === cred.pantryId && (
                          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
                            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                              Leave any field blank to keep its current value.
                            </p>
                            <div className="flex flex-col gap-2">
                              <input
                                value={rowDrafts[cred.pantryId]?.name ?? ""}
                                onChange={(e) =>
                                  updateRowDraftField(cred.pantryId, "name", e.target.value)
                                }
                                type="text"
                                placeholder="New name"
                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                              />
                              <input
                                value={rowDrafts[cred.pantryId]?.location ?? ""}
                                onChange={(e) =>
                                  updateRowDraftField(cred.pantryId, "location", e.target.value)
                                }
                                type="text"
                                placeholder="New location"
                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                              />
                              <input
                                value={rowDrafts[cred.pantryId]?.newPassword ?? ""}
                                onChange={(e) =>
                                  updateRowDraftField(cred.pantryId, "newPassword", e.target.value)
                                }
                                type="password"
                                placeholder="New password"
                                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                              />
                              <button
                                type="button"
                                onClick={() => saveRowUpdate(cred.pantryId)}
                                disabled={savingRows[cred.pantryId]}
                                className="self-start rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                              >
                                {savingRows[cred.pantryId] ? "Saving..." : "Update"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTargetPantryId(cred.pantryId)}
                                disabled={savingRows[cred.pantryId]}
                                className="self-start rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/30"
                              >
                                {savingRows[cred.pantryId] ? "Working..." : "Remove Login Credentials"}
                              </button>
                            </div>
                          </div>
                        )}

                        {rowError[cred.pantryId] && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            {rowError[cred.pantryId]}
                          </p>
                        )}
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
      <ConfirmModal
        open={Boolean(deleteTargetPantryId)}
        title="Remove pantry credentials?"
        description={`This will remove login credentials for pantry ID ${deleteTargetPantryId ?? ""}. The pantry row remains, but login will be disabled.`}
        confirmLabel="Remove credentials"
        danger
        onCancel={() => setDeleteTargetPantryId(null)}
        onConfirm={async () => {
          if (!deleteTargetPantryId) return;
          await deleteRowCredentials(deleteTargetPantryId);
          setDeleteTargetPantryId(null);
        }}
        loading={deleteTargetPantryId ? Boolean(savingRows[deleteTargetPantryId]) : false}
      />
    </main>
  );
}
