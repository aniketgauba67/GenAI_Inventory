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
const DAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getPantryTimingMeta(pantry: PantryRecord, now: Date): {
  openNow: boolean;
  sortGroup: number;
  sortMinutes: number;
  hint: string;
} {
  const hours = Array.isArray(pantry.operatingHours) ? pantry.operatingHours : [];
  if (hours.length === 0) {
    return {
      openNow: Boolean(pantry.isOpen),
      sortGroup: pantry.isOpen ? 0 : 2,
      sortMinutes: Number.MAX_SAFE_INTEGER,
      hint: pantry.isOpen ? "Open now" : "Hours unavailable",
    };
  }

  const dayByIndex = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const nowDayIndex = now.getDay();
  const nowDay = dayByIndex[nowDayIndex];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let currentCloseMinutes: number | null = null;
  for (const slot of hours) {
    if (slot.day !== nowDay) continue;
    const openMinutes = timeToMinutes(slot.open);
    const closeMinutes = timeToMinutes(slot.close);
    if (nowMinutes >= openMinutes && nowMinutes < closeMinutes) {
      if (currentCloseMinutes === null || closeMinutes < currentCloseMinutes) {
        currentCloseMinutes = closeMinutes;
      }
    }
  }

  if (pantry.isOpen || currentCloseMinutes !== null) {
    if (currentCloseMinutes !== null) {
      return {
        openNow: true,
        sortGroup: 0,
        sortMinutes: Math.max(0, currentCloseMinutes - nowMinutes),
        hint: `Open until ${formatTime(`${String(Math.floor(currentCloseMinutes / 60)).padStart(2, "0")}:${String(currentCloseMinutes % 60).padStart(2, "0")}`)}`,
      };
    }
    return {
      openNow: true,
      sortGroup: 0,
      sortMinutes: Number.MAX_SAFE_INTEGER / 4,
      hint: "Open now",
    };
  }

  let bestDelta = Number.MAX_SAFE_INTEGER;
  let bestDay = "";
  let bestOpen = "";

  for (const slot of hours) {
    const dayIndex = DAY_INDEX[slot.day];
    if (dayIndex === undefined) continue;

    const openMinutes = timeToMinutes(slot.open);
    let delta = (dayIndex - nowDayIndex) * 1440 + (openMinutes - nowMinutes);
    while (delta < 0) delta += 7 * 1440;

    if (delta < bestDelta) {
      bestDelta = delta;
      bestDay = slot.day;
      bestOpen = slot.open;
    }
  }

  if (bestDelta !== Number.MAX_SAFE_INTEGER) {
    const dayLabel = DAY_LABELS[bestDay] || bestDay;
    const hint =
      bestDelta < 1440 ? `Opens ${formatTime(bestOpen)}` : `Opens ${dayLabel} ${formatTime(bestOpen)}`;
    return {
      openNow: false,
      sortGroup: 1,
      sortMinutes: bestDelta,
      hint,
    };
  }

  return {
    openNow: false,
    sortGroup: 2,
    sortMinutes: Number.MAX_SAFE_INTEGER,
    hint: "Hours unavailable",
  };
}

