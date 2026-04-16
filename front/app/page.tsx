"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import LevelBadge from "../components/inventory/LevelBadge";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import Button from "../components/ui/Button";
import FloatingChat from "../components/chat/FloatingChat";

type OperatingSlot = { day: string; open: string; close: string };

type PantryRecord = {
  pantryId: string;
  name: string;
  location: string | null;
  lastUpdated: string | null;
  levels: Record<string, string>;
  originalQuantities: Record<string, number>;
  isOpen: boolean;
  manualOverride: boolean;
  operatingHours: OperatingSlot[];
};

const DAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

function groupHoursByDay(hours: OperatingSlot[]): { day: string; slots: { open: string; close: string }[] }[] {
  const map = new Map<string, { open: string; close: string }[]>();
  for (const slot of hours) {
    const existing = map.get(slot.day) || [];
    existing.push({ open: slot.open, close: slot.close });
    map.set(slot.day, existing);
  }
  return DAY_ORDER
    .filter((d) => map.has(d))
    .map((d) => ({ day: d, slots: map.get(d)! }));
}

const CATEGORY_ORDER = [
  "Beverages",
  "Juices",
  "Cereal",
  "Breakfast",
  "Meat",
  "Fish",
  "Poultry",
  "Frozen",
  "Vegetables",
  "Fruits",
  "Nuts",
  "Soup",
  "Grains",
  "Pasta",
  "Snacks",
  "Spices",
  "Sauces",
  "Condiments",
  "Misc Products",
];

const accessLinks = [
  { label: "Volunteer", loginHref: "/login?callbackUrl=/volunteer", directHref: "/volunteer" },
  { label: "Manager", loginHref: "/login?callbackUrl=/manager", directHref: "/manager" },
  {
    label: "Director",
    loginHref: "/login?callbackUrl=/director/dashboard",
    directHref: "/director/dashboard",
  },
];

function pickRandomPantryId(pantries: PantryRecord[]): string {
  if (pantries.length === 0) return "";
  const randomIndex = Math.floor(Math.random() * pantries.length);
  return pantries[randomIndex].pantryId;
}

