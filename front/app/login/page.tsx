/******************************** page.tsx ***************************************
 *
 *  Module: Frontend App Route
 *
 *  This module renders a Next.js route for the GenAI Inventory user
 *  interface.
 *
 *  The module provides:
 *
 *  - route-level layout or page rendering.
 *  - connections to shared frontend components and helpers.
 *
 *  Key Structures Used:
 *
 *  - Next.js App Router files, React components, and route params.
 *
 *  This module ensures:
 *
 *  - the screen follows the shared application workflow.
 *  - route code remains close to its user-facing page.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { FormEvent, KeyboardEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";

function resolveAuthenticatedTarget(
  rawCallbackUrl: string | null,
  sessionPantryId?: string,
  sessionRole?: string,
) {
  const pantryId = sessionPantryId || "";
  const role = sessionRole || (pantryId === "director" ? "director" : pantryId ? "pantry" : "");

  const defaultTarget =
    role === "director"
      ? "/director/dashboard"
      : pantryId
        ? `/${pantryId}/upload`
        : "/";

  if (!rawCallbackUrl || rawCallbackUrl === "/") {
    return defaultTarget;
  }

  let resolved = rawCallbackUrl;
  if (!rawCallbackUrl.startsWith("/")) {
    try {
      const url = new URL(rawCallbackUrl, window.location.origin);
      if (url.origin === window.location.origin) resolved = url.pathname + url.search;
    } catch {
      return defaultTarget;
    }
  }

  if (resolved === "/volunteer") {
    return role === "pantry" && pantryId ? `/${pantryId}/upload` : defaultTarget;
  }
  if (resolved === "/manager") {
    return role === "pantry" && pantryId ? "/manager" : defaultTarget;
  }
  if (resolved === "/director/dashboard") {
    return role === "director" ? "/director/dashboard" : defaultTarget;
  }

  return resolved;
}

function isDirectorPortal(rawCallbackUrl: string | null) {
  if (!rawCallbackUrl) return false;
  if (rawCallbackUrl === "/director/dashboard") return true;

  try {
    const url = new URL(rawCallbackUrl, window.location.origin);
    return url.origin === window.location.origin && url.pathname === "/director/dashboard";
  } catch {
    return false;
  }
}
function isManagerPortal(rawCallbackUrl: string | null) {
  if (!rawCallbackUrl) return false;
  if (rawCallbackUrl === "/manager") return true;

  try {
    const url = new URL(rawCallbackUrl, window.location.origin);
    return url.origin === window.location.origin && url.pathname === "/manager";
  } catch {
    return false;
  }
}

function isVolunteerPortal(rawCallbackUrl: string | null) {
  if (!rawCallbackUrl) return false;
  if (rawCallbackUrl === "/volunteer") return true;

  try {
    const url = new URL(rawCallbackUrl, window.location.origin);
    return url.origin === window.location.origin && url.pathname === "/volunteer";
  } catch {
    return false;
  }
}

function LoginForm() {
  const searchParams = useSearchParams();
  const { status, data: session } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackUrl = useMemo(() => searchParams.get("callbackUrl"), [searchParams]);
  const directorPortal = isDirectorPortal(callbackUrl);
  const managerPortal = isManagerPortal(callbackUrl);
  const volunteerPortal = isVolunteerPortal(callbackUrl);

  useEffect(() => {
    if (status !== "authenticated") return;
    const sessionPantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;

    if (directorPortal && sessionRole !== "director") {
      void signOut({ redirect: false }).then(() => {
        setError("Director credentials are required for this portal.");
      });
      return;
    }

    if ((volunteerPortal || managerPortal) && sessionRole !== "pantry") {
      void signOut({ redirect: false }).then(() => {
        setError("Volunteer/manager credentials are required for this portal.");
      });
      return;
    }

    const target = resolveAuthenticatedTarget(callbackUrl, sessionPantryId, sessionRole);
    window.location.replace(target);
  }, [callbackUrl, directorPortal, managerPortal, session, status, volunteerPortal]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const normalizedUsername = username.trim();
    const requestedPortal = directorPortal
      ? "director"
      : managerPortal
        ? "manager"
        : volunteerPortal
          ? "volunteer"
          : "";

    setLoading(true);

    const result = await signIn("credentials", {
      redirect: false,
      username: normalizedUsername,
      password,
      portal: requestedPortal,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid credentials. Please try again.");
    }
  }

  function handleFormKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || loading) return;
    const target = e.target as HTMLElement;
    if (target.tagName !== "INPUT") return;

    e.preventDefault();
    e.currentTarget.requestSubmit();
  }

  if (status === "loading") {
    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center"
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        role="status"
        aria-label="Loading session"
      >
        <svg className="h-8 w-8 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    );
  }

  if (status === "authenticated") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-6">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Continuing your active session…</p>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[100dvh] flex-col ${directorPortal ? "bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.16),transparent_35%),linear-gradient(to_bottom,#fff7ed,#fff)] dark:bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.16),transparent_35%),linear-gradient(to_bottom,#1c1917,#0f172a)]" : ""}`}
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center">
            <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl shadow-xl ${directorPortal ? "bg-gradient-to-br from-orange-500 to-rose-600 shadow-orange-500/30" : "bg-gradient-to-br from-sky-500 to-sky-700 shadow-sky-500/30"}`}>
              <svg aria-hidden="true" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="17" strokeLinecap="round" />
                <line x1="9.5" y1="14.5" x2="14.5" y2="14.5" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className={`text-3xl font-bold tracking-tight ${directorPortal ? "text-orange-950 dark:text-orange-50" : "text-slate-900 dark:text-slate-50"}`}>
              {directorPortal ? "Director Access" : managerPortal ? "Form Upload" : "Shelf Inventory Upload"}
            </h1>
            <p className={`mt-2 text-sm ${directorPortal ? "text-orange-900/75 dark:text-orange-200/80" : "text-slate-500 dark:text-slate-400"}`}>
              {directorPortal ? "Sign in with your director email and password." : "Sign in with your pantry credentials."}
            </p>
            {directorPortal && (
              <p className="mt-3 inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-200">
                Director portal
              </p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex flex-col gap-5">
            {error && <Alert tone="error">{error}</Alert>}

            <div className="flex flex-col gap-2">
              <label htmlFor="username" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {directorPortal ? "Director email" : "Pantry ID"}
              </label>
              <Input
                id="username"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                enterKeyHint="next"
                placeholder={directorPortal ? "director@example.com" : "e.g. pantry1234"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                enterKeyHint="go"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              block
              variant={directorPortal ? "secondary" : "primary"}
              size="lg"
              className={`mt-1 ${directorPortal ? "border-orange-600 bg-orange-600 text-white hover:bg-orange-700" : ""}`}
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600">
            {directorPortal ? "Use the director email and password provided by your coordinator." : "Use the pantry ID and password provided by your coordinator."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
