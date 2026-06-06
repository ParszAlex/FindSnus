"use client";

// The rich shop popup. Rendered as an absolutely-positioned overlay inside the
// Leaflet container (NOT a Leaflet <Popup>), so React owns its content and
// styling completely. <ShopMap> computes the pixel anchor from the marker's
// screen position and passes it in via `x` / `bottom`; this component is purely
// presentational. Brand rows are driven off `allBrands`, which <Locator> has
// already resolved against the active filter: the full catalogue when no filter
// is set, or just the selected brands otherwise. Each brand renders as a stocked
// row (strength/price) or an explicit "Not stocked here".

import type { Listing, ShopWithListings } from "@/lib/shops";

type Props = {
  shop: ShopWithListings;
  /** Brands to show, already resolved against the filter (full set or selection). */
  allBrands: string[];
  /** Marker x, and distance from the container's bottom edge, both in px. */
  x: number;
  bottom: number;
  onClose: () => void;
};

// 317.88 -> "320 m", 2245.39 -> "2.2 km". Mirrors the rest of the locator.
function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

function formatPrice(price: number): string {
  return `£${price.toFixed(2)}`;
}

export default function ShopPopup({
  shop,
  allBrands,
  x,
  bottom,
  onClose,
}: Props) {
  // Group this shop's listings by brand, strengths ascending — same ordering
  // the list view used, so the two never disagree on what a shop stocks.
  const byBrand = new Map<string, Listing[]>();
  for (const l of shop.listings) {
    if (l.brand === null) continue;
    const group = byBrand.get(l.brand) ?? [];
    group.push(l);
    byBrand.set(l.brand, group);
  }
  for (const group of byBrand.values()) {
    group.sort((a, b) => a.strength_mg - b.strength_mg);
  }

  return (
    <div
      role="dialog"
      aria-label={`${shop.name} details`}
      style={{ left: x, bottom }}
      // The map listens for pointer events on its container to pan/zoom; stop
      // them here so dragging or scrolling within the popup never moves the map.
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      className="absolute z-[1000] w-[268px] -translate-x-1/2"
    >
      <div className="relative overflow-hidden rounded-[14px] border border-border bg-bg shadow-popup">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-[9px] right-[9px] grid size-6 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <CloseIcon />
        </button>

        <div className="border-b border-border px-[14px] pt-[13px] pr-10 pb-[11px]">
          <div className="flex items-baseline justify-between gap-2.5">
            <h2 className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
              {shop.name}
            </h2>
            <span className="shrink-0 text-sm font-semibold text-primary tabular-nums">
              {formatDistance(shop.distance_m)}
            </span>
          </div>
          <p className="mt-[3px] text-xs text-muted">
            {shop.address} · {shop.postcode}
          </p>
        </div>

        <div className="px-[14px] pt-1.5 pb-[13px]">
          {allBrands.map((brand) => {
            const items = byBrand.get(brand);
            const stocked = items !== undefined;
            return (
              <div
                key={brand}
                className="border-b border-border py-[9px] last:border-b-0 last:pb-0.5"
              >
                <div
                  className={`mb-[5px] flex items-center gap-[7px] text-sm font-semibold ${
                    stocked ? "text-ink" : "text-muted"
                  }`}
                >
                  <span
                    className={`size-[7px] rounded-full ${
                      stocked ? "bg-primary" : "bg-border"
                    }`}
                    aria-hidden="true"
                  />
                  {brand}
                </div>
                {stocked ? (
                  <div className="flex flex-col gap-0.5">
                    {items.map((l) => (
                      <div
                        key={l.strength_mg}
                        className="flex justify-between gap-3 text-sm whitespace-nowrap text-ink"
                      >
                        <span className="text-muted">{l.strength_mg} mg</span>
                        <span className="font-medium tabular-nums">
                          {formatPrice(l.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted italic">Not stocked here</p>
                )}
              </div>
            );
          })}
        </div>

        {shop.verified && (
          <div className="flex items-center gap-1.5 border-t border-border bg-surface px-[14px] py-[9px] text-xs font-medium text-primary">
            <CheckIcon />
            Verified
          </div>
        )}
      </div>

      {/* Tail: a rotated square peeking below the card, pointing at the marker. */}
      <div
        aria-hidden="true"
        className="absolute -bottom-[7px] left-1/2 size-[14px] -translate-x-1/2 rotate-45 border-r border-b border-border bg-bg"
      />
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
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

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
