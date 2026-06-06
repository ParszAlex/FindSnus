"use client";

// The full-viewport MapLibre GL map for the locator. MapLibre reads `window` on
// import, so this module is client-only — <Locator> pulls it in via
// next/dynamic({ ssr: false }). The map IS the page: it fills its full-bleed
// parent (fixed inset-0 on mobile, in-flow on desktop), and all chrome (search,
// filters, pill, footer) floats over it from <Locator>.
//
// Basemap is a hand-built cartoon/plastic style on Stadia's OpenMapTiles vector
// tiles (see lib/mapStyle.ts), with 3D fill-extrusion buildings at high zoom.
//
// Markers are custom HTML markers (maplibregl.Marker with our own DOM) so pin
// colour can carry state: blue = selected, white = stocks an active brand,
// grey = filtered out. The shop popup is NOT a MapLibre popup — it's a React
// overlay positioned from the marker's screen point via map.project(), so its
// styling is wholly ours (see <ShopPopup>).
//
// Why no React wrapper (react-map-gl etc.): the popup is already a manual React
// overlay anchored from projected pixel coords, and markers are plain DOM. A
// wrapper buys almost nothing here, so we drive MapLibre directly via a ref +
// effects and keep the dependency surface to just maplibre-gl.

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ShopWithListings } from "@/lib/shops";
import { buildStyle } from "@/lib/mapStyle";
import ShopPopup from "./ShopPopup";

// The single brand blue, as a literal — MapLibre paints its own GL canvas/DOM
// markers, so it can't read our Tailwind/CSS custom properties. The HTML markers
// (real DOM/CSS) take the oklch; the GL paint validator only accepts legacy CSS
// colours, so the radius layers use the sRGB hex equivalent of the same blue.
const BRAND = "oklch(0.4 0.14 255)";
const BRAND_HEX = "#004590"; // == oklch(0.4 0.14 255) in sRGB

type Props = {
  /** Shops matching the active brand filter (drives marker fill + popup data). */
  shops: ShopWithListings[];
  /** Every shop in radius — all are pinned; non-matching ones render greyed. */
  allShops: ShopWithListings[];
  center: [number, number];
  radiusKm: number;
  /** False until the user picks a location: hide the ring + user dot, and don't
   *  auto-pan. Once true, the ring + dot appear and the map flies in. */
  hasLocation: boolean;
  selectedShopId: string | null;
  onSelectShop: (id: string | null) => void;
  allBrands: string[];
  /** Bumped by Locator on every explicit location request (search or GPS).
   *  ShopMap uses this to fly back to the user even when coordinates are
   *  identical to the last fix — i.e. the user has panned away and taps
   *  "Use my location" again. */
  recenterKey: number;
};

// A teardrop pin whose fills encode state. Returned as an HTML string for a
// custom maplibregl.Marker element.
function pinSvg(isSelected: boolean, isOut: boolean): string {
  const body = isSelected ? BRAND : isOut ? "oklch(0.985 0 0)" : "white";
  const stroke = isSelected ? BRAND : "oklch(0.91 0 0)";
  const dot = isSelected ? "white" : isOut ? "oklch(0.46 0 0)" : BRAND;
  return `<svg width="30" height="40" viewBox="0 0 30 40" style="display:block;filter:drop-shadow(0 3px 4px oklch(0 0 0 / .28))"><path fill="${body}" stroke="${stroke}" stroke-width="1" d="M15 1C7.3 1 1 7.1 1 14.6 1 24 15 39 15 39s14-15 14-24.4C29 7.1 22.7 1 15 1Z"/><circle fill="${dot}" cx="15" cy="14.5" r="5.4"/></svg>`;
}

// "You are here": a solid blue dot with a white ring and a looping pulse. The
// pulse lives in globals.css (.user-ping).
function userMarkerEl(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `width:18px;height:18px;border-radius:50%;background:${BRAND};border:3px solid white;box-shadow:0 0 0 1px oklch(0.4 0.14 255 / .35), 0 2px 6px oklch(0 0 0 / .25);position:relative;`;
  const ping = document.createElement("span");
  ping.className = "user-ping";
  el.appendChild(ping);
  return el;
}

