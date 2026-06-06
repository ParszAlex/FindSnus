"use client";

// The locator shell: a full-bleed map with floating chrome over it, and the
// compliance footer beneath. It owns all locator state (centre, radius, the
// fetched shops, the active brand filter, the selected shop) and feeds it to the
// presentational pieces. Data still comes from the one proven fetch in
// lib/shops — this layer only decides *what* to ask for and *how* to show it.
// Rendered on the home page only after the 18+ age gate is confirmed.

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  getNearbyShopsWithListings,
  type ShopWithListings,
} from "@/lib/shops";
import BrandFilter from "./BrandFilter";
import LocatorControls from "./LocatorControls";
import ResultsPill from "./ResultsPill";
import SiteFooter from "./SiteFooter";

// Leaflet touches `window` on import, so the map is client-only — never imported
// on the server. The placeholder keeps the surface calm while it loads.
const ShopMap = dynamic(() => import("./ShopMap"), {
  ssr: false,
  loading: () => <div className="size-full bg-surface" />,
});

// Default centre: Airdrie, matching the existing seed data.
const DEFAULT_LAT = 55.8657;
const DEFAULT_LNG = -3.9803;
const DEFAULT_RADIUS_MI = 3;

const MILE_KM = 1.609344; // exact; radius is shown in miles but fetched in km.

export default function Locator() {
  const [lat, setLat] = useState(DEFAULT_LAT);
  const [lng, setLng] = useState(DEFAULT_LNG);
  const [radiusMi, setRadiusMi] = useState(DEFAULT_RADIUS_MI);
  const [shops, setShops] = useState<ShopWithListings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [activeBrands, setActiveBrands] = useState<Set<string>>(new Set());
  const [brandsKey, setBrandsKey] = useState("");

  const radiusKm = radiusMi * MILE_KM;
  const center = useMemo<[number, number]>(() => [lat, lng], [lat, lng]);

  // Brand universe = every brand across the returned shops, alphabetical. The
  // filter and the popups both read this so a brand a shop doesn't carry can be
  // shown as an explicit "Not stocked here".
  const allBrands = useMemo(
    () =>
      [
        ...new Set(
          shops.flatMap((s) =>
            s.listings
              .map((l) => l.brand)
              .filter((b): b is string => b !== null),
          ),
        ),
      ].sort(),
    [shops],
  );

  // Reset the brand filter to "all active" whenever the brand universe changes
  // (a fetch returned a different set). Adjusting state during render is React's
  // documented alternative to an effect for "reset state when an input changes".
  const nextBrandsKey = allBrands.join("|");
  if (nextBrandsKey !== brandsKey) {
    setBrandsKey(nextBrandsKey);
    setActiveBrands(new Set(allBrands));
  }

  // One fetch per (centre, radius). State is set only in the promise callbacks,
  // never synchronously in the effect body; the immediate "loading" feedback is
  // set by the handlers that change those inputs (and by the initial state).
  useEffect(() => {
    let active = true;
    getNearbyShopsWithListings(lat, lng, radiusKm)
      .then((result) => {
        if (!active) return;
        setShops(result);
        setError(false);
      })
      .catch(() => {
        if (!active) return;
        setShops([]);
        setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lat, lng, radiusKm]);

  // A shop is visible while it stocks at least one active brand. Filtered-out
  // shops still render on the map (greyed), so the map never silently empties.
  const visibleShops = useMemo(
    () =>
      shops.filter((s) =>
        s.listings.some((l) => l.brand && activeBrands.has(l.brand)),
      ),
    [shops, activeBrands],
  );

  function handleLocationChange(newLat: number, newLng: number) {
    setSelectedShopId(null);
    setLoading(true);
    setLat(newLat);
    setLng(newLng);
  }

  function handleRadiusChange(miles: number) {
    setSelectedShopId(null);
    setLoading(true);
    setRadiusMi(miles);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="relative flex-1 overflow-hidden">
        <ShopMap
          shops={visibleShops}
          allShops={shops}
          center={center}
          radiusKm={radiusKm}
          selectedShopId={selectedShopId}
          onSelectShop={setSelectedShopId}
          allBrands={allBrands}
        />

        {/* Top rail: the two cards sit at opposite corners on desktop and stack
            on narrow screens. pointer-events-none lets map drags pass through
            the empty gap between them; each card re-enables its own. */}
        <div className="pointer-events-none absolute inset-x-[18px] top-[18px] z-[var(--z-sticky)] flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-0">
          <LocatorControls
            radiusMi={radiusMi}
            onRadiusChange={handleRadiusChange}
            onLocationChange={handleLocationChange}
            loading={loading}
          />

          {allBrands.length > 0 && (
            <BrandFilter
              brands={allBrands}
              active={activeBrands}
              onChange={setActiveBrands}
            />
          )}
        </div>

        <ResultsPill
          count={visibleShops.length}
          radiusMi={radiusMi}
          loading={loading}
          error={error}
        />
      </div>

      <SiteFooter />
    </div>
  );
}
