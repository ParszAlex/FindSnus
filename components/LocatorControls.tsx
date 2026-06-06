"use client";

// Floating top-left control card for the locator: brand bar, postcode/town
// search, radius selector, and "use my location". It owns no shop data — it
// only reports a new centre (lat/lng) and radius up to <Locator>, which
// re-fetches. Geocoding uses postcodes.io (free, UK-only, no key, fetch-only).

import { useState } from "react";
import Wordmark from "./Wordmark";

// Radius is user-facing in miles; <Locator> converts to km for the data layer.
export const RADIUS_MILES = [1, 3, 5, 10] as const;

type Props = {
  radiusMi: number;
  onRadiusChange: (miles: number) => void;
  onLocationChange: (lat: number, lng: number) => void;
  loading: boolean;
};

// postcodes.io: GET /postcodes/:postcode → { result: { latitude, longitude } }.
// Returns null on any miss (bad/unknown postcode, network) so the caller can
// show a single, friendly inline message rather than leaking fetch internals.
async function geocodePostcode(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const r = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(query)}`,
    );
    if (!r.ok) return null;
    const { result } = await r.json();
    if (!result) return null;
    return { lat: result.latitude, lng: result.longitude };
  } catch {
    return null;
  }
}

export default function LocatorControls({
  radiusMi,
  onRadiusChange,
  onLocationChange,
  loading,
}: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setHint(null);
    const coords = await geocodePostcode(q);
    setSearching(false);
    if (!coords) {
      setHint("We couldn’t find that postcode. Check it and try again.");
      return;
    }
    onLocationChange(coords.lat, coords.lng);
  }

  function handleUseMyLocation() {
    if (!("geolocation" in navigator)) {
      setHint("Your browser can’t share your location.");
      return;
    }
    setHint(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => onLocationChange(pos.coords.latitude, pos.coords.longitude),
      () =>
        setHint("We couldn’t get your location. Enter a postcode instead."),
    );
  }

  const busy = searching || loading;

  return (
    <section
      aria-label="Search controls"
      className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-border bg-bg shadow-float sm:w-[312px]"
    >
      <div className="flex items-center gap-2 border-b border-border px-[15px] py-[13px]">
        <Wordmark />
      </div>

      <div className="flex flex-col gap-[11px] px-[15px] pt-[14px] pb-[15px]">
        <form onSubmit={handleSearch} className="flex flex-col gap-1.5">
          <label
            htmlFor="locator-search"
            className="text-xs font-semibold tracking-[0.02em] text-muted uppercase"
          >
            Location
          </label>
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute left-3 grid place-items-center text-muted">
              {busy ? <SpinnerIcon /> : <SearchIcon />}
            </span>
            <input
              id="locator-search"
              type="text"
              inputMode="text"
              autoComplete="postal-code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter postcode or town"
              aria-describedby={hint ? "locator-hint" : undefined}
              className="h-[42px] w-full rounded-[10px] border border-border bg-bg pr-3 pl-[38px] text-base text-ink transition-colors placeholder:text-muted hover:border-border-strong focus:border-primary"
            />
          </div>
        </form>

        <div className="flex gap-[9px]">
          <div className="relative flex-1">
            <span className="absolute -top-[7px] left-3 bg-bg px-1 text-[10px] font-semibold tracking-[0.04em] text-muted uppercase">
              Radius
            </span>
            <select
              aria-label="Search radius"
              value={radiusMi}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              className="h-[42px] w-full cursor-pointer appearance-none rounded-[10px] border border-border bg-bg pr-[34px] pl-3 text-sm font-medium text-ink transition-colors hover:border-border-strong focus:border-primary"
            >
              {RADIUS_MILES.map((mi) => (
                <option key={mi} value={mi}>
                  {mi} {mi === 1 ? "mile" : "miles"}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute top-1/2 right-[11px] -translate-y-1/2 text-muted">
              <ChevronIcon />
            </span>
          </div>

          <button
            type="button"
            onClick={handleUseMyLocation}
            className="inline-flex h-[42px] flex-[1.1] items-center justify-center gap-[7px] rounded-[10px] bg-primary text-sm font-semibold whitespace-nowrap text-on-primary transition-[background-color,transform] hover:bg-primary-hover active:translate-y-px"
          >
            <PinIcon />
            Use my location
          </button>
        </div>

        {hint && (
          <p id="locator-hint" role="status" className="text-xs text-muted">
            {hint}
          </p>
        )}
      </div>
    </section>
  );
}

// Inline Lucide-style strokes (width 2, round caps) — the design system's icon
// language. Kept local: tiny, single-use, no dependency.
function SearchIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22c4.5-5.2 7-9 7-12.4A7 7 0 1 0 5 9.6C5 13 7.5 16.8 12 22Z" />
      <circle cx="12" cy="9.6" r="2.4" />
    </svg>
  );
}