export default function HomePage() {
  const { showToast } = useToast();
  const { status, data: session } = useSession();
  const [allPantries, setAllPantries] = useState<PantryRecord[]>([]);
  const [timeFilteredPantries, setTimeFilteredPantries] = useState<PantryRecord[]>([]);
  const [selectedPantryId, setSelectedPantryId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useTimeSearch, setUseTimeSearch] = useState(false);
  const [searchDay, setSearchDay] = useState<string>("mon");
  const [searchTime, setSearchTime] = useState<string>("12:00");
  const [timeSearchError, setTimeSearchError] = useState<string | null>(null);

  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const sessionPantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;
  const isDirectorSession = sessionRole === "director" || sessionPantryId === "director";
  const isAuthenticated = status === "authenticated";

  const apiBase =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : "";

  async function loadPantriesByTime(day: string, time: string) {
    setTimeSearchError(null);
    try {
      const response = await fetch(
        `${apiBase}/customer/pantries-by-time?day=${encodeURIComponent(day)}&time=${encodeURIComponent(time)}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as {
        ok?: boolean;
        pantries?: PantryRecord[];
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setTimeSearchError(data.error || "Could not load pantries by time.");
        return [];
      }

      return Array.isArray(data.pantries) ? data.pantries : [];
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Could not load pantries by time.";
      setTimeSearchError(errMsg);
      return [];
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadPantries() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiBase}/customer/pantries`, { cache: "no-store" });
        const data = (await response.json()) as {
          ok?: boolean;
          pantries?: PantryRecord[];
          error?: string;
        };

        if (!response.ok || !data.ok || !Array.isArray(data.pantries)) {
          if (!ignore) {
            setError(data.error || "Could not load pantry availability.");
            setAllPantries([]);
            setTimeFilteredPantries([]);
          }
          return;
        }

        if (!ignore) {
          setAllPantries(data.pantries);
          setSelectedPantryId(pickRandomPantryId(data.pantries));
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Could not load pantry availability.");
          setAllPantries([]);
          setTimeFilteredPantries([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    if (apiBase) {
      void loadPantries();
    }

    return () => {
      ignore = true;
    };
  }, [apiBase]);

  const filteredPantries = useMemo(() => {
    const sourcePantries = useTimeSearch ? timeFilteredPantries : allPantries;
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sourcePantries;

    return sourcePantries.filter((pantry) => {
      return (
        pantry.pantryId.toLowerCase().includes(normalizedQuery) ||
        pantry.name.toLowerCase().includes(normalizedQuery) ||
        (pantry.location || "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [allPantries, query, timeFilteredPantries, useTimeSearch]);

  const activePantry = useMemo(() => {
    const sourcePantries = useTimeSearch ? timeFilteredPantries : allPantries;
    if (sourcePantries.length === 0) return null;

    const selected = sourcePantries.find((pantry) => pantry.pantryId === selectedPantryId) || null;
    const selectedVisible = filteredPantries.find((pantry) => pantry.pantryId === selectedPantryId) || null;

    if (selectedVisible) return selectedVisible;
    if (filteredPantries.length > 0) return filteredPantries[0];
    return selected || sourcePantries[0];
  }, [allPantries, filteredPantries, selectedPantryId, timeFilteredPantries, useTimeSearch]);

  function handleAccessClick(href: string, label: string) {
    if (!isAuthenticated) {
      window.location.href = href;
      return;
    }

    if (label === "Director" && !isDirectorSession) {
      showToast("You need director credentials to access the director dashboard.", "error");
      return;
    }

    window.location.href = href;
  }

  async function handleTimeSearch() {
    const results = await loadPantriesByTime(searchDay, searchTime);
    setTimeFilteredPantries(results);
    setUseTimeSearch(true);
    if (results.length > 0) {
      setSelectedPantryId(results[0].pantryId);
    }
  }

  function handleCancelTimeSearch() {
    setUseTimeSearch(false);
    setTimeFilteredPantries([]);
    setTimeSearchError(null);
    setQuery("");
    setSelectedPantryId(pickRandomPantryId(allPantries));
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_15%_20%,rgba(13,148,136,0.22),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(249,115,22,0.18),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.92),rgba(255,255,255,0.62),transparent)] dark:bg-[radial-gradient(circle_at_15%_20%,rgba(13,148,136,0.2),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(249,115,22,0.16),transparent_28%),linear-gradient(to_bottom,rgba(15,23,42,0.94),rgba(15,23,42,0.72),transparent)]" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="space-y-5 pt-1 sm:pt-2">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800/80 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700 dark:text-teal-300">
                Food Pantry Network
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl lg:text-5xl">
                Pantry Locations and Stock
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                Browse pantry addresses, compare availability levels by category, and observe other important pantry attributes. Click on a pantry to inspect its inventory details and stock levels.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {accessLinks.map((link, index) => {
                const isVolunteer = index === 0;
                const isDirector = index === 2;
                const volunteerHref = sessionPantryId ? `/${sessionPantryId}/upload` : link.loginHref;
                const href = isAuthenticated
                  ? (isVolunteer ? volunteerHref : link.directHref)
                  : link.loginHref;
                const shouldBlock = isAuthenticated && isDirector && !isDirectorSession;

                if (shouldBlock) {
                  return (
                    <button
                      key={link.label}
                      type="button"
                      onClick={() => handleAccessClick(href, link.label)}
                      className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 ${isVolunteer
                        ? "border-teal-600 bg-teal-600 text-white shadow-sm shadow-teal-600/20 hover:bg-teal-700 focus-visible:ring-teal-500 dark:border-teal-400 dark:bg-teal-500 dark:text-slate-950"
                        : isDirector
                          ? "border-orange-500 bg-orange-500 text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 focus-visible:ring-orange-500"
                          : "border-slate-300 bg-white/80 text-slate-700 hover:border-slate-400 hover:bg-white focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800"
                        }`}
                    >
                      {link.label}
                    </button>
                  );
                }

                return (
                  <Link
                    key={link.label}
                    href={href}
                    className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 ${isVolunteer
                      ? "border-teal-600 bg-teal-600 text-white shadow-sm shadow-teal-600/20 hover:bg-teal-700 focus-visible:ring-teal-500 dark:border-teal-400 dark:bg-teal-500 dark:text-slate-950"
                      : isDirector
                        ? "border-orange-500 bg-orange-500 text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 focus-visible:ring-orange-500"
                        : "border-slate-300 bg-white/80 text-slate-700 hover:border-slate-400 hover:bg-white focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800"
                      }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {isAuthenticated && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Log out
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-teal-200/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-teal-900/60 dark:bg-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                Live inventory
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                {loading ? "Loading" : allPantries.length}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Pantries available to browse right now.</p>
            </div>
            <div className="rounded-3xl border border-orange-200/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-orange-900/60 dark:bg-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                Search results
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                {loading ? "Loading" : filteredPantries.length}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Matches for the current query.</p>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Active pantry
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                {activePantry ? activePantry.pantryId : "None"}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {activePantry ? activePantry.name : "Select a pantry to inspect"}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60">
              {useTimeSearch ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                      Pantries Open at Time
                    </h3>
                    <button
                      type="button"
                      onClick={handleCancelTimeSearch}
                      className="ml-auto text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      Back to Now
                    </button>
                  </div>
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search within time-filtered pantries"
                    className="sm:max-w-md"
                  />
                  <div className="grid gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Day
                      </label>
                      <select
                        value={searchDay}
                        onChange={(e) => setSearchDay(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 placeholder-slate-400 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder-slate-500"
                      >
                        <option value="mon">Monday</option>
                        <option value="tue">Tuesday</option>
                        <option value="wed">Wednesday</option>
                        <option value="thu">Thursday</option>
                        <option value="fri">Friday</option>
                        <option value="sat">Saturday</option>
                        <option value="sun">Sunday</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Time (24-hour)
                      </label>
                      <input
                        type="time"
                        value={searchTime}
                        onChange={(e) => setSearchTime(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                      />
                    </div>
                    <Button
                      onClick={handleTimeSearch}
                      className="w-full bg-teal-600 text-white hover:bg-teal-700"
                    >
                      Search by Time
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {loading ? "Loading..." : `${filteredPantries.length} pantry result(s)`}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search pantry by id, name, or address"
                      className="sm:max-w-md"
                    />
                    <button
                      type="button"
                      onClick={() => setUseTimeSearch(true)}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                    >
                      Search by time
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {loading ? "Loading pantries..." : `${filteredPantries.length} pantry result(s)`}
                  </p>
                </div>
              )}
            </Card>

            {error && (
              <Card className="border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </Card>
            )}

            {timeSearchError && (
              <Card className="border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {timeSearchError}
              </Card>
            )}

            <Card className="border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Pantry List</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tap a location to inspect details</p>
              </div>
              <div className="mt-3 space-y-2">
                {!loading && filteredPantries.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No pantries match your search.
                  </p>
                )}
                {filteredPantries.map((pantry) => {
                  const selected = activePantry?.pantryId === pantry.pantryId;
                  return (
                    <button
                      key={pantry.pantryId}
                      type="button"
                      onClick={() => setSelectedPantryId(pantry.pantryId)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${selected
                        ? "border-teal-500 bg-teal-50 shadow-sm shadow-teal-500/10 dark:border-teal-400 dark:bg-teal-950/35"
                        : "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/60 dark:border-slate-800 dark:bg-slate-950/80 dark:hover:border-teal-800 dark:hover:bg-slate-900"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{pantry.name}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Pantry ID: {pantry.pantryId}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {pantry.location || "Address not available"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${pantry.isOpen ? "bg-teal-500" : "bg-rose-400"}`} />
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${pantry.isOpen ? "text-teal-600 dark:text-teal-400" : "text-rose-500 dark:text-rose-400"}`}>
                            {pantry.isOpen ? "Open" : "Closed"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card className="border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60 sm:p-5">
            {!activePantry && !loading && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No pantry selected.
              </p>
            )}
            {activePantry && (
              <>
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700 dark:text-orange-300">
                      Selected pantry
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                      {activePantry.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {activePantry.location || "Address not available"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 dark:border-teal-900/60 dark:bg-teal-950/40">
                      Pantry ID: {activePantry.pantryId}
                    </span>
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 dark:border-orange-900/60 dark:bg-orange-950/40">
                      Last updated: {activePantry.lastUpdated ? new Date(activePantry.lastUpdated).toLocaleString() : "Not available"}
                    </span>
                    <span className={`rounded-full border px-3 py-1 font-semibold ${activePantry.isOpen ? "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-300" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"}`}>
                      {activePantry.isOpen ? "Open" : "Closed"}
                      {activePantry.manualOverride && " (Manual)"}
                    </span>
                  </div>
                </div>

                {activePantry.operatingHours && activePantry.operatingHours.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Operating Hours
                    </p>
                    <div className="grid gap-1">
                      {groupHoursByDay(activePantry.operatingHours).map(({ day, slots }) => (
                        <div key={day} className="flex items-baseline gap-2 text-sm">
                          <span className="w-8 shrink-0 font-semibold text-slate-700 dark:text-slate-200">
                            {DAY_LABELS[day] || day}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300">
                            {slots.map((s, i) => (
                              <span key={i}>
                                {i > 0 && ", "}
                                {formatTime(s.open)} – {formatTime(s.close)}
                              </span>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                  {CATEGORY_ORDER.map((category) => (
                    <div
                      key={category}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/70"
                    >
                      <div className="min-w-0">
                        <span className="text-sm text-slate-700 dark:text-slate-200">{category}</span>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Original: {Number(activePantry.originalQuantities?.[category] ?? 0)}
                        </p>
                      </div>
                      <LevelBadge level={activePantry.levels[category] || "Low"} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </section>
      </div>
      <FloatingChat pantryId={activePantry?.pantryId || ""} />
    </main>
  );
}