// A GeoJSON ring approximating the radius circle, for the dashed indicator.
// MapLibre has no Circle primitive; a 64-point polygon reads as a circle and
// scales correctly with zoom (unlike a screen-space SVG).
function circleGeoJson(
  lat: number,
  lng: number,
  radiusKm: number,
): maplibregl.GeoJSONSourceSpecification["data"] {
  const points = 64;
  const coords: [number, number][] = [];
  const latR = radiusKm / 110.574; // deg per km, latitude
  const lngR = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    coords.push([lng + lngR * Math.cos(theta), lat + latR * Math.sin(theta)]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

const CIRCLE_SOURCE = "radius-circle";

export default function ShopMap({
  shops,
  allShops,
  center,
  radiusKm,
  hasLocation,
  selectedShopId,
  onSelectShop,
  allBrands,
  recenterKey,
}: Props) {
  const [lat, lng] = center;

  const containerRef = useRef<HTMLDivElement>(null);
  // The map lives in state (not a ref) so reading it during render to anchor the
  // popup is render-safe and re-renders the popup once the map exists. `ready`
  // flips on the GL `load` event, after sources/layers are added.
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  // Markers we own, keyed by shop id, so we can update/replace icons in place.
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Tracks the previous radius so we can detect radius-only changes and fitBounds
  // the new ring without affecting camera on location requests.
  const prevRadiusRef = useRef(radiusKm);
  // Always-current lat/lng for the flyTo effect, which intentionally omits
  // lat/lng from its deps so it only fires on explicit recenter requests.
  const latRef = useRef(lat);
  const lngRef = useRef(lng);

  // Latest selection handler, read by marker click closures without re-binding.
  // Synced in an effect (never mutated during render).
  const onSelectRef = useRef(onSelectShop);
  useEffect(() => {
    onSelectRef.current = onSelectShop;
  }, [onSelectShop]);

  // Keep coord refs fresh after every render — consumed by the flyTo effect
  // which intentionally omits lat/lng from its own dep array.
  useEffect(() => {
    latRef.current = lat;
    lngRef.current = lng;
  });

  // Forces a re-render of the popup overlay so it stays pinned during map
  // animation (mirrors the old useMapEvents move/zoom tick).
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);

  // --- Map init (once) -------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(),
      center: [lng, lat], // MapLibre is [lng, lat]
      zoom: 13,
      attributionControl: false,
      pitch: 45,
      bearing: -12,
      // Restrict panning to the UK + nearby waters so users can't scroll to
      // unrelated regions and trigger unnecessary tile fetches.
      maxBounds: [[-10.5, 49.5], [2.2, 61.5]] as [[number, number], [number, number]],
      minZoom: 5,
    });
    setMap(instance);

    instance.on("load", () => {
      instance.addSource(CIRCLE_SOURCE, {
        type: "geojson",
        data: circleGeoJson(lat, lng, radiusKm),
      });
      // Soft fill + dashed outline, painted just under the building layer so
      // pins and buildings still sit on top.
      const before = instance.getLayer("building-flat") ? "building-flat" : undefined;
      // Both ring layers start hidden: on first load there's no location yet, so
      // no ring shows (Issue 4). The recenter effect flips visibility once a
      // location exists.
      instance.addLayer(
        {
          id: "radius-fill",
          type: "fill",
          source: CIRCLE_SOURCE,
          layout: { visibility: "none" },
          paint: { "fill-color": BRAND_HEX, "fill-opacity": 0.07 },
        },
        before,
      );
      instance.addLayer(
        {
          id: "radius-outline",
          type: "line",
          source: CIRCLE_SOURCE,
          layout: { visibility: "none" },
          paint: {
            "line-color": BRAND_HEX,
            "line-width": 1.5,
            "line-dasharray": [6, 5],
          },
        },
        before,
      );
      setReady(true);
    });

    instance.on("move", rerender);
    instance.on("zoom", rerender);

    const markers = markersRef.current;
    return () => {
      instance.remove();
      setMap(null);
      setReady(false);
      markers.clear();
      userMarkerRef.current = null;
    };
    // Intentionally run once: subsequent center/radius changes are handled by
    // the dedicated effects below, not by re-creating the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- "You are here" marker + radius ring ----------------------------------
  // Updates the ring geometry, visibility, and user dot. No camera movement —
  // that lives in the dedicated flyTo effect below so the two concerns stay
  // independent and can't interfere with each other's dep arrays.
  useEffect(() => {
    if (!map || !ready) return;

    const src = map.getSource(CIRCLE_SOURCE) as
      | maplibregl.GeoJSONSource
      | undefined;
    src?.setData(circleGeoJson(lat, lng, radiusKm));

    if (!hasLocation) {
      map.setLayoutProperty("radius-fill", "visibility", "none");
      map.setLayoutProperty("radius-outline", "visibility", "none");
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      prevRadiusRef.current = radiusKm;
      return;
    }

    map.setLayoutProperty("radius-fill", "visibility", "visible");
    map.setLayoutProperty("radius-outline", "visibility", "visible");

    if (!userMarkerRef.current) {
      userMarkerRef.current = new maplibregl.Marker({
        element: userMarkerEl(),
        pitchAlignment: "map",
      })
        .setLngLat([lng, lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([lng, lat]);
    }

    // Radius-only change (no new location request): frame the updated ring.
    // We detect this by comparing to the last radius we saw, not by watching
    // recenterKey — that stays zero on radius changes, which is how we tell the
    // two apart without overlap.
    const radiusChanged = prevRadiusRef.current !== radiusKm;
    prevRadiusRef.current = radiusKm;
    if (radiusChanged) {
      const latR = radiusKm / 110.574;
      const lngR = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
      const pad = 1.2;
      const bounds = new maplibregl.LngLatBounds(
        [lng - lngR * pad, lat - latR * pad],
        [lng + lngR * pad, lat + latR * pad],
      );
      map.fitBounds(bounds, { padding: 40, pitch: 45, bearing: -12, duration: 600 });
    }
  }, [map, lat, lng, radiusKm, hasLocation, ready]);

  // --- Re-centre on explicit location request --------------------------------
  // Fires whenever recenterKey bumps — every search, GPS tap, or repeated "use
  // my location" while panned away. Reads coords from refs (not from the dep
  // array) so this effect is triggered ONLY by explicit user requests and never
  // by radius changes, which don't bump recenterKey.
  useEffect(() => {
    if (!map || !ready || !hasLocation || recenterKey === 0) return;
    map.flyTo({
      center: [lngRef.current, latRef.current],
      zoom: 14.5,
      pitch: 45,
      bearing: -12,
      duration: 1200,
      essential: true,
    });
  }, [map, ready, hasLocation, recenterKey]);

  // --- Shop markers (one per shop, state-coloured) --------------------------
  useEffect(() => {
    if (!map || !ready) return;

    const visibleIds = new Set(shops.map((s) => s.id));
    const markers = markersRef.current;
    const seen = new Set<string>();

    for (const shop of allShops) {
      seen.add(shop.id);
      const isSelected = shop.id === selectedShopId;
      const isOut = !visibleIds.has(shop.id);
      const html = pinSvg(isSelected, isOut);

      let marker = markers.get(shop.id);
      if (!marker) {
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.innerHTML = html;
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", shop.name);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(shop.id);
        });
        marker = new maplibregl.Marker({
          element: el,
          anchor: "bottom", // tip of the teardrop sits on the coordinate
        })
          .setLngLat([shop.lng, shop.lat])
          .addTo(map);
        markers.set(shop.id, marker);
      } else {
        // Update icon only when state changed (cheap string compare).
        const el = marker.getElement();
        if (el.dataset.state !== `${isSelected}-${isOut}`) {
          el.innerHTML = html;
        }
      }
      const el = marker.getElement();
      el.dataset.state = `${isSelected}-${isOut}`;
      el.style.zIndex = isSelected ? "1000" : "0";
    }

    // Remove markers for shops no longer present.
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
  }, [map, allShops, shops, selectedShopId, ready]);

  // --- Popup anchor (re-derived every render, kept pinned via rerender) ------
  const selectedShop =
    allShops.find((s) => s.id === selectedShopId) ?? null;
  let popup: React.ReactNode = null;
  if (selectedShop && map && ready) {
    const pt = map.project([selectedShop.lng, selectedShop.lat]);
    const size = map.getCanvas();
    const height = size.clientHeight;
    // `bottom` measures up from the container's bottom edge; +46px clears the
    // 40px pin plus the popup's little tail.
    popup = (
      <ShopPopup
        shop={selectedShop}
        allBrands={allBrands}
        x={pt.x}
        bottom={height - pt.y + 46}
        onClose={() => onSelectShop(null)}
      />
    );
  }

  return (
    <div className="relative size-full">
      <div ref={containerRef} className="size-full" style={{ background: "#f6efd8" }} />

      <div className="hidden sm:block">{popup}</div>

      <ZoomControls
        onZoomIn={() => map?.zoomIn()}
        onZoomOut={() => map?.zoomOut()}
      />

      {/* Attribution: required by Stadia / OpenMapTiles / OpenStreetMap TOS. */}
      <div className="pointer-events-none absolute right-0 bottom-0 z-[400] max-w-full bg-bg/70 px-2 py-0.5 text-[10px] leading-tight text-muted backdrop-blur-sm">
        <span className="pointer-events-auto">
          &copy;{" "}
          <a
            href="https://stadiamaps.com/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink"
          >
            Stadia Maps
          </a>{" "}
          &copy;{" "}
          <a
            href="https://openmaptiles.org/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink"
          >
            OpenMapTiles
          </a>{" "}
          &copy;{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink"
          >
            OpenStreetMap
          </a>
        </span>
      </div>
    </div>
  );
}

// Custom zoom buttons styled as the design's white card, bottom-right. Plain
// React buttons that call into the map ref — no map context needed.
function ZoomControls({
  onZoomIn,
  onZoomOut,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="absolute right-[18px] bottom-[106px] z-[1000] flex flex-col overflow-hidden rounded-xl border border-border bg-bg shadow-zoom sm:bottom-[40px]">
      <button
        type="button"
        aria-label="Zoom in"
        onClick={onZoomIn}
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
        onClick={onZoomOut}
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
