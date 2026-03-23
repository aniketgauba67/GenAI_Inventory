"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const raw = searchParams.get("callbackUrl");
      let target = `/${username}/upload`;
      if (raw && raw !== "/") {
        let resolved = raw;
        if (!raw.startsWith("/")) {
          try {
            const u = new URL(raw, window.location.origin);
            if (u.origin === window.location.origin) resolved = u.pathname + u.search;
          } catch {
            resolved = `/${username}/upload`;
          }
        }
        // /volunteer is a virtual marker → go to the pantry upload page
        if (resolved === "/volunteer") {
          target = `/${username}/upload`;
        } else {
          target = resolved;
        }
      }
      window.location.href = target;
    }
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
