/******************************** page.tsx ***************************************
 *
 *  Module: Customer Pantry Directory Page
 *
 *  This module renders the customer-facing pantry search, filtering, and
 *  chatbot experience.
 *
 *  The module provides:
 *
 *  - pantry search and category filtering.
 *  - open/closed timing hints.
 *  - customer chatbot access with optional location context.
 *
 *  Key Structures Used:
 *
 *  - React state, Next.js client rendering, pantry records, and category
 *  groups.
 *
 *  This module ensures:
 *
 *  - customers can scan pantry inventory without seeing unnecessary raw
 *  lists.
 *  - pantry cards stay sorted by availability and timing.
 *
 *  Editors: Aniket, Dipanker, Liam, Jin, and Philip.
 *
 *****************************************************************************/
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import LevelBadge from "../components/inventory/LevelBadge";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import Button from "../components/ui/Button";
import FloatingChat from "../components/chat/FloatingChat";
import { getApiBase } from "../lib/api";
import Select from "../components/ui/Select";
import Skeleton from "../components/ui/Skeleton";
import { CATEGORY_GROUPS } from "../lib/inventoryCategories";

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

function formatRelativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const accessLinks = [
  { label: "Upload Images", loginHref: "/login?callbackUrl=/volunteer", directHref: "/volunteer" },
  { label: "Upload Forms", loginHref: "/login?callbackUrl=/manager", directHref: "/manager" },
  {
    label: "Manager",
    loginHref: "/login?callbackUrl=/director/dashboard",
    directHref: "/director/dashboard",
  },
];

const EASY_VIEW_STORAGE_KEY = "customerHomeEasyView";
const LEVEL_FILTERS = ["High", "Mid", "Low", "Out"] as const;
type LevelFilter = "All" | (typeof LEVEL_FILTERS)[number];