function sortPantriesByHours(pantries: PantryRecord[]): PantryRecord[] {
  const now = new Date();
  return [...pantries].sort((a, b) => {
    const aMeta = getPantryTimingMeta(a, now);
    const bMeta = getPantryTimingMeta(b, now);
    if (aMeta.sortGroup !== bMeta.sortGroup) return aMeta.sortGroup - bMeta.sortGroup;
    if (aMeta.sortMinutes !== bMeta.sortMinutes) return aMeta.sortMinutes - bMeta.sortMinutes;
    return a.name.localeCompare(b.name);
  });
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

const EASY_VIEW_STORAGE_KEY = "customerHomeEasyView";

function pickRandomPantryId(pantries: PantryRecord[]): string {
  if (pantries.length === 0) return "";
  const randomIndex = Math.floor(Math.random() * pantries.length);
  return pantries[randomIndex].pantryId;
}

function getFriendlyLevelText(level: string): string {
  if (level === "High") return "Stock is high";
  if (level === "Mid") return "Stock is medium";
  if (level === "Low") return "Needs restock";
  return "Out of stock";
}

function getFriendlyLevelHint(level: string): string {
  if (level === "High") return "Items are widely available.";
  if (level === "Mid") return "Items are available but going down.";
  if (level === "Low") return "Limited amount left.";
  return "No units currently available.";
}

export default function HomePage() {
  const { showToast } = useToast();
  const { status, data: session } = useSession();
  const [pantries, setPantries] = useState<PantryRecord[]>([]);
  const [selectedPantryId, setSelectedPantryId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [easyView, setEasyView] = useState(false);
  const [easyPickerOpen, setEasyPickerOpen] = useState(false);
  const [easyPickerQuery, setEasyPickerQuery] = useState("");

  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const sessionPantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;
  const isDirectorSession = sessionRole === "director" || sessionPantryId === "director";
  const isAuthenticated = status === "authenticated";

  const apiBase =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : "";

  useEffect(() => {
    const savedPreference = window.localStorage.getItem(EASY_VIEW_STORAGE_KEY);
    if (savedPreference === "true" || savedPreference === "false") {
      setEasyView(savedPreference === "true");
      return;
    }
    const prefersMoreContrast = window.matchMedia("(prefers-contrast: more)").matches;
    setEasyView(prefersMoreContrast);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(EASY_VIEW_STORAGE_KEY, easyView ? "true" : "false");
  }, [easyView]);

  useEffect(() => {
    if (!easyView) {
      setEasyPickerOpen(false);
      setEasyPickerQuery("");
    }
  }, [easyView]);

  useEffect(() => {
    if (!(easyView && easyPickerOpen)) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [easyPickerOpen, easyView]);

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
            setPantries([]);
          }
          return;
        }

        if (!ignore) {
          setPantries(data.pantries);
          setSelectedPantryId(pickRandomPantryId(data.pantries));
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Could not load pantry availability.");
          setPantries([]);
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
    if (easyView) return pantries;
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return pantries;

    return pantries.filter((pantry) => {
      return (
        pantry.pantryId.toLowerCase().includes(normalizedQuery) ||
        pantry.name.toLowerCase().includes(normalizedQuery) ||
        (pantry.location || "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [easyView, pantries, query]);

  const sortedFilteredPantries = useMemo(
    () => sortPantriesByHours(filteredPantries),
    [filteredPantries],
  );

  const easyPickerPantries = useMemo(() => {
    const normalizedQuery = easyPickerQuery.trim().toLowerCase();
    const filtered = !normalizedQuery
      ? pantries
      : pantries.filter((pantry) => {
          return (
            pantry.name.toLowerCase().includes(normalizedQuery) ||
            pantry.pantryId.toLowerCase().includes(normalizedQuery) ||
            (pantry.location || "").toLowerCase().includes(normalizedQuery)
          );
        });

    return sortPantriesByHours(filtered);
  }, [easyPickerQuery, pantries]);

  const activePantry = useMemo(() => {
    if (pantries.length === 0) return null;

    const selected = pantries.find((pantry) => pantry.pantryId === selectedPantryId) || null;
    const selectedVisible = filteredPantries.find((pantry) => pantry.pantryId === selectedPantryId) || null;

    if (selectedVisible) return selectedVisible;
    if (filteredPantries.length > 0) return filteredPantries[0];
    return selected || pantries[0];
  }, [pantries, filteredPantries, selectedPantryId]);

  function getDisplayLevel(pantry: PantryRecord, category: string): string {
    const original = Number(pantry.originalQuantities?.[category] ?? 0);
    if (original <= 0) return "Out";
    return pantry.levels[category] || "Low";
  }

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

  return (
    <main
      className={`relative min-h-screen overflow-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8 ${
        easyView ? "bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50" : ""
      }`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_15%_20%,rgba(13,148,136,0.22),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(249,115,22,0.18),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.92),rgba(255,255,255,0.62),transparent)] dark:bg-[radial-gradient(circle_at_15%_20%,rgba(13,148,136,0.2),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(249,115,22,0.16),transparent_28%),linear-gradient(to_bottom,rgba(15,23,42,0.94),rgba(15,23,42,0.72),transparent)] ${easyView ? "hidden" : ""}`} />
      <div className={`mx-auto flex w-full max-w-7xl flex-col ${easyView ? "gap-7" : "gap-6"} ${easyView && easyPickerOpen ? "pointer-events-none blur-[2px]" : ""}`}>
        <header className="space-y-5 pt-1 sm:pt-2">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800/80 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className={`${easyView ? "text-sm tracking-[0.18em]" : "text-xs tracking-[0.24em]"} font-semibold uppercase text-teal-700 dark:text-teal-300`}>
                Food Pantry Network
              </p>
              <h1 className={`mt-3 font-semibold tracking-tight text-slate-950 dark:text-slate-50 ${easyView ? "text-4xl leading-tight sm:text-5xl lg:text-6xl" : "text-3xl sm:text-4xl lg:text-5xl"}`}>
                Pantry Locations and Stock
              </h1>
              <p className={`mt-3 max-w-2xl text-slate-600 dark:text-slate-300 ${easyView ? "text-lg leading-8" : "text-sm leading-6 sm:text-base"}`}>
                {easyView
                  ? "Use this page to find a pantry near you and check what food is available right now."
                  : "Browse pantry addresses, compare availability levels by category, and observe other important pantry attributes. Click on a pantry to inspect its inventory details and stock levels."}
              </p>
            </div>

            <div className={`flex flex-wrap ${easyView ? "gap-3" : "gap-2"} lg:justify-end`}>
              <button
                type="button"
                onClick={() => setEasyView((previous) => !previous)}
                className={`inline-flex items-center rounded-full border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 ${
                  easyView
                    ? "border-sky-600 bg-sky-600 px-5 py-3 text-base text-white hover:bg-sky-700"
                    : "border-slate-300 bg-white/85 px-4 py-2 text-sm text-slate-700 hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800"
                }`}
                aria-pressed={easyView}
              >
                {easyView ? "Easy View: On" : "Easy View: Off"}
              </button>
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
                      className={`inline-flex items-center rounded-full border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 ${easyView ? "px-6 py-3 text-base" : "px-4 py-2 text-sm"} ${
                        isVolunteer
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
                    className={`inline-flex items-center rounded-full border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 ${easyView ? "px-6 py-3 text-base" : "px-4 py-2 text-sm"} ${
                      isVolunteer
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
                  size={easyView ? "md" : "sm"}
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Log out
                </Button>
              )}
            </div>
          </div>

          {easyView && (
            <Card className="rounded-3xl border-2 border-sky-300 bg-white p-5 shadow-sm dark:border-sky-700 dark:bg-slate-900">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">How to use this page</p>
              <p className="mt-2 text-base text-slate-700 dark:text-slate-200">
                1. Pick a pantry from the large dropdown list.
              </p>
              <p className="text-base text-slate-700 dark:text-slate-200">
                2. View food availability details for that pantry right below.
              </p>
              <p className="text-base text-slate-700 dark:text-slate-200">
                3. Status words show availability: High, Medium, Needs restock, or Out of stock.
              </p>
            </Card>
          )}

          {!easyView && (
            <div className="grid gap-3 sm:grid-cols-3">
            <div className={`rounded-3xl border border-teal-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-teal-900/60 dark:bg-slate-950/60 ${easyView ? "p-5" : "p-4"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                {easyView ? "Pantries to browse" : "Live inventory"}
              </p>
              <p className={`mt-2 font-semibold text-slate-950 dark:text-slate-50 ${easyView ? "text-3xl" : "text-2xl"}`}>
                {loading ? "Loading" : pantries.length}
              </p>
              <p className={`mt-1 text-slate-600 dark:text-slate-300 ${easyView ? "text-base" : "text-sm"}`}>
                {easyView ? "Number of pantry locations you can view." : "Pantries available to browse right now."}
              </p>
            </div>
            <div className={`rounded-3xl border border-orange-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-orange-900/60 dark:bg-slate-950/60 ${easyView ? "p-5" : "p-4"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                {easyView ? "Matching pantries" : "Search results"}
              </p>
              <p className={`mt-2 font-semibold text-slate-950 dark:text-slate-50 ${easyView ? "text-3xl" : "text-2xl"}`}>
                {loading ? "Loading" : filteredPantries.length}
              </p>
              <p className={`mt-1 text-slate-600 dark:text-slate-300 ${easyView ? "text-base" : "text-sm"}`}>
                {easyView ? "Pantries that match your search." : "Matches for the current query."}
              </p>
            </div>
            <div className={`rounded-3xl border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60 ${easyView ? "p-5" : "p-4"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {easyView ? "Now viewing" : "Active pantry"}
              </p>
              <p className={`mt-2 font-semibold text-slate-950 dark:text-slate-50 ${easyView ? "text-3xl" : "text-2xl"}`}>
                {activePantry ? activePantry.pantryId : "None"}
              </p>
              <p className={`mt-1 text-slate-600 dark:text-slate-300 ${easyView ? "text-base" : "text-sm"}`}>
                {activePantry ? activePantry.name : (easyView ? "Choose a pantry from the list." : "Select a pantry to inspect")}
              </p>
            </div>
            </div>
          )}
        </header>

        <section className={easyView ? "grid gap-5 xl:grid-cols-1" : "grid gap-4 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]"}>
          {easyView ? (
            <div className="space-y-4">
              {error && (
                <Card className="border border-red-200 bg-red-50 p-4 text-base text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </Card>
              )}
              <Card className="border-2 border-slate-300 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <label htmlFor="easyPantrySearch" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Find a pantry
                </label>
                <Input
                  id="easyPantrySearch"
                  value={easyPickerQuery}
                  onChange={(event) => setEasyPickerQuery(event.target.value)}
                  placeholder="Search by pantry name or address"
                  className="mt-3 min-h-[56px] text-base"
                />
                <button
                  type="button"
                  onClick={() => setEasyPickerOpen(true)}
                  className="mt-3 min-h-[60px] w-full rounded-xl border-2 border-slate-400 bg-white px-4 py-3 text-left text-lg font-semibold text-slate-900 transition hover:border-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  Open Pantry List
                </button>
                <p className="mt-3 text-base text-slate-700 dark:text-slate-200">
                  {activePantry
                    ? `Now viewing: ${activePantry.name}`
                    : "Open the pantry list to select a location."}
                </p>
              </Card>
            </div>
          ) : (
            <div className="space-y-4">
              <Card className="border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Input
                    id="pantrySearch"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search pantry by id, name, or address"
                    className="sm:max-w-md"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {loading ? "Loading pantries..." : `${sortedFilteredPantries.length} pantry result(s)`}
                  </p>
                </div>
              </Card>

              {error && (
                <Card className="border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </Card>
              )}

              <Card className="border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">Pantry List</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tap a location to inspect details</p>
                </div>
                <div className="mt-3 max-h-[56vh] space-y-2 overflow-y-auto pr-1">
                  {!loading && sortedFilteredPantries.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No pantries match your search.
                    </p>
                  )}
                  {sortedFilteredPantries.map((pantry) => {
                    const selected = activePantry?.pantryId === pantry.pantryId;
                    const timing = getPantryTimingMeta(pantry, new Date());
                    return (
                      <button
                        key={pantry.pantryId}
                        type="button"
                        onClick={() => setSelectedPantryId(pantry.pantryId)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                          selected
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
                            <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                              {timing.hint}
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
          )}

          <Card className={`border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/60 ${easyView ? "p-6" : "p-4 sm:p-5 lg:sticky lg:top-6 lg:self-start"}`}>
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
                      {easyView ? "You are viewing" : "Selected pantry"}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                      {activePantry.name}
                    </p>
                    <p className={`mt-1 text-slate-600 dark:text-slate-300 ${easyView ? "text-base" : "text-sm"}`}>
                      {activePantry.location || "Address not available"}
                    </p>
                  </div>
                  <div className={`flex flex-wrap gap-2 text-slate-500 dark:text-slate-400 ${easyView ? "text-sm" : "text-xs"}`}>
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 dark:border-teal-900/60 dark:bg-teal-950/40">
                      {easyView ? `Pantry #${activePantry.pantryId}` : `Pantry ID: ${activePantry.pantryId}`}
                    </span>
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 dark:border-orange-900/60 dark:bg-orange-950/40">
                      {easyView ? "Updated: " : "Last updated: "}
                      {activePantry.lastUpdated ? new Date(activePantry.lastUpdated).toLocaleString() : (easyView ? "Info coming soon" : "Not available")}
                    </span>
                    <span className={`rounded-full border px-3 py-1 font-semibold ${activePantry.isOpen ? "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-300" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"}`}>
                      {activePantry.isOpen ? (easyView ? "Open now" : "Open") : (easyView ? "Closed now" : "Closed")}
                      {activePantry.manualOverride && " (Manual)"}
                    </span>
                  </div>
                </div>

                {activePantry.operatingHours && activePantry.operatingHours.length > 0 && (
                  <div className={`mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/50 ${easyView ? "p-4" : "p-3"}`}>
                    <p className={`${easyView ? "mb-3 text-sm" : "mb-2 text-xs"} font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400`}>
                      {easyView ? "Opening hours" : "Operating Hours"}
                    </p>
                    <div className={`grid ${easyView ? "gap-2" : "gap-1"}`}>
                      {groupHoursByDay(activePantry.operatingHours).map(({ day, slots }) => (
                        <div key={day} className={`flex items-baseline gap-2 ${easyView ? "text-base" : "text-sm"}`}>
                          <span className={`${easyView ? "w-10" : "w-8"} shrink-0 font-semibold text-slate-700 dark:text-slate-200`}>
                            {DAY_LABELS[day] || day}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300">
                            {slots.map((s, i) => (
                              <span key={i}>
                                {i > 0 && ", "}
                                {formatTime(s.open)} - {formatTime(s.close)}
                              </span>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {easyView && (
                  <div className="mt-4 rounded-2xl border-2 border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                      Stock status guide
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                      High stock: plenty available. Medium stock: available but decreasing. Needs restock: limited amount left. Out of stock: none available.
                    </p>
                  </div>
                )}

                <div className={`mt-4 grid ${easyView ? "gap-3 sm:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-2" : "gap-2 sm:grid-cols-2 2xl:grid-cols-3"}`}>
                  {CATEGORY_ORDER.map((category) => (
                    <div
                      key={category}
                      className={`flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-800 dark:bg-slate-900/70 ${easyView ? "py-4" : "py-2.5"}`}
                    >
                      <div className="min-w-0">
                        <span className={`${easyView ? "text-base font-semibold" : "text-sm"} text-slate-700 dark:text-slate-200`}>{category}</span>
                        <p className={`${easyView ? "text-sm font-medium" : "text-xs"} text-slate-500 dark:text-slate-400`}>
                          {easyView ? "Starting amount: " : "Original: "}
                          {Number(activePantry.originalQuantities?.[category] ?? 0)}
                        </p>
                        {easyView && (
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                            {getFriendlyLevelHint(getDisplayLevel(activePantry, category))}
                          </p>
                        )}
                      </div>
                      <div className="ml-3 shrink-0">
                        <LevelBadge
                          level={getDisplayLevel(activePantry, category)}
                          size={easyView ? "lg" : "sm"}
                          friendlyText={easyView}
                        />
                        {easyView && (
                          <p className="mt-1 text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {getFriendlyLevelText(getDisplayLevel(activePantry, category))}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </section>
      </div>
      {easyView && easyPickerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-md"
            onClick={() => setEasyPickerOpen(false)}
            aria-hidden
          />
          <Card className="relative z-10 flex h-[min(90vh,48rem)] w-full max-w-3xl flex-col overflow-hidden border-2 border-slate-300 bg-white p-0 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Select a pantry</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Choose a pantry to update the page details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEasyPickerOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
              <Input
                value={easyPickerQuery}
                onChange={(event) => setEasyPickerQuery(event.target.value)}
                placeholder="Search pantry by name, id, or address"
                className="mt-4 min-h-[52px] text-base"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {!loading && easyPickerPantries.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-base text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  No pantry matches your search.
                </p>
              )}
              <div className="space-y-3">
                {easyPickerPantries.map((pantry) => {
                  const selected = pantry.pantryId === activePantry?.pantryId;
                  const timing = getPantryTimingMeta(pantry, new Date());
                  return (
                    <button
                      key={pantry.pantryId}
                      type="button"
                      onClick={() => {
                        setSelectedPantryId(pantry.pantryId);
                        setEasyPickerOpen(false);
                      }}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        selected
                          ? "border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-950/30"
                          : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-700 dark:hover:bg-slate-800"
                      }`}
                    >
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{pantry.name}</p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        Pantry #{pantry.pantryId}
                      </p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {pantry.location || "Address coming soon"}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">{timing.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      )}
      <FloatingChat pantryId={activePantry?.pantryId || ""} />
    </main>
  );
}
