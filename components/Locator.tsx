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
  getAllBrands,
  getNearbyShopsWithListings,
  type ShopWithListings,
} from "@/lib/shops";
import BrandFilter from "./BrandFilter";
import LocatorControls from "./LocatorControls";
import MobileBottomSheet from "./MobileBottomSheet";
import MobileSearchPill from "./MobileSearchPill";
import ResultsPill from "./ResultsPill";
import ShopList from "./ShopList";
import SiteFooter from "./SiteFooter";
import ThemeToggle from "./ThemeToggle";

// MapLibre touches `window` on import, so the map is client-only — never
// imported on the server. The placeholder keeps the surface calm while it loads.
const ShopMap = dynamic(() => import("./ShopMap"), {
  ssr: false,
  loading: () => <div className="size-full bg-surface" />,
});

// Default centre: Airdrie, matching the existing seed data.
const DEFAULT_LAT = 55.8657;
const DEFAULT_LNG = -3.9803;
const DEFAULT_RADIUS_MI = 1;

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
  const [catalogue, setCatalogue] = useState<string[]>([]);
  // False until the user picks a location (search or "use my location"). Gates
  // the radius ring + "you are here" dot + the close fly-in in ShopMap; on first
  // load the map sits at the Airdrie default with shop pins but no ring/dot.
  const [hasLocation, setHasLocation] = useState(false);
  // Whether the left-side list drawer is open.
  const [listOpen, setListOpen] = useState(false);
  // Bumped on every location/radius request so the fetch effect re-runs even
  // when lat/lng/radiusKm are unchanged (e.g. "use my location" resolving to the
  // exact same fix twice). Without this, an identical-input request would skip
  // the effect and never clear `loading` — the infinite-loading bug.
  const [fetchNonce, setFetchNonce] = useState(0);
  // Bumped on every explicit location request (search or GPS) so ShopMap always
  // flies back to the user's position even when the coordinates are identical to
  // the last fix (i.e. the user has panned away and wants to re-centre).
  const [recenterKey, setRecenterKey] = useState(0);

  const radiusKm = radiusMi * MILE_KM;
  const center = useMemo<[number, number]>(() => [lat, lng], [lat, lng]);

  // The brand universe is the full `brands` catalogue — including brands with
  // zero listings, which no shop carries and so could never be recovered from
  // listings alone. We still union in any brand a returned shop actually lists,
  // so a listing referencing a brand not yet in the fetched catalogue (data
  // drift) is never silently dropped. This universe drives both the filter chips
  // and the popup's "all brands" view, so a brand a shop lacks shows as an
  // explicit "Not stocked here".
  const allBrands = useMemo(
    () =>
      [
        ...new Set([
          ...catalogue,
          ...shops.flatMap((s) =>
            s.listings
              .map((l) => l.brand)
              .filter((b): b is string => b !== null),
          ),
        ]),
      ].sort(),
    [catalogue, shops],
  );

  // Fetch the full brand catalogue once on mount. It's location-independent, so
  // unlike the shop fetch it doesn't re-run when the centre or radius changes.
  useEffect(() => {
    let active = true;
    getAllBrands()
      .then((brands) => {
        if (active) setCatalogue(brands.map((b) => b.name));
      })
      .catch(() => {
        // Non-fatal: allBrands falls back to the listing-derived set above, so
        // the locator still works — it just won't show zero-listing brands.
      });
    return () => {
      active = false;
    };
  }, []);

  // Reset the brand filter to "all active" whenever the brand universe changes
  // (the catalogue loaded, or a fetch surfaced a new listing brand). Adjusting
  // state during render is React's documented alternative to an effect for
  // "reset state when an input changes".
  const nextBrandsKey = allBrands.join("|");
  if (nextBrandsKey !== brandsKey) {
    setBrandsKey(nextBrandsKey);
    setActiveBrands(new Set(allBrands));
  }

  // The brand set the popup shows, RESPECTING the filter. With no filter active
  // — nothing selected, or every brand selected (the default) — the popup shows
  // the complete universe. With a specific selection, it shows only those
  // brands. Each resolves to a stocked row or an explicit "Not stocked here".
  const popupBrands = useMemo(() => {
    const noFilter =
      activeBrands.size === 0 || activeBrands.size === allBrands.length;
    return noFilter
      ? allBrands
      : allBrands.filter((b) => activeBrands.has(b));
  }, [allBrands, activeBrands]);

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
    // `fetchNonce` is included so an identical-input request (same lat/lng/radius)
    // still re-runs this effect and resolves the loading state — the backstop for
    // Issue 3. The handlers only bump the nonce + set loading when something will
    // actually change, so this never causes a redundant fetch on a true no-op.
  }, [lat, lng, radiusKm, fetchNonce]);

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
    // First location pick (from any default) reveals the ring + user dot.
    setHasLocation(true);
    setSelectedShopId(null);

    // If the coords are unchanged (same GPS fix, or a fast second click that
    // resolves identically), React would skip the lat/lng state change and the
    // fetch effect's [lat, lng, radiusKm] deps wouldn't fire — leaving `loading`
    // stuck on forever. We still want feedback + a re-fetch, so bump the nonce
    // (which the fetch effect also depends on) and enter loading. When the coords
    // DO change, set them too; loading is entered once, the effect runs once.
    const changed = newLat !== lat || newLng !== lng;
    setLoading(true);
    setFetchNonce((n) => n + 1);
    setRecenterKey((k) => k + 1);
    if (changed) {
      setLat(newLat);
      setLng(newLng);
    }
  }

  function handleRadiusChange(miles: number) {
    // No-op guard: re-selecting the current radius shouldn't enter loading at all
    // (nothing to fetch), which also can't get stuck since the effect won't run.
    if (miles === radiusMi) return;
    setSelectedShopId(null);
    setLoading(true);
    setRadiusMi(miles);
  }

  return (
    // Mobile: `fixed inset-0` pins the shell to the layout viewport's edges, so
    // in standalone (home-screen) mode — where viewport-fit=cover +
    // black-translucent make that viewport the whole physical screen — the map
    // canvas paints under the Dynamic Island. `h-dvh` is the fragile version of
    // the same idea: WebKit resolves dvh (and env()) against stale geometry on
    // standalone cold start until the viewport is exercised, whereas fixed
    // positioning tracks the real viewport without consulting those values. In a
    // regular Safari tab the island strip belongs to Safari's chrome
    // (safe-area-inset-top is 0 in portrait) — no web content can paint there,
    // so it falls back to the colour-matched html background instead. Desktop
    // (sm+) keeps the in-flow column so SiteFooter sits below the map.
    <div className="fixed inset-0 flex flex-col overflow-hidden sm:static sm:h-dvh">
      <div className="relative flex-1 overflow-hidden">
        <ShopMap
          shops={visibleShops}
          allShops={shops}
          center={center}
          radiusKm={radiusKm}
          hasLocation={hasLocation}
          selectedShopId={selectedShopId}
          onSelectShop={setSelectedShopId}
          // The popup's brand list, already resolved against the active filter.
          // ShopMap forwards this straight to ShopPopup; markers don't read it.
          allBrands={popupBrands}
          recenterKey={recenterKey}
        />

        {/* Theme toggle: stacked directly above the zoom card (which sits at
            bottom 106px mobile / 40px desktop and is 85px tall; 12px gap). */}
        <div className="absolute right-[18px] bottom-[203px] z-[1000] sm:bottom-[137px]">
          <ThemeToggle />
        </div>

        {/* Mobile chrome (< sm): glass search pill + Apple Maps bottom sheet */}
        <div className="sm:hidden">
          <MobileSearchPill
            onLocationChange={handleLocationChange}
            loading={loading}
          />
          <MobileBottomSheet
            shops={visibleShops}
            allShops={shops}
            allBrands={allBrands}
            activeBrands={activeBrands}
            onBrandsChange={setActiveBrands}
            selectedShopId={selectedShopId}
            onSelectShop={setSelectedShopId}
            radiusMi={radiusMi}
            onRadiusChange={handleRadiusChange}
            loading={loading}
            hasLocation={hasLocation}
          />
        </div>

        {/* Desktop chrome (sm+): left drawer */}
        <div className="hidden sm:block">
          <ShopList
            shops={visibleShops}
            selectedShopId={selectedShopId}
            onSelectShop={setSelectedShopId}
            open={listOpen}
            onClose={() => setListOpen(false)}
            radiusMi={radiusMi}
            loading={loading}
          />
        </div>

        {/* Desktop chrome (sm+): top rail — search card + brand filter */}
        <div className="pointer-events-none absolute inset-x-[18px] top-[18px] z-[var(--z-sticky)] hidden sm:flex sm:flex-row sm:items-start sm:justify-between">
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

        {/* Desktop chrome (sm+): results pill */}
        <div className="hidden sm:block">
          <ResultsPill
            count={visibleShops.length}
            radiusMi={radiusMi}
            loading={loading}
            error={error}
            listOpen={listOpen}
            onToggleList={() => setListOpen((o) => !o)}
          />
        </div>
      </div>

      {/* Footer is desktop-only; the mobile sheet grounds the page instead */}
      <div className="hidden sm:block">
        <SiteFooter />
      </div>
    </div>
  );
}
