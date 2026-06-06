"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Listing, ShopWithListings } from "@/lib/shops";
import { RADIUS_MILES } from "./LocatorControls";

type Props = {
  shops: ShopWithListings[];
  allShops: ShopWithListings[];
  allBrands: string[];
  activeBrands: Set<string>;
  onBrandsChange: (brands: Set<string>) => void;
  selectedShopId: string | null;
  onSelectShop: (id: string | null) => void;
  radiusMi: number;
  onRadiusChange: (miles: number) => void;
  loading: boolean;
  hasLocation: boolean;
};

// Sheet geometry. Half is 42dvh (capped) rather than a fixed px so the map
// centre — where the user's location dot lands after a fly-to — stays visible
// above the sheet: on an 844px viewport the sheet top sits at ~490px, ~67px
// below centre (422px). Keep in sync with the h-[42dvh] max-h-[460px] classes.
const PEEK_HEIGHT_PX = 86;
const HALF_HEIGHT_DVH = 42;
const HALF_HEIGHT_MAX_PX = 460;
// Pointer movement below this is a tap (toggles the sheet); above it, a drag.
const DRAG_THRESHOLD_PX = 5;
// Release velocity (px/ms) above which the sheet snaps in the flick
// direction regardless of how far it has travelled.
const FLICK_VELOCITY_PX_PER_MS = 0.4;

// Pixel equivalent of the half-state CSS height.
function halfHeightPx(): number {
  return Math.min(
    (window.innerHeight * HALF_HEIGHT_DVH) / 100,
    HALF_HEIGHT_MAX_PX,
  );
}

type DragState = {
  pointerId: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastTime: number;
  velocity: number; // px/ms — positive when the finger is moving down
  moved: boolean; // true once movement passes DRAG_THRESHOLD_PX
};

// Mirrors the formatDistance used in ShopList and ShopPopup.
function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

function formatPrice(price: number): string {
  return `£${price.toFixed(2)}`;
}

// Cheapest price per stocked brand — same logic as ShopList's brandSummary.
function brandSummaries(
  shop: ShopWithListings,
): { brand: string; from: number }[] {
  const cheapest = new Map<string, number>();
  for (const l of shop.listings) {
    if (l.brand === null) continue;
    const cur = cheapest.get(l.brand);
    if (cur === undefined || l.price < cur) cheapest.set(l.brand, l.price);
  }
  return [...cheapest.entries()].map(([brand, from]) => ({ brand, from }));
}

// Group and sort listings by brand then strength ascending — mirrors ShopPopup.
function listingsByBrand(shop: ShopWithListings): Map<string, Listing[]> {
  const map = new Map<string, Listing[]>();
  for (const l of shop.listings) {
    if (l.brand === null) continue;
    const group = map.get(l.brand) ?? [];
    group.push(l);
    map.set(l.brand, group);
  }
  for (const group of map.values()) {
    group.sort((a, b) => a.strength_mg - b.strength_mg);
  }
  return map;
}

