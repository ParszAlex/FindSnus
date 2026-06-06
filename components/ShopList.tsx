"use client";

// The left-side list drawer for the locator. A collapsible panel that slides in
// from the LEFT edge over the map, listing the shops that match the active brand
// filter (the same `visibleShops` the map pins). It's a sibling overlay of the
// map in <Locator> — not a MapLibre layer — so it owns its own styling with the
// shared design tokens (white card, border, shadows, ink/muted text).
//
// Each row is a button: clicking it calls `onSelectShop(id)`, which reuses the
// existing selection flow in <Locator>/<ShopMap> — that pans the map to the shop
// and opens its popup. The drawer deliberately stays open on selection so the
// user can keep scanning the list. The pill button (in <ResultsPill>) toggles
// `open`; the drawer also offers its own close affordance.

import type { ShopWithListings } from "@/lib/shops";

type Props = {
  /** Shops matching the active brand filter — same set the map pins. */
  shops: ShopWithListings[];
  selectedShopId: string | null;
  /** Select a shop: reuses the map's pan + popup flow. */
  onSelectShop: (id: string | null) => void;
  /** Whether the drawer is open. */
  open: boolean;
  /** Collapse the drawer. */
  onClose: () => void;
  radiusMi: number;
  loading: boolean;
};

// 317.88 -> "320 m", 2245.39 -> "2.2 km". Matches <ShopPopup> exactly so the
// two surfaces never disagree on a distance.
function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

function formatPrice(price: number): string {
  return `£${price.toFixed(2)}`;
}

// A compact "Brand from £X.XX" summary line per stocked brand, strengths folded
// into the cheapest price so a row stays scannable. Brands ordered as the shop's
// listings arrive, deduped.
function brandSummary(shop: ShopWithListings): { brand: string; from: number }[] {
  const cheapest = new Map<string, number>();
  for (const l of shop.listings) {
    if (l.brand === null) continue;
    const current = cheapest.get(l.brand);
    if (current === undefined || l.price < current) {
      cheapest.set(l.brand, l.price);
    }
  }
  return [...cheapest.entries()].map(([brand, from]) => ({ brand, from }));
}

export default function ShopList({
  shops,
  selectedShopId,
  onSelectShop,
  open,
  onClose,
  radiusMi,
  loading,
}: Props) {
  const radiusLabel = `${radiusMi} ${radiusMi === 1 ? "mile" : "miles"}`;

  return (
    // The whole drawer slides off-screen to the left when closed (translate +
    // pointer-events off) so the map underneath stays fully interactive. It never
    // covers the whole viewport: a fixed sensible width, capped on narrow screens.
    <div
      className={`pointer-events-none absolute inset-y-0 left-0 z-[var(--z-modal)] flex max-w-[86vw] flex-col transition-transform duration-300 ease-out sm:max-w-none ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
      aria-hidden={!open}
    >
      <div
        role="dialog"
        aria-label="Nearby shops list"
        // Stop map drag/scroll from leaking through the panel to the canvas.
        onMouseDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className={`pointer-events-auto mx-[18px] mb-[18px] mt-[200px] sm:m-[18px] flex w-[330px] max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-float max-h-[calc(100%-218px)] sm:max-h-[calc(100%-36px)] ${
          open ? "" : "invisible"
        }`}
      >
        {/* Header: title + live count + close. */}
        <div className="flex items-center justify-between gap-2.5 border-b border-border px-[16px] pt-[14px] pb-[13px]">
          <div>
            <h2 className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
              Nearby shops
            </h2>
            <p className="mt-[2px] text-xs text-muted">
              {loading
                ? "Searching nearby…"
                : `${shops.length} ${
                    shops.length === 1 ? "shop" : "shops"
                  } within ${radiusLabel}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close list"
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body: scrollable list of shop rows, or an empty state. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {shops.length === 0 ? (
            <p className="px-[16px] py-[18px] text-sm text-muted">
              {loading
                ? "Searching nearby…"
                : "No shops stock the selected brands in this area. Try widening the radius or selecting more brands."}
            </p>
          ) : (
            <ul>
              {shops.map((shop) => {
                const isSelected = shop.id === selectedShopId;
                const brands = brandSummary(shop);
                return (
                  <li key={shop.id}>
                    <button
                      type="button"
                      onClick={() => onSelectShop(shop.id)}
                      aria-pressed={isSelected}
                      className={`flex w-full flex-col gap-[5px] border-b border-border px-[16px] py-[12px] text-left transition-colors last:border-b-0 ${
                        isSelected
                          ? "bg-surface"
                          : "hover:bg-surface"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2.5">
                        <span className="font-semibold tracking-[-0.01em] text-ink">
                          {shop.name}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
                          {formatDistance(shop.distance_m)}
                        </span>
                      </div>
                      <span className="text-xs text-muted">
                        {shop.address} · {shop.postcode}
                      </span>
                      {brands.length > 0 && (
                        <div className="mt-[3px] flex flex-wrap gap-[6px]">
                          {brands.map(({ brand, from }) => (
                            <span
                              key={brand}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border px-[9px] py-[3px] text-xs text-ink"
                            >
                              <span
                                className="size-[6px] rounded-full bg-primary"
                                aria-hidden="true"
                              />
                              {brand}
                              <span className="text-muted tabular-nums">
                                {formatPrice(from)}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
