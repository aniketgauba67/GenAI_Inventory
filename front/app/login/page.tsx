"use client";

import { signIn, useSession } from "next-auth/react";
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
      : role === "manager"
        ? "/manager"
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
  if (resolved === "/manager") return "/manager";
  if (resolved === "/director/dashboard") {
    return role === "director" ? "/director/dashboard" : defaultTarget;
  }

  return resolved;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const { status, data: session } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackUrl = useMemo(() => searchParams.get("callbackUrl"), [searchParams]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const sessionPantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;
    const sessionRole = (session?.user as { role?: string } | undefined)?.role;
    const target = resolveAuthenticatedTarget(callbackUrl, sessionPantryId, sessionRole);
    window.location.replace(target);
  }, [callbackUrl, session, status]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      redirect: false,
      username,
      password,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid pantry ID or password. Please try again.");
    } else {
      const inferredRole = username === "director" ? "director" : username === "manager" ? "manager" : "pantry";
      const target = resolveAuthenticatedTarget(callbackUrl, username, inferredRole);
      window.location.href = target;
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
    <div className="flex min-h-[100dvh] flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Brand mark */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-sky-700 shadow-xl shadow-sky-500/30">
              <svg aria-hidden="true" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="17" strokeLinecap="round" />
                <line x1="9.5" y1="14.5" x2="14.5" y2="14.5" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Inventory
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Sign in with your pantry credentials
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex flex-col gap-5">
            {error && <Alert tone="error">{error}</Alert>}

            <div className="flex flex-col gap-2">
              <label htmlFor="username" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Pantry ID
              </label>
              <Input
                id="username"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                enterKeyHint="next"
                placeholder="e.g. pantry1234"
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

            <Button type="submit" disabled={loading} block variant="primary" size="lg" className="mt-1">
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600">
            Use the pantry ID and password provided by your coordinator.
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