export default function MobileBottomSheet({
  shops,
  allShops,
  allBrands,
  activeBrands,
  onBrandsChange,
  selectedShopId,
  onSelectShop,
  radiusMi,
  onRadiusChange,
  loading,
  hasLocation,
}: Props) {
  const [sheetState, setSheetState] = useState<"peek" | "half">("peek");
  const [dragging, setDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  // A click event fires after every pointerup; this flags the one that
  // follows a real drag so it doesn't also toggle the sheet.
  const suppressClickRef = useRef(false);

  // When a drag ends, hand height control back to the CSS classes so the
  // re-enabled transition animates from the release point to the snap target.
  useLayoutEffect(() => {
    if (!dragging && sheetRef.current !== null) {
      sheetRef.current.style.height = "";
    }
  }, [dragging]);

  // When a shop is selected externally (e.g. map pin tap), snap to half.
  // Adjusted during render (React's documented alternative to an effect for
  // "reset state when an input changes") — mirrors the brandsKey pattern in
  // Locator.
  const [prevSelectedId, setPrevSelectedId] = useState(selectedShopId);
  if (selectedShopId !== prevSelectedId) {
    setPrevSelectedId(selectedShopId);
    if (selectedShopId !== null) setSheetState("half");
  }

  // When a fetch completes (loading: true → false) and the user has a location,
  // snap to half so the shop list becomes visible without a manual drag.
  const prevLoadingRef = useRef(loading);
  useEffect(() => {
    if (prevLoadingRef.current && !loading && hasLocation) {
      setSheetState("half");
    }
    prevLoadingRef.current = loading;
  }, [loading, hasLocation]);

  const showDetail = selectedShopId !== null && sheetState === "half";
  const selectedShop = showDetail
    ? (allShops.find((s) => s.id === selectedShopId) ?? null)
    : null;

  const shopCount = allShops.length;
  const radiusLabel = `${radiusMi} ${radiusMi === 1 ? "mile" : "miles"}`;

  function handleHandle() {
    if (showDetail) {
      onSelectShop(null);
      return;
    }
    setSheetState((s) => (s === "peek" ? "half" : "peek"));
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    handleHandle();
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const sheet = sheetRef.current;
    if (sheet === null) return;
    suppressClickRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight: sheet.getBoundingClientRect().height,
      lastY: e.clientY,
      lastTime: e.timeStamp,
      velocity: 0,
      moved: false,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const sheet = sheetRef.current;
    if (drag === null || sheet === null || e.pointerId !== drag.pointerId) {
      return;
    }

    const delta = drag.startY - e.clientY; // positive = finger moving up
    if (!drag.moved) {
      if (Math.abs(delta) < DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      setDragging(true);
    }
    // An upward drag from peek must show the sheet body immediately; the
    // inline height set below overrides the half-state class height.
    if (delta > 0 && sheetState === "peek") setSheetState("half");

    const dt = e.timeStamp - drag.lastTime;
    if (dt > 0) drag.velocity = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY;
    drag.lastTime = e.timeStamp;

    const height = Math.min(
      Math.max(drag.startHeight + delta, PEEK_HEIGHT_PX),
      halfHeightPx(),
    );
    sheet.style.height = `${height}px`;
  }

  function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const sheet = sheetRef.current;
    if (drag === null || sheet === null || e.pointerId !== drag.pointerId) {
      return;
    }
    dragRef.current = null;
    if (!drag.moved) return; // a tap — the click event that follows toggles

    // Snap: a flick wins; otherwise whichever state is nearer. A drag down
    // from the detail view collapses to peek but keeps the selection, so
    // dragging back up returns to the same shop.
    suppressClickRef.current = true;
    const midpoint = (PEEK_HEIGHT_PX + halfHeightPx()) / 2;
    const height = sheet.getBoundingClientRect().height;
    if (drag.velocity > FLICK_VELOCITY_PX_PER_MS) {
      setSheetState("peek");
    } else if (drag.velocity < -FLICK_VELOCITY_PX_PER_MS) {
      setSheetState("half");
    } else {
      setSheetState(height < midpoint ? "peek" : "half");
    }
    setDragging(false);
  }

  function toggleBrand(brand: string) {
    const next = new Set(activeBrands);
    if (next.has(brand)) {
      next.delete(brand);
    } else {
      next.add(brand);
    }
    onBrandsChange(next);
  }

  const sheetHeight =
    sheetState === "peek" ? "h-[86px]" : "h-[42dvh] max-h-[460px]";

  return (
    <div
      ref={sheetRef}
      className={`absolute bottom-0 left-0 right-0 z-[1001] flex flex-col overflow-hidden rounded-t-[20px] bg-bg shadow-[0_-3px_20px_rgba(0,0,0,0.12)] ${
        dragging
          ? ""
          : "transition-[height] duration-[380ms] ease-[cubic-bezier(.16,1,.3,1)]"
      } ${sheetHeight}`}
    >
      {/* Drag handle area */}
      <div
        role="button"
        tabIndex={0}
        aria-label={
          showDetail
            ? "Back to list"
            : sheetState === "peek"
              ? "Show shop list"
              : "Minimise"
        }
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleHandle();
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={`flex shrink-0 cursor-pointer touch-none select-none flex-col items-center ${
          sheetState === "peek" ? "pb-[6px] pt-[12px]" : "pt-[10px] pb-0"
        }`}
      >
        <div className="h-[4px] w-[36px] rounded-full bg-border" />

        {/* Peek state: count summary + See list chip */}
        {sheetState === "peek" && (
          <div className="mt-2 flex items-center gap-2 px-5">
            {loading || !hasLocation ? (
              <span className="text-[13px] font-semibold text-ink">
                {loading ? "Searching nearby…" : "Enter a location to search"}
              </span>
            ) : (
              <>
                <span className="text-[13px] font-semibold text-ink">
                  <strong>{shopCount}</strong>{" "}
                  {shopCount === 1 ? "shop" : "shops"} within {radiusLabel}
                </span>
                <span className="inline-flex items-center gap-[5px] rounded-full bg-ink px-[11px] py-[4px] text-[11px] font-semibold text-bg">
                  <ListIcon />
                  See list
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sheet body — only rendered in half state */}
      {sheetState === "half" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showDetail && selectedShop ? (
            <DetailView
              shop={selectedShop}
              allBrands={allBrands}
              onBack={() => onSelectShop(null)}
            />
          ) : (
            <ListView
              shops={shops}
              allBrands={allBrands}
              activeBrands={activeBrands}
              onToggleBrand={toggleBrand}
              selectedShopId={selectedShopId}
              onSelectShop={onSelectShop}
              shopCount={shopCount}
              radiusMi={radiusMi}
              radiusLabel={radiusLabel}
              onRadiusChange={onRadiusChange}
              loading={loading}
              hasLocation={hasLocation}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── List view ──────────────────────────────────────────────────────────────

type ListViewProps = {
  shops: ShopWithListings[];
  allBrands: string[];
  activeBrands: Set<string>;
  onToggleBrand: (brand: string) => void;
  selectedShopId: string | null;
  onSelectShop: (id: string | null) => void;
  shopCount: number;
  radiusMi: number;
  radiusLabel: string;
  onRadiusChange: (miles: number) => void;
  loading: boolean;
  hasLocation: boolean;
};

function ListView({
  shops,
  allBrands,
  activeBrands,
  onToggleBrand,
  selectedShopId,
  onSelectShop,
  shopCount,
  radiusMi,
  radiusLabel,
  onRadiusChange,
  loading,
  hasLocation,
}: ListViewProps) {
  return (
    <>
      {/* Non-scrolling header */}
      <div className="shrink-0 border-b border-border">
        <div className="flex items-center justify-between px-4 pt-2 pb-[10px]">
          <div>
            <h2 className="text-[15px] font-bold tracking-[-0.02em] text-ink">
              Nearby shops
            </h2>
            <p className="mt-[2px] text-[11px] text-muted">
              {loading
                ? "Searching nearby…"
                : !hasLocation
                  ? "Enter a location to search"
                  : `${shopCount} ${shopCount === 1 ? "shop" : "shops"} within ${radiusLabel}`}
            </p>
          </div>

          {/* Radius select */}
          <div className="relative">
            <select
              aria-label="Search radius"
              value={radiusMi}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              className="h-8 cursor-pointer appearance-none rounded-lg border border-border bg-bg py-0 pl-[10px] pr-6 text-[12px] font-medium text-ink"
            >
              {RADIUS_MILES.map((mi) => (
                <option key={mi} value={mi}>
                  {mi} {mi === 1 ? "mile" : "miles"}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute top-1/2 right-[7px] -translate-y-1/2 text-muted">
              <SmallChevronIcon />
            </span>
          </div>
        </div>

        {/* Horizontally-scrollable brand chips */}
        <div className="flex gap-[6px] overflow-x-auto pb-3 pl-4 pr-4 [scrollbar-width:none]">
          {allBrands.map((brand) => {
            const active = activeBrands.has(brand);
            return (
              <button
                key={brand}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleBrand(brand)}
                className={`inline-flex h-7 shrink-0 items-center gap-[5px] rounded-full px-[10px] text-[12px] font-medium transition-colors ${
                  active
                    ? "border border-primary bg-primary text-on-primary"
                    : "border border-border bg-bg text-ink"
                }`}
              >
                <span
                  className={`size-[5px] shrink-0 rounded-full ${
                    active ? "bg-on-primary" : "bg-muted"
                  }`}
                  aria-hidden="true"
                />
                {brand}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable shop list */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!hasLocation || shops.length === 0 ? (
          <p className="px-4 py-[18px] text-sm text-muted">
            {loading
              ? "Searching nearby…"
              : !hasLocation
                ? "Enter a postcode or share your location to find shops."
                : "No shops stock the selected brands in this area. Try widening the radius or selecting more brands."}
          </p>
        ) : (
          <ul>
            {shops.map((shop) => (
              <ShopRow
                key={shop.id}
                shop={shop}
                selected={shop.id === selectedShopId}
                onSelect={() => onSelectShop(shop.id)}
              />
            ))}
          </ul>
        )}
        {/* iOS home indicator clearance */}
        <div style={{ height: "env(safe-area-inset-bottom, 34px)" }} aria-hidden="true" />
      </div>
    </>
  );
}

// ─── Shop row ───────────────────────────────────────────────────────────────

type ShopRowProps = {
  shop: ShopWithListings;
  selected: boolean;
  onSelect: () => void;
};

function ShopRow({ shop, selected, onSelect }: ShopRowProps) {
  const summaries = brandSummaries(shop);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`flex w-full flex-col gap-[3px] border-b border-border px-4 py-[11px] text-left transition-colors last:border-b-0 ${
          selected ? "bg-surface" : ""
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
            {shop.name}
          </span>
          <span className="shrink-0 text-[12px] font-semibold text-primary tabular-nums">
            {formatDistance(shop.distance_m)}
          </span>
        </div>
        <span className="text-[11px] text-muted">
          {shop.address} · {shop.postcode}
        </span>
        {summaries.length > 0 && (
          <div className="mt-[2px] flex flex-wrap gap-1">
            {summaries.map(({ brand, from }) => (
              <span
                key={brand}
                className="inline-flex h-[22px] items-center gap-1 rounded-full border border-border bg-bg px-[7px] py-0 text-[11px] text-ink"
              >
                <span
                  className="size-[5px] shrink-0 rounded-full bg-primary"
                  aria-hidden="true"
                />
                {brand} from {formatPrice(from)}
              </span>
            ))}
          </div>
        )}
      </button>
    </li>
  );
}

// ─── Detail view ─────────────────────────────────────────────────────────────

type DetailViewProps = {
  shop: ShopWithListings;
  allBrands: string[];
  onBack: () => void;
};

function DetailView({ shop, allBrands, onBack }: DetailViewProps) {
  const byBrand = listingsByBrand(shop);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-[10px] border-b border-border px-4 py-[12px]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface"
        >
          <BackChevronIcon />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-bold tracking-[-0.02em] text-ink">
              {shop.name}
            </span>
            <span className="shrink-0 text-[13px] font-semibold text-primary tabular-nums">
              {formatDistance(shop.distance_m)}
            </span>
          </div>
          <p className="mt-[2px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted">
            {shop.address} · {shop.postcode}
          </p>
        </div>
      </div>

      {/* Scrollable brand rows */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 [scrollbar-width:none]">
        {allBrands.map((brand, idx) => {
          const items = byBrand.get(brand);
          const stocked = items !== undefined;
          return (
            <div
              key={brand}
              className={`py-[9px] ${idx < allBrands.length - 1 ? "border-b border-border" : ""}`}
            >
              <div
                className={`mb-[5px] flex items-center gap-[6px] text-[13px] font-semibold ${
                  stocked ? "text-ink" : "text-muted"
                }`}
              >
                <span
                  className={`size-[6px] shrink-0 rounded-full ${
                    stocked ? "bg-primary" : "bg-border"
                  }`}
                  aria-hidden="true"
                />
                {brand}
              </div>
              {stocked ? (
                <div className="flex flex-col gap-[2px] pl-3">
                  {items.map((l) => (
                    <div
                      key={l.strength_mg}
                      className="flex justify-between text-[13px] text-ink"
                    >
                      <span className="text-muted">{l.strength_mg} mg</span>
                      <span className="font-medium tabular-nums">
                        {formatPrice(l.price)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pl-3 text-[12px] text-muted italic">
                  Not stocked here
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="flex shrink-0 items-center justify-between border-t border-border bg-surface px-4 pt-[8px]"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))" }}
      >
        {shop.verified ? (
          <span className="flex items-center gap-[5px] text-[11px] font-medium text-primary">
            <CheckIcon />
            Verified
          </span>
        ) : (
          <span className="text-[11px] text-muted">Unverified listing</span>
        )}
      </div>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function ListIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function SmallChevronIcon() {
  return (
    <svg
      width="11"
      height="11"
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

function BackChevronIcon() {
  return (
    <svg
      width="8"
      height="13"
      viewBox="0 0 8 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 1L1 7l6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
