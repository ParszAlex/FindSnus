"use client";

// The full-viewport Leaflet map for the locator. Leaflet reads `window` on
// import, so this module is client-only — <Locator> pulls it in via
// next/dynamic({ ssr: false }). The map IS the page: it fills its fixed parent,
// and all chrome (search, filters, pill, footer) floats over it from <Locator>.
//
// Markers are custom SVG divIcons (not Leaflet defaults) so pin colour can carry
// state: blue = selected, white = stocks an active brand, grey = filtered out.
// The shop popup is NOT a Leaflet <Popup> — it's a React overlay we position from
// the marker's screen point, so its styling is wholly ours (see <ShopPopup>).

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { ShopWithListings } from "@/lib/shops";
import ShopPopup from "./ShopPopup";

// The single brand blue, as a literal — Leaflet paints to canvas/SVG it owns, so
// it can't read our Tailwind/CSS custom properties. Kept in one place.
const BRAND = "oklch(0.4 0.14 255)";

type Props = {
  /** Shops matching the active brand filter (drives marker fill + popup data). */
  shops: ShopWithListings[];
  /** Every shop in radius — all are pinned; non-matching ones render greyed. */
  allShops: ShopWithListings[];
  center: [number, number];
  radiusKm: number;
  selectedShopId: string | null;
  onSelectShop: (id: string | null) => void;
  allBrands: string[];
};

// "You are here": a solid blue dot with a white ring and a looping pulse. Static,
// so it's built once at module load. The pulse lives in globals.css (.user-ping).
const userIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:${BRAND};border:3px solid white;box-shadow:0 0 0 1px oklch(0.4 0.14 255 / .35), 0 2px 6px oklch(0 0 0 / .25);position:relative;"><span class="user-ping"></span></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// A teardrop pin whose fills encode state. Built per render of a marker (cheap),
// keyed below so React only swaps the icon when the state actually changes.
function shopIcon(isSelected: boolean, isOut: boolean): L.DivIcon {
  const body = isSelected ? BRAND : isOut ? "oklch(0.985 0 0)" : "white";
  const stroke = isSelected ? BRAND : "oklch(0.91 0 0)";
  const dot = isSelected ? "white" : isOut ? "oklch(0.46 0 0)" : BRAND;
  return L.divIcon({
    className: "",
    html: `<svg width="30" height="40" viewBox="0 0 30 40" style="filter:drop-shadow(0 3px 4px oklch(0 0 0 / .28))"><path fill="${body}" stroke="${stroke}" stroke-width="1" d="M15 1C7.3 1 1 7.1 1 14.6 1 24 15 39 15 39s14-15 14-24.4C29 7.1 22.7 1 15 1Z"/><circle fill="${dot}" cx="15" cy="14.5" r="5.4"/></svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
  });
}

export default function ShopMap({
  shops,
  allShops,
  center,
  radiusKm,
  selectedShopId,
  onSelectShop,
  allBrands,
}: Props) {
  const [lat, lng] = center;
  const visibleIds = useMemo(() => new Set(shops.map((s) => s.id)), [shops]);

  return (
    <MapContainer
      center={center}
      zoom={13}
      zoomControl={false}
      scrollWheelZoom
      className="z-0"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution={
          process.env.NEXT_PUBLIC_STADIA_API_KEY
            ? '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }
        // Stadia Maps "Alidade Smooth": a low-contrast basemap that lets the
        // brand-coloured pins read clearly. The key is domain-restricted and
        // client-safe (NEXT_PUBLIC_). If it's unset we fall back to CartoDB
        // Voyager so a missing key never renders a blank grey grid.
        url={
          process.env.NEXT_PUBLIC_STADIA_API_KEY
            ? `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${process.env.NEXT_PUBLIC_STADIA_API_KEY}`
            : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        }
      />

      <MapController lat={lat} lng={lng} radiusKm={radiusKm} />

      <Circle
        center={center}
        radius={radiusKm * 1000}
        pathOptions={{
          color: BRAND,
          fillColor: BRAND,
          fillOpacity: 0.07,
          dashArray: "6 5",
          weight: 1.5,
        }}
      />

      <Marker
        position={center}
        icon={userIcon}
        interactive={false}
        keyboard={false}
      />

      {allShops.map((shop) => {
        const isSelected = shop.id === selectedShopId;
        const isOut = !visibleIds.has(shop.id);
        return (
          <Marker
            key={shop.id}
            position={[shop.lat, shop.lng]}
            icon={shopIcon(isSelected, isOut)}
            zIndexOffset={isSelected ? 1000 : 0}
            keyboard
            title={shop.name}
            eventHandlers={{ click: () => onSelectShop(shop.id) }}
          />
        );
      })}

      <ZoomControls />

      <PopupLayer
        shops={allShops}
        allBrands={allBrands}
        selectedShopId={selectedShopId}
        onClose={() => onSelectShop(null)}
      />
    </MapContainer>
  );
}

// Re-frames the map whenever the centre or radius changes (postcode search,
// "use my location", radius dropdown) so the radius circle is always in view.
// Depends only on primitives, so a plain user pan/zoom never triggers a refit.
function MapController({
  lat,
  lng,
  radiusKm,
}: {
  lat: number;
  lng: number;
  radiusKm: number;
}) {
  const map = useMap();
  useEffect(() => {
    // A box ~1.2× the circle's diameter, centred on the user — frames the
    // circle with a little breathing room at any radius.
    const bounds = L.latLng(lat, lng).toBounds(radiusKm * 1000 * 2.4);
    map.fitBounds(bounds);
  }, [map, lat, lng, radiusKm]);
  return null;
}

// Custom zoom buttons styled as the design's white card. Rendered inside the
// map (so it can drive `useMap`); propagation is stopped so dragging/clicking
// the buttons never pans or click-zooms the map underneath.
function ZoomControls() {
  const map = useMap();
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="absolute right-[18px] bottom-[22px] z-[1000] flex flex-col overflow-hidden rounded-xl border border-border bg-bg shadow-zoom"
    >
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => map.zoomIn()}
        className="grid size-[42px] place-items-center border-b border-border text-ink transition-colors hover:bg-surface"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => map.zoomOut()}
        className="grid size-[42px] place-items-center text-ink transition-colors hover:bg-surface"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
        </svg>
      </button>
    </div>
  );
}

// Renders <ShopPopup> as an overlay anchored above the selected marker. The
// anchor is derived from the live map projection *during render*, and a cheap
// re-render is forced on every map move / zoom / resize so the popup stays
// pinned to its pin while the map animates — no position state to drift.
function PopupLayer({
  shops,
  allBrands,
  selectedShopId,
  onClose,
}: {
  shops: ShopWithListings[];
  allBrands: string[];
  selectedShopId: string | null;
  onClose: () => void;
}) {
  const map = useMap();
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);
  useMapEvents({ move: rerender, zoom: rerender, resize: rerender });

  const selectedShop = shops.find((s) => s.id === selectedShopId) ?? null;
  if (!selectedShop) return null;

  const pt = map.latLngToContainerPoint([selectedShop.lat, selectedShop.lng]);
  const size = map.getSize();
  // `bottom` measures up from the container's bottom edge; +46px clears the
  // 40px pin plus the popup's little tail.
  return (
    <ShopPopup
      shop={selectedShop}
      allBrands={allBrands}
      x={pt.x}
      bottom={size.y - pt.y + 46}
      onClose={onClose}
    />
  );
}
