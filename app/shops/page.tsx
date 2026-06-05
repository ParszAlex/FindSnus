"use client";

// Step 3 of 4 — the locator list. Consumes lib/shops.getNearbyShopsWithListings
// (the same fetch proven on /rpc-test) and renders nearest-first shops with each
// brand's strengths + prices. No map, no cheapest-highlight yet — that's step 4.
// Lives at /shops (not /) so the age-gated landing stays the entry point.

import { useEffect, useState } from "react";
import {
  getNearbyShopsWithListings,
  type Listing,
  type ShopWithListings,
} from "@/lib/shops";

// Hardcoded Airdrie centre + radius, matching the proven /rpc-test call. A real
// postcode / "use my location" input replaces these in a later step.
const LAT = 55.8657;
const LNG = -3.9803;
const RADIUS_KM = 10;

// 317.88 -> "320 m", 2245.39 -> "2.2 km".
function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

function formatPrice(price: number): string {
  return `£${price.toFixed(2)}`;
}

export default function ShopsPage() {
  const [shops, setShops] = useState<ShopWithListings[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    getNearbyShopsWithListings(LAT, LNG, RADIUS_KM)
      .then((result) => {
        setShops(result);
        setError(null);
      })
      .catch((e) => setError(e));
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Nearby shops</h1>

      {error ? (
        <p className="mt-6 text-muted">
          Couldn’t load shops right now. Please try again.
        </p>
      ) : shops === null ? (
        <p className="mt-6 text-muted">Loading shops…</p>
      ) : shops.length === 0 ? (
        <p className="mt-6 text-muted">No shops found within {RADIUS_KM} km.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            {shops.length} {shops.length === 1 ? "shop" : "shops"} within{" "}
            {RADIUS_KM} km, nearest first.
          </p>
          <ShopList shops={shops} />
        </>
      )}
    </main>
  );
}

function ShopList({ shops }: { shops: ShopWithListings[] }) {
  // Brand universe = every brand seen across the returned shops, alphabetical.
  // Driving each shop's render off this (not off its own listings) is what lets
  // us say "Not stocked here" for a brand a shop simply doesn't carry.
  const allBrands = [
    ...new Set(
      shops.flatMap((s) =>
        s.listings
          .map((l) => l.brand)
          .filter((b): b is string => b !== null),
      ),
    ),
  ].sort();

  return (
    <ul className="mt-6 space-y-4">
      {shops.map((shop) => (
        <ShopCard key={shop.id} shop={shop} allBrands={allBrands} />
      ))}
    </ul>
  );
}

function ShopCard({
  shop,
  allBrands,
}: {
  shop: ShopWithListings;
  allBrands: string[];
}) {
  // Group this shop's listings by brand, each brand's strengths ascending.
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
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">{shop.name}</h2>
        <span className="shrink-0 text-sm text-muted">
          {formatDistance(shop.distance_m)}
        </span>
      </div>
      <p className="text-sm text-muted">{shop.address}</p>

      <dl className="mt-3 divide-y divide-border">
        {allBrands.map((brand) => {
          const items = byBrand.get(brand);
          return (
            <div key={brand} className="py-2 first:pt-0 last:pb-0">
              <dt className="text-sm font-medium">{brand}</dt>
              <dd className="mt-1 text-sm">
                {items ? (
                  <ul className="space-y-0.5">
                    {items.map((l) => (
                      <li
                        key={l.strength_mg}
                        className="flex justify-between gap-4"
                      >
                        <span>{l.strength_mg} mg</span>
                        <span className="tabular-nums">
                          {formatPrice(l.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted italic">Not stocked here</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </li>
  );
}
