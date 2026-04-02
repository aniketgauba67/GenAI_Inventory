"use client";

import { signIn, useSession } from "next-auth/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Card from "../../components/ui/Card";
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

  if (resolved === "/manager") {
    return role === "manager" ? "/manager" : defaultTarget;
  }

  if (resolved === "/director/dashboard") {
    return role === "director" ? "/director/dashboard" : defaultTarget;
  }

  return resolved;
}

export default function LoginPage() {
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
      const raw = callbackUrl;
      const inferredRole = username === "director" ? "director" : username === "manager" ? "manager" : "pantry";
      const target = resolveAuthenticatedTarget(raw, username, inferredRole);
      window.location.href = target;
    }
  }

  if (status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md p-8 sm:p-10">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Continuing your active session...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md p-8 sm:p-10">
        <p className="mb-4 inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300">
          Secure Access
        </p>
        <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Pantry Login
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Enter your credentials to access your inventory management.
        </p>
        <p className="mb-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Use your pantry ID and password provided by your team.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <Alert tone="error">{error}</Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="username"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Pantry ID
            </label>
            <Input
              id="username"
              type="text"
              placeholder="pantry1234"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={loading} block variant="secondary" size="lg" className="mt-2">
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