function pickRandomPantryId(pantries: PantryRecord[]): string {
  if (pantries.length === 0) return "";
  const randomIndex = Math.floor(Math.random() * pantries.length);
  return pantries[randomIndex].pantryId;
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
  const [pantryListExpanded, setPantryListExpanded] = useState(false);
  const [timeFilteredPantries, setTimeFilteredPantries] = useState<PantryRecord[]>([]);
  const [useTimeSearch, setUseTimeSearch] = useState(false);
  const [searchDay, setSearchDay] = useState<string>("mon");
  const [searchTime, setSearchTime] = useState<string>("12:00");
  const [timeSearchError, setTimeSearchError] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<LevelFilter>("All");
  const detailsRef = useRef<HTMLDivElement>(null);

  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const sessionPantryId = (session?.user as { pantryId?: string } | undefined)?.pantryId;
  const isDirectorSession = sessionRole === "director" || sessionPantryId === "director";
  const isAuthenticated = status === "authenticated";

  const apiBase = getApiBase();

  async function loadPantriesByTime(day: string, time: string) {
    setTimeSearchError(null);
    try {
      const response = await fetch(
        `${apiBase}/customer/pantries-by-time?day=${encodeURIComponent(day)}&time=${encodeURIComponent(time)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as {
        ok?: boolean;
        pantries?: PantryRecord[];
        error?: string;
      };

      if (!response.ok || !data.ok || !Array.isArray(data.pantries)) {
        setTimeSearchError(data.error || "Could not load pantries by time.");
        return [] as PantryRecord[];
      }
      return data.pantries;
    } catch (err) {
      setTimeSearchError(err instanceof Error ? err.message : "Could not load pantries by time.");
      return [] as PantryRecord[];
    }
  }

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
      return;
    }
    if (useTimeSearch) {
      setUseTimeSearch(false);
      setTimeFilteredPantries([]);
      setTimeSearchError(null);
    }
  }, [easyView, useTimeSearch]);

  useEffect(() => {
    if (!(easyView && easyPickerOpen)) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setEasyPickerOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
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
            setTimeFilteredPantries([]);
            setUseTimeSearch(false);
            setTimeSearchError(null);
          }
          return;
        }

        if (!ignore) {
          setPantries(data.pantries);
          setSelectedPantryId(pickRandomPantryId(data.pantries));
          setTimeFilteredPantries([]);
          setUseTimeSearch(false);
          setTimeSearchError(null);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Could not load pantry availability.");
          setPantries([]);
          setTimeFilteredPantries([]);
          setUseTimeSearch(false);
          setTimeSearchError(null);
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

  const sourcePantries = useMemo(
    () => (easyView || !useTimeSearch ? pantries : timeFilteredPantries),
    [easyView, pantries, timeFilteredPantries, useTimeSearch],
  );

  const filteredPantries = useMemo(() => {
    const basePantries = sourcePantries;
    if (easyView) return basePantries;
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return basePantries;

    return basePantries.filter((pantry) => {
      return (
        pantry.pantryId.toLowerCase().includes(normalizedQuery) ||
        pantry.name.toLowerCase().includes(normalizedQuery) ||
        (pantry.location || "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [easyView, query, sourcePantries]);

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
    if (sourcePantries.length === 0) return null;

    const selected = sourcePantries.find((pantry) => pantry.pantryId === selectedPantryId) || null;
    const selectedVisible = filteredPantries.find((pantry) => pantry.pantryId === selectedPantryId) || null;

    if (selectedVisible) return selectedVisible;
    if (filteredPantries.length > 0) return filteredPantries[0];
    return selected || sourcePantries[0];
  }, [filteredPantries, selectedPantryId, sourcePantries]);

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

  async function handleTimeSearch() {
    const results = await loadPantriesByTime(searchDay, searchTime);
    setTimeFilteredPantries(results);
    setUseTimeSearch(true);
    setPantryListExpanded(true);
    if (results.length > 0) {
      setSelectedPantryId(results[0].pantryId);
    }
  }

  function handleCancelTimeSearch() {
    setUseTimeSearch(false);
    setTimeFilteredPantries([]);
    setTimeSearchError(null);
    setQuery("");
    setPantryListExpanded(false);
    setSelectedPantryId(pickRandomPantryId(pantries));
  }

  function handlePantrySelect(pantryIdValue: string) {
    setSelectedPantryId(pantryIdValue);
    setPantryListExpanded(false);
    requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const categoryStatusItems = useMemo(() => {
    if (!activePantry) return [];
    return CATEGORY_GROUPS.flatMap((group) =>
      group.categories.map((category) => ({
        category,
        level: getDisplayLevel(activePantry, category),
        original: Number(activePantry.originalQuantities?.[category] ?? 0),
      })),
    );
  }, [activePantry]);

  const activeLevelCounts = useMemo(() => {
    return categoryStatusItems.reduce<Record<string, number>>(
      (counts, item) => {
        counts[item.level] = (counts[item.level] || 0) + 1;
        return counts;
      },
      { High: 0, Mid: 0, Low: 0, Out: 0 },
    );
  }, [categoryStatusItems]);

  const filteredCategoryStatusItems = useMemo(() => {
    if (stockFilter === "All") return categoryStatusItems;
    return categoryStatusItems.filter((item) => item.level === stockFilter);
  }, [categoryStatusItems, stockFilter]);

  const boardPantries = pantryListExpanded || query || useTimeSearch
    ? sortedFilteredPantries
    : sortedFilteredPantries.slice(0, 8);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8f3ea] px-0 pb-10 pt-24 text-[#173d43] dark:bg-[#05070c] dark:text-[#d7e4e6]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[linear-gradient(180deg,rgba(230,220,203,0.9),rgba(248,243,234,0))] dark:bg-[linear-gradient(180deg,rgba(7,16,24,0.98),rgba(5,7,12,0))]" />
      <nav className={`fixed inset-x-0 top-0 z-50 border-b border-[#ddd3c1] bg-[#fffdf8]/95 px-4 py-2.5 shadow-sm backdrop-blur-md sm:px-6 lg:px-8 dark:border-slate-800/80 dark:bg-slate-950/90 ${easyView && easyPickerOpen ? "pointer-events-none blur-sm" : ""}`}>
        <div className="mx-auto flex w-full max-w-none items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-[#0d6b78] dark:text-[#7dd3fc]">
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
            <span className="hidden text-sm font-black uppercase leading-tight tracking-wide sm:inline dark:text-slate-100">
              Food Pantry<br />Network
            </span>
          </Link>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setEasyView((previous) => !previous)}
              className={`shrink-0 rounded-md border px-4 py-2 text-sm font-black shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315f66] ${
                easyView
                  ? "border-[#315f66] bg-[#315f66] text-white hover:bg-[#244b51] dark:border-[#155e75] dark:bg-[#155e75] dark:hover:bg-[#0f4c61]"
                  : "border-[#cfc4b3] bg-[#fffdf8] text-[#30332b] hover:bg-[#f4eee4] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
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
              const buttonTone = isVolunteer
                ? "border-[#315f66] bg-[#315f66] text-white hover:bg-[#244b51] dark:border-[#155e75] dark:bg-[#155e75] dark:hover:bg-[#0f4c61]"
                : isDirector
                  ? "border-[#9c6848] bg-[#9c6848] text-white hover:bg-[#815439] dark:border-[#7c4d2f] dark:bg-[#7c4d2f] dark:hover:bg-[#633f25]"
                  : "border-[#cfc4b3] bg-[#fffdf8] text-[#30332b] hover:bg-[#f4eee4] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";

              if (shouldBlock) {
                return (
                  <button
                    key={link.label}
                    type="button"
                    onClick={() => handleAccessClick(href, link.label)}
                    className={`shrink-0 rounded-md border px-4 py-2 text-sm font-black shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315f66] ${buttonTone}`}
                  >
                    {link.label}
                  </button>
                );
              }

              return (
                <Link
                  key={link.label}
                  href={href}
                  className={`shrink-0 rounded-md border px-4 py-2 text-sm font-black shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315f66] ${buttonTone}`}
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
      </nav>

      <div className={`mx-auto flex w-full max-w-none flex-col gap-6 px-4 sm:px-6 lg:px-8 ${easyView && easyPickerOpen ? "pointer-events-none blur-sm" : ""}`}>
        <header className="flex flex-col gap-3 border-b border-[#dfd3bd] pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800/80">
          <div>
            <h1 className={`${easyView ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"} font-black tracking-tight text-[#124750] dark:text-slate-50`}>
              Pantry Locations
            </h1>
            <p className={`${easyView ? "text-lg" : "text-base"} mt-2 max-w-2xl font-medium text-[#5f6159] dark:text-slate-400`}>
              Find a pantry, check hours, and see food availability.
            </p>
          </div>
          <p className="rounded-full bg-[#fff7e8] px-4 py-2 text-sm font-bold text-[#7f4635] shadow-sm ring-1 ring-[#ead7b8] dark:bg-slate-900 dark:text-amber-200 dark:ring-slate-700">
            Neighbors helping neighbors.
          </p>
        </header>

        <section className={`border-y border-[#ddd0bb] bg-[#fffaf1]/70 shadow-[0_14px_34px_rgba(67,53,35,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-[0_20px_40px_rgba(2,6,23,0.35)] ${easyView ? "px-5 py-6 sm:px-7 sm:py-8" : "px-4 py-5 sm:px-5"}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className={`${easyView ? "text-3xl" : "text-xl"} font-black text-[#124750] dark:text-slate-50`}>Choose a pantry</h2>
              <p className={`${easyView ? "text-lg" : "text-sm"} mt-1 font-medium text-[#6c665b] dark:text-slate-400`}>
                Click a pantry card to view details and stock.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {useTimeSearch ? (
                <>
                  <Select
                    value={searchDay}
                    onChange={(event) => setSearchDay(event.target.value)}
                    className={`${easyView ? "min-h-14 text-lg" : "min-h-11"} border-[#cfbd9b] bg-[#fffdf8] dark:border-slate-700 dark:bg-slate-900`}
                  >
                    <option value="mon">Monday</option>
                    <option value="tue">Tuesday</option>
                    <option value="wed">Wednesday</option>
                    <option value="thu">Thursday</option>
                    <option value="fri">Friday</option>
                    <option value="sat">Saturday</option>
                    <option value="sun">Sunday</option>
                  </Select>
                  <Input
                    type="time"
                    value={searchTime}
                    onChange={(event) => setSearchTime(event.target.value)}
                    className={`${easyView ? "min-h-14 text-lg" : "min-h-11"} border-[#cfbd9b] bg-[#fffdf8] dark:border-slate-700 dark:bg-slate-900`}
                  />
                  <Button type="button" onClick={handleTimeSearch} className="bg-[#0d6b78] text-white hover:bg-[#0a5963] dark:bg-sky-700 dark:hover:bg-sky-600">
                    Search time
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleCancelTimeSearch}>
                    Back
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    id="pantrySearch"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPantryListExpanded(true);
                    }}
                    placeholder="Search pantry by name or address"
                    className={`${easyView ? "min-h-14 text-lg sm:w-96" : "min-h-11 sm:w-72"} border-[#cfbd9b] bg-[#fffdf8] dark:border-slate-700 dark:bg-slate-900`}
                  />
                  {easyView ? (
                    <Button type="button" onClick={() => setEasyPickerOpen(true)} className="bg-[#0d6b78] text-white hover:bg-[#0a5963] dark:bg-sky-700 dark:hover:bg-sky-600">
                      Open large list
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setUseTimeSearch(true);
                        setPantryListExpanded(true);
                      }}
                    >
                      Search by time
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {error && (
            <Card className="mt-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </Card>
          )}
          {timeSearchError && (
            <Card className="mt-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200">
              {timeSearchError}
            </Card>
          )}

          <div className={`relative mt-4 border-t border-[#ded3c2] bg-[#f3eadb] shadow-inner dark:border-slate-800 dark:bg-slate-950/60 ${easyView ? "px-2 py-5 sm:px-4" : "px-2 py-3"}`}>
            <div className={`flex overflow-x-auto px-1 pt-2 snap-x snap-mandatory ${easyView ? "gap-5 pb-4" : "gap-3 pb-2"}`}>
              {loading && [0, 1, 2, 3].map((i) => (
                <div key={i} className="min-h-48 min-w-[13rem] rounded-sm bg-[#fffdf8] p-4 shadow-md dark:bg-slate-900">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="mt-4 h-4 w-24" />
                  <Skeleton className="mt-2 h-4 w-36" />
                </div>
              ))}
              {!loading && boardPantries.length === 0 && (
                <p className="rounded-md border border-dashed border-[#8e6e42] bg-[#fffaf0] px-4 py-6 text-sm font-bold text-[#62513b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  No pantries match your search.
                </p>
              )}
              {!loading && boardPantries.map((pantry) => {
                const selected = activePantry?.pantryId === pantry.pantryId;
                const timing = getPantryTimingMeta(pantry, new Date());
                return (
                  <button
                    key={pantry.pantryId}
                    type="button"
                    onClick={() => handlePantrySelect(pantry.pantryId)}
                    className={`relative snap-start overflow-hidden rounded-md border bg-[linear-gradient(180deg,#fffdf8,#fbf5eb)] text-left shadow-[0_10px_24px_rgba(69,52,31,0.13)] transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#315f66]/25 dark:border-slate-800 dark:bg-[linear-gradient(180deg,#0f172a,#020617)] dark:shadow-[0_18px_34px_rgba(2,6,23,0.42)] dark:hover:shadow-[0_22px_40px_rgba(2,6,23,0.52)] ${easyView ? "min-h-60 min-w-full px-5 pb-5 pt-8 sm:min-w-[19rem]" : "min-h-48 min-w-full px-4 pb-4 pt-7 sm:min-w-[15rem]"} ${
                      selected
                        ? "border-[#315f66] ring-2 ring-[#315f66]/15 dark:border-sky-400 dark:ring-sky-400/20"
                        : "border-[#d9cdb8] dark:border-slate-800"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-0 top-0 h-2 ${selected ? "bg-[#315f66] dark:bg-sky-400" : "bg-[#b7aa95] dark:bg-slate-600"}`}
                    />
                    {selected && (
                      <span className="absolute left-3 top-4 rounded-full bg-[#edf5f3] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#315f66] dark:bg-slate-900 dark:text-sky-300">
                        Viewing
                      </span>
                    )}
                    <p className={`${easyView ? "text-2xl" : "text-lg"} text-center font-black leading-tight text-[#26332f] dark:text-slate-50`}>{pantry.name}</p>
                    <p className={`${easyView ? "text-lg" : "text-sm"} mt-3 text-center font-medium leading-snug text-[#4e514b] dark:text-slate-400`}>
                      {pantry.location || "Address coming soon"}
                    </p>
                    <div className="mt-4 border-t border-[#eadcca] pt-3 dark:border-slate-800">
                      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-black ${easyView ? "text-base" : "text-xs"} ${
                        pantry.isOpen
                          ? "border-[#bcd3b8] bg-[#edf6ea] text-[#287345] dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200"
                          : "border-[#e2b7af] bg-[#fbebe8] text-[#9f433b] dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-200"
                      }`}>
                        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${pantry.isOpen ? "bg-[#287345] dark:bg-emerald-300" : "bg-[#9f433b] dark:bg-rose-300"}`} />
                        {pantry.isOpen ? "Open now" : "Closed"}
                      </div>
                      <p className={`${easyView ? "text-lg" : "text-sm"} mt-2 font-medium text-[#4e514b] dark:text-slate-400`}>{timing.hint}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {!loading && sortedFilteredPantries.length > 8 && !query && !useTimeSearch && (
              <button
                type="button"
                onClick={() => setPantryListExpanded((expanded) => !expanded)}
                className="mt-2 rounded-md bg-[#315f66] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#244b51] dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                {pantryListExpanded ? "Show fewer pantries" : "Show all pantries"}
              </button>
            )}
            <p className="mt-3 text-sm font-bold text-[#5d4b35] dark:text-slate-400">
              {loading ? "Loading pantries..." : `${pantries.length} pantries - ${sortedFilteredPantries.length} matching`}
            </p>
          </div>
        </section>

        <div ref={detailsRef} className="scroll-mt-24">
        <Card className={`rounded-none border-x-0 border-y border-[#dfd3bd] bg-transparent shadow-none backdrop-blur-0 dark:border-slate-800 dark:bg-slate-950/50 ${easyView ? "p-6 sm:p-8" : "p-3 sm:p-4"}`}>
          {!activePantry && !loading && (
            <p className="text-sm font-medium text-[#625c52] dark:text-slate-400">No pantry selected.</p>
          )}
          {activePantry && (
            <>
              <div className="flex flex-col gap-4 border-b border-[#e3d6be] pb-4 lg:flex-row lg:items-start lg:justify-between dark:border-slate-800">
                <div>
                  <h2 className={`${easyView ? "text-4xl" : "text-2xl"} font-black text-[#124750] dark:text-slate-50`}>{activePantry.name}</h2>
                  <p className={`${easyView ? "text-xl" : "text-base"} mt-1 font-medium text-[#4f5b55] dark:text-slate-400`}>{activePantry.location || "Address not available"}</p>
                  {activePantry.location && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activePantry.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${easyView ? "text-xl" : "text-base"} mt-1 inline-flex font-black text-[#0d6b78] hover:underline dark:text-sky-300`}
                    >
                      Get directions
                    </a>
                  )}
                </div>
                <div className={`flex flex-wrap gap-2 font-bold ${easyView ? "text-base" : "text-sm"}`}>
                  <span className="rounded-md border border-[#dfd3bd] bg-[#f3ead8] px-3 py-1 text-[#4f5148] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    Pantry ID: {activePantry.pantryId}
                  </span>
                  <span className={`rounded-md border px-3 py-1 ${activePantry.isOpen ? "border-[#9bc597] bg-[#e9f4e6] text-[#237b3c] dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200" : "border-[#e1aaa3] bg-[#f9e3df] text-[#9b332f] dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-200"}`}>
                    {activePantry.isOpen ? "Open now" : "Closed"}
                  </span>
                  <span className="rounded-md border border-[#dfd3bd] bg-[#f3ead8] px-3 py-1 text-[#4f5148] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    {activePantry.lastUpdated
                      ? `Updated: ${formatRelativeTime(activePantry.lastUpdated)}`
                      : "Last updated: Not available"}
                  </span>
                </div>
              </div>

              <div className={`mt-4 grid ${easyView ? "gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]" : "gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]"}`}>
                <div className={`rounded-md border border-[#e3d6be] bg-[#fffdf8] shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-[0_12px_24px_rgba(2,6,23,0.34)] ${easyView ? "p-5" : "p-3"}`}>
                  <p className={`${easyView ? "mb-4 text-lg" : "mb-2 text-sm"} font-black text-[#30332b] dark:text-slate-50`}>Hours of operation</p>
                  {activePantry.operatingHours && activePantry.operatingHours.length > 0 ? (
                    <div className={`grid ${easyView ? "gap-3" : "gap-1.5"}`}>
                      {groupHoursByDay(activePantry.operatingHours).map(({ day, slots }) => (
                        <div key={day} className={`grid grid-cols-[5rem_1fr] gap-3 ${easyView ? "text-xl" : "text-sm"}`}>
                          <span className="font-black text-[#30332b] dark:text-slate-100">{DAY_LABELS[day] || day}</span>
                          <span className="font-medium text-[#4f5b55] dark:text-slate-400">
                            {slots.map((slot, index) => (
                              <span key={index}>
                                {index > 0 && ", "}
                                {formatTime(slot.open)} - {formatTime(slot.close)}
                              </span>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-[#625c52] dark:text-slate-400">Hours coming soon.</p>
                  )}
                </div>

                <div className={`rounded-md border border-[#e3d6be] bg-[#fffdf8] shadow-sm dark:border-slate-800 dark:bg-slate-950/70 dark:shadow-[0_12px_24px_rgba(2,6,23,0.34)] ${easyView ? "p-5" : "p-3"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className={`${easyView ? "text-lg" : "text-sm"} font-black text-[#30332b] dark:text-slate-50`}>At a glance</p>
                    {stockFilter !== "All" && (
                      <button
                        type="button"
                        onClick={() => setStockFilter("All")}
                        className={`${easyView ? "text-base" : "text-xs"} font-black text-[#315f66] hover:underline dark:text-sky-300`}
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                  <div className={`mt-3 grid ${easyView ? "grid-cols-2 gap-3 text-lg" : "grid-cols-2 gap-2 text-sm"}`}>
                    {LEVEL_FILTERS.map((level) => {
                      const selected = stockFilter === level;
                      const count = activeLevelCounts[level] || 0;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setStockFilter(selected ? "All" : level)}
                          aria-pressed={selected}
                          className={`rounded-md border px-3 py-2 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315f66] ${
                            selected
                              ? "border-[#315f66] bg-[#eef4f2] dark:border-sky-400 dark:bg-slate-900"
                              : "border-[#e4d8c4] bg-[#fffaf1] hover:border-[#b9aa90] hover:bg-[#f6efe3] dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                          }`}
                        >
                          <LevelBadge level={level} size={easyView ? "lg" : "sm"} />
                          <p className={`${easyView ? "mt-2 text-base" : "mt-1 text-xs"} font-black text-[#4f5b55] dark:text-slate-400`}>
                            {count} categories
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className={`${easyView ? "text-2xl" : "text-base"} font-black text-[#30332b] dark:text-slate-50`}>Stock status</h3>
                    <p className={`${easyView ? "text-base" : "text-xs"} mt-1 font-bold text-[#6c665b] dark:text-slate-400`}>
                      {stockFilter === "All"
                        ? "Showing all categories"
                        : `Showing ${stockFilter === "Mid" ? "Medium" : stockFilter} categories`}
                    </p>
                  </div>
                  {stockFilter !== "All" && (
                    <button
                      type="button"
                      onClick={() => setStockFilter("All")}
                      className={`${easyView ? "text-base" : "text-xs"} font-black text-[#315f66] hover:underline dark:text-sky-300`}
                    >
                      Show all stock
                    </button>
                  )}
                </div>
                <div className={`mt-3 grid ${easyView ? "gap-4 sm:grid-cols-2 xl:grid-cols-3" : "gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"}`}>
                  {filteredCategoryStatusItems.map((item) => (
                    <div key={item.category} className={`rounded-md border border-[#eadcca] bg-[#fffdf8] shadow-sm dark:border-slate-800 dark:bg-slate-950/70 ${easyView ? "p-5" : "p-3"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`${easyView ? "text-xl" : "text-base"} font-black text-[#30332b] dark:text-slate-100`}>{item.category}</p>
                          <p className={`${easyView ? "text-base" : "text-xs"} mt-1 font-bold text-[#6c665b] dark:text-slate-400`}>Original: {item.original}</p>
                        </div>
                        <LevelBadge level={item.level} size={easyView ? "lg" : "sm"} friendlyText={easyView} />
                      </div>
                    </div>
                  ))}
                  {filteredCategoryStatusItems.length === 0 && (
                    <p className="rounded-md border border-dashed border-[#d7c8ae] bg-[#fffdf8] p-4 text-sm font-bold text-[#6c665b] dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                      No categories match this stock filter.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>
        </div>
      </div>

      {easyView && easyPickerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-[#3d2c19]/35 backdrop-blur-md dark:bg-slate-950/80"
            onClick={() => setEasyPickerOpen(false)}
            aria-hidden
          />
          <Card className="relative z-10 flex h-[min(90vh,52rem)] w-full max-w-[92rem] flex-col overflow-hidden rounded-lg border border-[#ddd0bb] bg-[#fffaf1] p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="border-b border-[#dfd3bd] p-5 sm:p-7 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-4xl font-black text-[#124750] dark:text-slate-50">Select a pantry</p>
                  <p className="mt-2 text-xl font-medium text-[#6c665b] dark:text-slate-400">Choose a note card to update this page.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEasyPickerOpen(false)}
                  className="rounded-md border-2 border-[#cbbd9f] bg-[#fffdf8] px-5 py-3 text-lg font-black text-[#30332b] hover:bg-[#f3e7cf] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
              <Input
                value={easyPickerQuery}
                onChange={(event) => setEasyPickerQuery(event.target.value)}
                placeholder="Search pantry by name, id, or address"
                className="mt-5 min-h-[64px] border-[#cfbd9b] bg-[#fffdf8] text-xl dark:border-slate-700 dark:bg-slate-900"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto border-t border-[#ded3c2] bg-[#f3eadb] p-6 dark:border-slate-800 dark:bg-slate-950/70">
              {loading && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="min-h-44 rounded-sm bg-[#fffdf8] p-4 shadow-md dark:bg-slate-900">
                      <Skeleton className="h-5 w-44" />
                      <Skeleton className="mt-3 h-4 w-28" />
                      <Skeleton className="mt-2 h-4 w-36" />
                    </div>
                  ))}
                </div>
              )}
              {!loading && easyPickerPantries.length === 0 && (
                <p className="rounded-md border border-dashed border-[#8e6e42] bg-[#fffaf0] px-4 py-6 text-base font-bold text-[#62513b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  No pantry matches your search.
                </p>
              )}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {easyPickerPantries.map((pantry) => {
                  const selected = pantry.pantryId === activePantry?.pantryId;
                  const timing = getPantryTimingMeta(pantry, new Date());
                  return (
                    <button
                      key={pantry.pantryId}
                      type="button"
                      onClick={() => {
                        setEasyPickerOpen(false);
                        handlePantrySelect(pantry.pantryId);
                      }}
                      className={`relative min-h-72 overflow-hidden rounded-md border bg-[linear-gradient(180deg,#fffdf8,#fbf5eb)] px-6 pb-6 pt-11 text-left shadow-lg transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0d6b78]/30 dark:border-slate-800 dark:bg-[linear-gradient(180deg,#0f172a,#020617)] dark:text-slate-100 ${
                        selected
                          ? "border-[#315f66] ring-2 ring-[#315f66]/15 dark:border-sky-400 dark:ring-sky-400/20"
                          : "border-[#d9cdb8] dark:border-slate-800"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-0 top-0 h-2.5 ${selected ? "bg-[#315f66] dark:bg-sky-400" : "bg-[#b7aa95] dark:bg-slate-600"}`}
                      />
                      {selected && (
                        <span className="absolute left-4 top-5 rounded-full bg-[#edf5f3] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#315f66] dark:bg-slate-900 dark:text-sky-300">
                          Viewing
                        </span>
                      )}
                      <p className="text-center text-2xl font-black leading-tight text-[#26332f] dark:text-slate-50">{pantry.name}</p>
                      <p className="mt-4 text-center text-lg font-medium leading-snug text-[#4e514b] dark:text-slate-400">{pantry.location || "Address coming soon"}</p>
                      <div className="mt-5 border-t border-[#eadcca] pt-4 dark:border-slate-800">
                        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-lg font-black ${
                          pantry.isOpen
                            ? "border-[#bcd3b8] bg-[#edf6ea] text-[#287345] dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200"
                            : "border-[#e2b7af] bg-[#fbebe8] text-[#9f433b] dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-200"
                        }`}>
                          <span aria-hidden="true" className={`h-3 w-3 rounded-full ${pantry.isOpen ? "bg-[#287345] dark:bg-emerald-300" : "bg-[#9f433b] dark:bg-rose-300"}`} />
                          {pantry.isOpen ? "Open now" : "Closed"}
                        </div>
                        <p className="mt-2 text-lg font-medium text-[#4e514b] dark:text-slate-400">{timing.hint}</p>
                      </div>
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
