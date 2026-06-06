"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";

type Props = {
  onLocationChange: (lat: number, lng: number) => void;
  loading: boolean;
};

type Coords = { lat: number; lng: number };

const UK_POSTCODE_RE = /^[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}$/i;

async function geocodePostcode(query: string): Promise<Coords | null> {
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

async function geocodePlace(query: string): Promise<Coords | null> {
  try {
    const r = await fetch(
      `https://api.postcodes.io/places?q=${encodeURIComponent(query)}`,
    );
    if (!r.ok) return null;
    const { result } = await r.json();
    const top = Array.isArray(result) ? result[0] : null;
    if (!top) return null;
    return { lat: top.latitude, lng: top.longitude };
  } catch {
    return null;
  }
}

async function geocodeQuery(query: string): Promise<Coords | null> {
  const looksLikePostcode = UK_POSTCODE_RE.test(query);
  const [first, second] = looksLikePostcode
    ? [geocodePostcode, geocodePlace]
    : [geocodePlace, geocodePostcode];
  return (await first(query)) ?? (await second(query));
}

export default function MobileSearchPill({ onLocationChange, loading }: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setHint(null);
    const coords = await geocodeQuery(q);
    setSearching(false);
    if (!coords) {
      setHint("We couldn't find that place. Check the spelling and try again.");
      return;
    }
    setSearchFocused(false);
    onLocationChange(coords.lat, coords.lng);
  }

  function handleGps() {
    if (locating) return;
    if (!("geolocation" in navigator)) {
      setHint("Your browser can't share your location.");
      return;
    }
    setHint(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onLocationChange(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setHint("We couldn't get your location. Enter a postcode instead.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function openSearch() {
    flushSync(() => {
      setSearchFocused(true);
      setHint(null);
    });
    inputRef.current?.focus();
  }

  function cancelSearch() {
    setSearchFocused(false);
    setQuery("");
    setHint(null);
  }

  const glassBase =
    "bg-white/[0.94] backdrop-blur-xl border border-black/[0.08] shadow-[0_2px_10px_rgba(0,0,0,0.13),0_1px_3px_rgba(0,0,0,0.06)] dark:bg-surface/[0.92] dark:border-white/[0.10]";

  return (
    <div
      className="pointer-events-none absolute left-3.5 right-3.5 z-20 flex flex-col gap-1.5"
      style={{ top: "max(18px, env(safe-area-inset-top, 0px))" }}
    >
      <div className="pointer-events-auto flex items-center gap-2">
        {searchFocused ? (
          <>
            <form
              onSubmit={handleSearch}
              // iOS only shows a submit action key (Search/Go) when the form
              // has an `action`; without it the return key stays "Done"/"return".
              // Never navigates — handleSearch calls preventDefault() first.
              action="#"
              className="flex h-11 flex-1 items-center gap-2.5 rounded-[14px] border border-primary bg-white/[0.98] px-3.5 shadow-[0_0_0_3px_oklch(0.40_0.14_255_/_0.18),0_2px_10px_rgba(0,0,0,0.12)] dark:bg-surface/[0.98] dark:shadow-[0_0_0_3px_oklch(0.64_0.105_255_/_0.22),0_2px_10px_rgba(0,0,0,0.4)]"
            >
              {searching || loading ? (
                <SpinnerIcon className="shrink-0 text-primary" />
              ) : (
                <SearchIcon className="shrink-0 text-primary" />
              )}
              <input
                ref={inputRef}
                type="search"
                inputMode="text"
                autoComplete="postal-code"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter postcode or town"
                enterKeyHint="search"
                className="flex-1 appearance-none bg-transparent text-[16px] text-ink placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
              />
            </form>
            <button
              type="button"
              onClick={cancelSearch}
              className="h-11 shrink-0 px-3 text-[15px] font-medium text-primary"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={openSearch}
              aria-label="Search for a postcode or town"
              className={`flex h-11 flex-1 items-center gap-2.5 rounded-[14px] px-3.5 text-left ${glassBase}`}
            >
              <WordmarkIcon />
              <span className="text-[14px] font-bold tracking-[-0.02em] leading-none text-ink">
                findsnus
              </span>
              <span className="h-[18px] w-px shrink-0 bg-border" />
              <SearchIcon className="shrink-0 text-muted" />
              <span className="text-[13px] text-muted">
                Enter postcode or town
              </span>
            </button>

            <button
              type="button"
              onClick={handleGps}
              disabled={locating}
              aria-busy={locating}
              aria-label={locating ? "Getting your location…" : "Use my location"}
              className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] text-primary ${glassBase} disabled:cursor-not-allowed`}
            >
              {locating ? <SpinnerIcon className="text-primary" /> : <GpsIcon />}
            </button>
          </>
        )}
      </div>

      {hint && (
        <p role="status" className="pointer-events-none text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function WordmarkIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M12 22c4.5-5.2 7-9 7-12.4A7 7 0 1 0 5 9.6C5 13 7.5 16.8 12 22Z"
        fill="var(--color-primary)"
      />
      <circle cx="12" cy="9.4" r="2.6" fill="var(--color-on-primary)" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function GpsIcon() {
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
      <path d="M12 22c4.5-5.2 7-9 7-12.4A7 7 0 1 0 5 9.6C5 13 7.5 16.8 12 22Z" />
      <circle cx="12" cy="9.6" r="2.4" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
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
      className={`animate-spin ${className ?? ""}`}
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </svg>
  );
}
