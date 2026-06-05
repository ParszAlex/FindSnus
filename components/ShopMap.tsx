"use client";

// The Leaflet map for the locator. Leaflet reads `window` the moment it's
// imported, so this module must never be evaluated on the server — Locator pulls
// it in via next/dynamic({ ssr: false }). It renders the SAME shops the list
// does (one fetch, in lib/shops), so the pins and the list can't disagree.

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { Listing, ShopWithListings } from "@/lib/shops";

// Leaflet builds its default marker-image URLs from a path the bundler rewrites,
// so the icons 404 out of the box (the well-known leaflet + webpack/turbopack
// issue). Point them at the asset URLs the bundler actually emits. Turbopack
// hands a PNG import back as a URL string, but webpack/other setups return a
// StaticImageData object ({ src }), so normalise either shape to a URL.
function assetUrl(asset: string | { src: string }): string {
  return typeof asset === "string" ? asset : asset.src;
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl: assetUrl(iconRetinaUrl),
  iconUrl: assetUrl(iconUrl),
  shadowUrl: assetUrl(shadowUrl),
});

// Mirror Locator's formatters so the popup reads exactly like the list. Kept
// local (two one-liners) to keep this client-only module self-contained.
function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

function formatPrice(price: number): string {
  return `£${price.toFixed(2)}`;
}

// Frame the map to whatever markers exist, regardless of the seed coords — so
// all shops are on-screen now, and it still works once the coord goes dynamic.
function FitToMarkers({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
  }, [map, positions]);
  return null;
}

export default function ShopMap({
  shops,
  center,
  zoom,
}: {
  shops: ShopWithListings[];
  center: [number, number];
  zoom: number;
}) {
  const positions = useMemo<[number, number][]>(
    () => shops.map((s) => [s.lat, s.lng]),
    [shops],
  );
  const allBrands = useMemo(() => brandUniverse(shops), [shops]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={false}
      className="h-80 w-full rounded-lg border border-border"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToMarkers positions={positions} />
      {shops.map((shop) => (
        <Marker key={shop.id} position={[shop.lat, shop.lng]}>
          <Popup>
            <ShopPopup shop={shop} allBrands={allBrands} />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

// Same brand universe the list uses: every brand seen across the returned shops,
// alphabetical. Driving the popup off this (not the shop's own listings) is what
// lets a stocking shop list a brand while another shows "Not stocked here".
function brandUniverse(shops: ShopWithListings[]): string[] {
  return [
    ...new Set(
      shops.flatMap((s) =>
        s.listings.map((l) => l.brand).filter((b): b is string => b !== null),
      ),
    ),
  ].sort();
}

function ShopPopup({
  shop,
  allBrands,
}: {
  shop: ShopWithListings;
  allBrands: string[];
}) {
  // Group this shop's listings by brand, strengths ascending — same as the list.
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
    <div className="min-w-44">
      <p className="text-sm font-semibold">{shop.name}</p>
      <p className="text-xs text-muted">{formatDistance(shop.distance_m)}</p>

      <dl className="mt-2 space-y-1.5">
        {allBrands.map((brand) => {
          const items = byBrand.get(brand);
          return (
            <div key={brand}>
              <dt className="text-xs font-medium">{brand}</dt>
              <dd className="text-xs">
                {items ? (
                  <ul className="space-y-0.5">
                    {items.map((l) => (
                      <li
                        key={l.strength_mg}
                        className="flex justify-between gap-3"
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
    </div>
  );
}
