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

import Image from "next/image";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { FormEvent, KeyboardEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Input from "../../components/ui/Input";
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
    const portalIsDirector = directorPortal;
    const portalTitle = directorPortal ? "Manager Access" : managerPortal ? "Form Upload" : "Shelf Inventory Upload";
    const portalSubtitle = directorPortal
        ? "Sign in to review manager tools and inventory records."
        : volunteerPortal ? "Sign in to upload and manage shelf inventory records." : "Sign in to upload and record incoming orders.";
    const currentPortalKey = directorPortal ? "manager" : managerPortal ? "forms" : "images";
    const topNavItems = useMemo(() => {
        const entries: Array<{ key: string; label: string; href: string; tone: "teal" | "brown" | "neutral" }> = [
            { key: "images", label: "Upload Images", href: "/login?callbackUrl=/volunteer", tone: "teal" },
            { key: "forms", label: "Upload Forms", href: "/login?callbackUrl=/manager", tone: "neutral" },
            { key: "manager", label: "Manager", href: "/login?callbackUrl=/director/dashboard", tone: "brown" },
        ];

        return entries.map((entry) => {
            if (entry.key !== currentPortalKey) return entry;
            return { key: "home", label: "Home", href: "/", tone: "teal" as const };
        });
    }, [currentPortalKey]);

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
                className="flex min-h-[100dvh] items-center justify-center bg-[#f8f3ea]"
                style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
                role="status"
                aria-label="Loading session"
            >
                <svg className="h-9 w-9 animate-spin text-[#0f6670]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
            </div>
        );
    }

    if (status === "authenticated") {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-[#f8f3ea] px-6">
                <p className="text-sm font-medium text-[#5c665d]">Continuing your active session…</p>
            </div>
        );
    }

    return (
        <div
            className="flex min-h-[100dvh] flex-col bg-[#f8f3ea] text-[#173d43] dark:bg-[#05070c] dark:text-[#d7e4e6]"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <header
                className="sticky top-0 z-20 border-b border-[#e5d6c3] bg-[#fffdf8]/95 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90"
                style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
                <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                    <Link href="/" className="flex min-w-0 items-center gap-3">
                        <Image
                            src="/fpn-icon-transparent.svg"
                            alt="Food Pantry Network"
                            width={296}
                            height={137}
                            className="h-10 w-auto dark:hidden"
                            priority
                        />
                        <Image
                            src="/fpn icon-transparent-dark.png"
                            alt="Food Pantry Network"
                            width={296}
                            height={137}
                            className="hidden h-10 w-auto dark:block"
                            priority
                        />
                        <span className="hidden text-[0.97rem] font-black uppercase leading-[0.95] tracking-[0.06em] text-[#0f6d78] sm:inline dark:text-slate-100">
                            Food Pantry<br />Inventory System
                        </span>
                    </Link>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                        <span className="shrink-0 rounded-[14px] border border-[#eadcc9] bg-[#fffaf3] px-5 py-2.5 text-sm font-black text-[#353530] shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                            Easy View: Off
                        </span>
                        {topNavItems.map((item) => {
                            const className =
                                item.tone === "teal"
                                    ? "border-[#245a61] bg-[#245a61] text-white hover:bg-[#1b4750] dark:border-[#155e75] dark:bg-[#155e75] dark:hover:bg-[#0f4c61]"
                                    : item.tone === "brown"
                                        ? "border-[#a8704c] bg-[#a8704c] text-white hover:bg-[#8f5d3f] dark:border-[#7c4d2f] dark:bg-[#7c4d2f] dark:hover:bg-[#633f25]"
                                        : "border-[#d9d0c3] bg-[#fffdf8] text-[#37352f] hover:bg-[#f5eee2] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

                            return (
                                <Link
                                    key={`${item.key}-${item.label}`}
                                    href={item.href}
                                    className={`shrink-0 rounded-[14px] border px-5 py-2.5 text-sm font-black shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315f66] ${className}`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </header>

            <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
                <section className="relative w-full max-w-[1180px] overflow-hidden rounded-[24px] border border-[#e6d8c8] bg-[#fffaf2] shadow-[0_18px_48px_rgba(86,63,33,0.14)] dark:border-slate-800 dark:bg-slate-950/88 dark:shadow-[0_22px_48px_rgba(2,6,23,0.45)]">
                    <div className="grid min-h-[calc(100dvh-10rem)] lg:grid-cols-[1.02fr_0.98fr]">
                        <div className="relative flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12 lg:py-12">
                            <div className="w-full max-w-[480px]">
                                <div className="mb-10 text-center">
                                    <div className={`mx-auto mb-5 flex h-[110px] w-[110px] items-center justify-center rounded-full border shadow-[0_10px_24px_rgba(89,103,65,0.12)] ${portalIsDirector ? "border-[#a8bbb5] bg-[#b4c9c2]" : managerPortal ? "border-[#88af43] bg-[#9dcc56]" : "border-[#8f9c81] bg-[#99a687]"}`}>
                                        {portalIsDirector ? (
                                            <svg aria-hidden="true" className="h-[72px] w-[72px]" viewBox="0 0 64 64" fill="none">
                                                <rect x="20" y="12" width="34" height="24" rx="3" stroke="#133F63" strokeWidth="4" />
                                                <rect x="32" y="36" width="10" height="8" fill="#133F63" />
                                                <rect x="26" y="44" width="22" height="3" fill="#133F63" />
                                                <rect x="29" y="20" width="4" height="10" fill="#E3A860" />
                                                <rect x="36" y="17" width="4" height="13" fill="#E3A860" />
                                                <rect x="43" y="22" width="4" height="8" fill="#E3A860" />
                                                <circle cx="16" cy="31" r="8" fill="#133F63" />
                                                <path d="M5 53C5 45.268 11.268 39 19 39H23C30.732 39 37 45.268 37 53V57H5V53Z" fill="#133F63" />
                                            </svg>
                                        ) : managerPortal ? (
                                            <svg aria-hidden="true" className="h-[72px] w-[72px]" viewBox="0 0 64 64" fill="none">
                                                <rect x="15" y="14" width="34" height="42" rx="2" fill="#FFFFFF" stroke="#A6724E" strokeWidth="3" />
                                                <rect x="23" y="10" width="18" height="6" rx="2" fill="#8195A7" />
                                                <circle cx="24" cy="28" r="4" fill="#7CA53B" />
                                                <path d="M22 28.2L23.6 29.8L26.4 26.8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                <circle cx="24" cy="38" r="4" fill="#7CA53B" />
                                                <path d="M22 38.2L23.6 39.8L26.4 36.8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                <rect x="31" y="25" width="13" height="2.6" rx="1.3" fill="#374151" />
                                                <rect x="31" y="31" width="10" height="2.6" rx="1.3" fill="#374151" />
                                                <rect x="31" y="37" width="13" height="2.6" rx="1.3" fill="#374151" />
                                                <rect x="31" y="43" width="10" height="2.6" rx="1.3" fill="#374151" />
                                            </svg>
                                        ) : (
                                            <svg aria-hidden="true" className="h-[72px] w-[72px]" viewBox="0 0 64 64" fill="none" stroke="#F5F5EF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="10" y="10" width="44" height="44" />
                                                <path d="M10 30H54" />
                                                <path d="M10 42H54" />
                                                <rect x="14" y="16" width="9" height="10" rx="2" />
                                                <rect x="27" y="16" width="9" height="10" rx="2" />
                                                <rect x="40" y="16" width="9" height="10" rx="2" />
                                                <path d="M16 24H21" />
                                                <path d="M29 24H34" />
                                                <path d="M42 24H47" />
                                                <rect x="14" y="34" width="7" height="8" rx="1" />
                                                <rect x="24" y="33" width="5" height="9" rx="1" />
                                                <rect x="32" y="34" width="8" height="8" rx="1" />
                                                <rect x="43" y="33" width="7" height="9" rx="1" />
                                                <rect x="14" y="46" width="16" height="8" rx="1" />
                                                <rect x="34" y="46" width="16" height="8" rx="1" />
                                            </svg>
                                        )}
                                    </div>

                                    <h1 className={`text-[2.15rem] font-black tracking-tight sm:text-[2.35rem] ${portalIsDirector ? "text-[#275f67]" : "text-[#1b5f66]"}`}>
                                        {portalTitle}
                                    </h1>
                                    <p className="mt-3 text-[1.05rem] font-medium text-[#55686a]">
                                        {portalSubtitle}
                                    </p>

                                    <div className="mt-6 flex items-center gap-3">
                                        <span className="h-px flex-1 bg-[#ddcfbe]" />
                                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#e0c9aa] bg-[#fff4df] text-[#c88a55] shadow-sm">
                                            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M7 8c1.5-1.5 3.5-2.5 5-2.5S15.5 6.5 17 8" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15.5c1.25-1.25 3-2 4.5-2s3.25.75 4.5 2" />
                                            </svg>
                                        </span>
                                        <span className="h-px flex-1 bg-[#ddcfbe]" />
                                    </div>

                                    {portalIsDirector && (
                                        <div className="mt-6 flex justify-center">
                                            <span className="inline-flex rounded-full border border-[#dfc4a1] bg-[#f4e4cf] px-4 py-1.5 text-xs font-black text-[#9b6744] shadow-sm">
                                                Manager Portal
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex flex-col gap-5">
                                    {error && <Alert tone="error">{error}</Alert>}

                                    <div className="flex flex-col gap-2.5">
                                        <label htmlFor="username" className="text-[0.96rem] font-black text-[#31464e]">
                                            {portalIsDirector ? "Manager Email" : "Pantry ID"}
                                        </label>
                                        <div className="relative">
                                            <Input
                                                id="username"
                                                type="text"
                                                autoCapitalize="none"
                                                autoCorrect="off"
                                                autoComplete="username"
                                                enterKeyHint="next"
                                                placeholder={portalIsDirector ? "manager@example.com" : "e.g. pantry1234"}
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                required
                                                className="pr-12"
                                            />
                                            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#8eb6cb]">
                                                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 21a8 8 0 10-16 0" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 13a4 4 0 100-8 4 4 0 000 8Z" />
                                                </svg>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2.5">
                                        <label htmlFor="password" className="text-[0.96rem] font-black text-[#31464e]">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type="password"
                                                autoComplete="current-password"
                                                enterKeyHint="go"
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                className="pr-12"
                                            />
                                            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#8eb6cb]">
                                                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V8a5 5 0 0110 0v3" />
                                                    <rect x="5" y="11" width="14" height="9" rx="2" ry="2" />
                                                </svg>
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`mt-1 min-h-[56px] w-full rounded-2xl border-0 bg-gradient-to-r px-6 text-[1.02rem] font-black text-white shadow-[0_14px_26px_rgba(18,86,92,0.18)] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315f66] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf2] disabled:cursor-not-allowed disabled:opacity-60 ${directorPortal ? "from-[#0d5b65] to-[#1f777a] hover:from-[#0a4d56] hover:to-[#176567]" : "from-[#0d5b65] to-[#1e7778] hover:from-[#0a4d56] hover:to-[#176567]"}`}
                                    >
                                        {loading ? "Signing in…" : "Sign In"}
                                    </button>
                                </form>

                                <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm font-medium text-[#6c7f86]">
                                    <span className="text-[#8eb6cb]">
                                        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                            <rect x="5" y="10" width="14" height="10" rx="2" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10V7a4 4 0 118 0v3" />
                                        </svg>
                                    </span>
                                    <span>
                                        Use the {portalIsDirector ? "manager email" : "pantry ID"} and password provided by your coordinator.
                                    </span>
                                </p>
                            </div>
                        </div>

                        <div className="relative hidden border-l border-[#eadfcd] bg-[linear-gradient(180deg,rgba(252,248,241,0.95),rgba(249,244,235,0.96))] lg:block">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_58%,rgba(221,201,170,0.18),transparent_26%),radial-gradient(circle_at_34%_23%,rgba(235,222,200,0.28),transparent_26%)]" />
                            <div className="absolute inset-0 flex items-center justify-center p-12">
                                {portalIsDirector ? (
                                    <svg aria-hidden="true" viewBox="0 0 640 640" className="h-full w-full max-w-[420px] text-[#c9a06d]/35">
                                        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="10">
                                            <rect x="176" y="190" width="170" height="164" rx="10" />
                                            <rect x="206" y="226" width="38" height="60" rx="6" />
                                            <rect x="258" y="214" width="28" height="72" rx="6" />
                                            <rect x="300" y="246" width="24" height="40" rx="6" />
                                            <path d="M416 196h86v132h-86z" />
                                            <path d="M440 232h36" />
                                            <path d="M440 260h28" />
                                            <path d="M110 448h420" />
                                            <path d="M140 418h360v30H140z" />
                                            <path d="M176 448v54" />
                                            <path d="M340 448v54" />
                                            <path d="M505 448v54" />
                                            <path d="M232 448v54" />
                                            <path d="M380 448v54" />
                                            <rect x="164" y="392" width="112" height="106" rx="12" />
                                            <rect x="450" y="376" width="118" height="122" rx="12" />
                                            <path d="M538 332c-18 18-34 30-46 36" />
                                            <path d="M548 354c-22 12-42 18-60 22" />
                                            <path d="M528 396c-18 26-30 46-38 60" />
                                            <path d="M516 430c-10 16-18 28-24 36" />
                                        </g>
                                    </svg>
                                ) : managerPortal ? (
                                    <svg aria-hidden="true" viewBox="0 0 640 640" className="h-full w-full max-w-[430px] text-[#cab38d]/35">
                                        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="10">
                                            <path d="M178 164h246v124H178z" />
                                            <path d="M210 126h180v36H210z" />
                                            <path d="M220 206h154" />
                                            <path d="M220 238h112" />
                                            <rect x="176" y="308" width="268" height="144" rx="16" />
                                            <path d="M228 356h60" />
                                            <path d="M228 392h126" />
                                            <path d="M470 310h86v142h-86z" />
                                            <path d="M500 344h26" />
                                            <path d="M498 376h30" />
                                            <path d="M138 498h368" />
                                            <path d="M248 498v58" />
                                            <path d="M386 498v58" />
                                            <path d="M468 498v58" />
                                            <path d="M176 498v44" />
                                        </g>
                                    </svg>
                                ) : (
                                    <svg aria-hidden="true" viewBox="0 0 640 640" className="h-full w-full max-w-[430px] text-[#cab38d]/35">
                                        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="10">
                                            <rect x="148" y="140" width="336" height="72" rx="14" />
                                            <rect x="148" y="212" width="336" height="86" rx="8" />
                                            <rect x="148" y="298" width="336" height="94" rx="8" />
                                            <rect x="148" y="392" width="336" height="98" rx="8" />
                                            <path d="M190 140v350" />
                                            <path d="M442 140v350" />
                                            <path d="M166 180h292" />
                                            <path d="M166 256h292" />
                                            <path d="M166 350h292" />
                                            <path d="M166 448h292" />
                                            <path d="M512 302c-10 62-34 112-72 156" />
                                            <path d="M492 404c-16 32-42 62-78 90" />
                                            <path d="M520 364c30 12 56 22 74 30" />
                                            <path d="M506 438c32 2 60 0 84-8" />
                                        </g>
                                    </svg>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </main>
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
