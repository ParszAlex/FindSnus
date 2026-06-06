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
import { buildStyle, MAP_BG } from "@/lib/mapStyle";
import { sheetHalfHeightPx } from "./MobileBottomSheet";
import { useTheme } from "./ThemeProvider";
import ShopPopup from "./ShopPopup";

// The brand blue per theme, as literals — MapLibre paints its own GL canvas/DOM
// markers, so it can't read our Tailwind/CSS custom properties. The HTML markers
// (real DOM/CSS) take the oklch; the GL paint validator only accepts legacy CSS
// colours, so the radius layers use the sRGB hex equivalents. The dark values
// mirror the lightened --color-primary in globals.css's .dark block.
const BRAND = {
  light: "oklch(0.4 0.14 255)",
  dark: "oklch(0.64 0.105 255)",
} as const;
const BRAND_HEX = {
  light: "#004590", // == oklch(0.4 0.14 255) in sRGB
  dark: "#5a8fd0", // ≈ oklch(0.64 0.105 255) in sRGB
} as const;

type ThemeName = keyof typeof BRAND;

type Props = {
  /** Shops matching the active brand filter (drives marker fill + popup data). */
  shops: ShopWithListings[];
  /** Every shop in radius — all are pinned; non-matching ones render greyed. */
  allShops: ShopWithListings[];
  center: [number, number];
  radiusKm: number;
  /** False until the user picks a location: open on the whole-UK overview, hide
   *  the ring + user dot, and don't auto-pan. Once true, the ring + dot appear
   *  and the map flies in. */
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

// A teardrop pin whose fills encode state, per theme. In dark mode the active
// pin stays near-white (the brightest thing on the night map, as intended),
// selected takes the lightened dark brand blue, and filtered-out pins recede
// into muted slate instead of washing out white-on-dark.
function pinSvg(isSelected: boolean, isOut: boolean, theme: ThemeName): string {
  const brand = BRAND[theme];
  const body = isSelected
    ? brand
    : isOut
      ? theme === "dark"
        ? "#3a4458"
        : "oklch(0.985 0 0)"
      : theme === "dark"
        ? "#e8ebf2"
        : "white";
  const stroke = isSelected
    ? brand
    : theme === "dark"
      ? "#262e3d"
      : "oklch(0.91 0 0)";
  const dot = isSelected
    ? theme === "dark"
      ? "#1b2029"
      : "white"
    : isOut
      ? theme === "dark"
        ? "#9aa2b3"
        : "oklch(0.46 0 0)"
      : BRAND.light;
  return `<svg width="30" height="40" viewBox="0 0 30 40" style="display:block;filter:drop-shadow(0 3px 4px oklch(0 0 0 / .28))"><path fill="${body}" stroke="${stroke}" stroke-width="1" d="M15 1C7.3 1 1 7.1 1 14.6 1 24 15 39 15 39s14-15 14-24.4C29 7.1 22.7 1 15 1Z"/><circle fill="${dot}" cx="15" cy="14.5" r="5.4"/></svg>`;
}

// "You are here": a solid blue dot with a white ring and a looping pulse. The
// pulse lives in globals.css (.user-ping) and follows --color-primary, so only
// the dot fill needs the theme; the ring effect re-tints it on theme change.
function userMarkerEl(theme: ThemeName): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `width:18px;height:18px;border-radius:50%;background:${BRAND[theme]};border:3px solid white;box-shadow:0 0 0 1px oklch(0.4 0.14 255 / .35), 0 2px 6px oklch(0 0 0 / .25);position:relative;`;
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

// (Re)adds the radius source + ring layers to a freshly-loaded style. Called on
// first map load and again after every theme setStyle() swap, which wipes all
// custom sources and layers (DOM markers survive). Starts hidden and empty —
// the ring effect owns data and visibility and re-runs on every styleEpoch.
function addRadiusLayers(map: maplibregl.Map, theme: ThemeName) {
  map.addSource(CIRCLE_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  // Soft fill + dashed outline, painted just under the building layer so
  // pins and buildings still sit on top.
  const before = map.getLayer("building-flat") ? "building-flat" : undefined;
  map.addLayer(
    {
      id: "radius-fill",
      type: "fill",
      source: CIRCLE_SOURCE,
      layout: { visibility: "none" },
      paint: {
        "fill-color": BRAND_HEX[theme],
        // The night land is close in lightness to the blue, so the dark fill
        // needs a touch more opacity to read at all.
        "fill-opacity": theme === "dark" ? 0.12 : 0.07,
      },
    },
    before,
  );
  map.addLayer(
    {
      id: "radius-outline",
      type: "line",
      source: CIRCLE_SOURCE,
      layout: { visibility: "none" },
      paint: {
        "line-color": BRAND_HEX[theme],
        "line-width": 1.5,
        "line-dasharray": [6, 5],
      },
    },
    before,
  );
}

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
  const { dark } = useTheme();
  const theme: ThemeName = dark ? "dark" : "light";

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
      style: buildStyle(dark),
      // No location yet (always the case on first mount — Locator initialises
      // hasLocation false): open on a flat whole-UK overview; the tilted
      // close-up view only suits a chosen locality. maxBounds clamps this to
      // the closest fit on wide viewports. The recenterKey flyTo below restores
      // zoom 14.5 / pitch 45 / bearing -12 once the user picks a location.
      ...(hasLocation
        ? { center: [lng, lat] as [number, number], zoom: 13, pitch: 45, bearing: -12 } // MapLibre is [lng, lat]
        : { center: [-3.5, 54.8] as [number, number], zoom: 5, pitch: 0, bearing: 0 }),
      attributionControl: false,
      // Restrict panning to the UK + nearby waters so users can't scroll to
      // unrelated regions and trigger unnecessary tile fetches.
      maxBounds: [[-10.5, 49.5], [2.2, 61.5]] as [[number, number], [number, number]],
      minZoom: 5,
    });
    setMap(instance);

    instance.on("load", () => {
      // Both ring layers start hidden: on first load there's no location yet,
      // so no ring shows. The ring effect below owns data and visibility.
      addRadiusLayers(instance, dark ? "dark" : "light");
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
    // Intentionally run once: subsequent center/radius/hasLocation changes are
    // handled by the dedicated effects below, not by re-creating the map.
    // hasLocation is read here only for the initial camera (always false on
    // first mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Theme swap ------------------------------------------------------------
  // setStyle() replaces every style-owned source and layer (DOM markers
  // survive), so after the new style loads we re-add the radius layers and bump
  // styleEpoch, which re-runs the ring effect to restore data + visibility.
  const prevDarkRef = useRef(dark);
  const [styleEpoch, setStyleEpoch] = useState(0);
  useEffect(() => {
    if (!map || !ready) return;
    if (prevDarkRef.current === dark) return; // mount or no-op
    prevDarkRef.current = dark;
    map.setStyle(buildStyle(dark));
    map.once("style.load", () => {
      addRadiusLayers(map, dark ? "dark" : "light");
      setStyleEpoch((e) => e + 1);
    });
  }, [map, ready, dark]);

  // --- "You are here" marker + radius ring ----------------------------------
  // Updates the ring geometry, visibility, and user dot. No camera movement —
  // that lives in the dedicated flyTo effect below so the two concerns stay
  // independent and can't interfere with each other's dep arrays.
  useEffect(() => {
    if (!map || !ready) return;

    const src = map.getSource(CIRCLE_SOURCE) as
      | maplibregl.GeoJSONSource
      | undefined;
    // Mid theme-swap the old style (and our layers) are gone and the new ones
    // aren't in yet; the styleEpoch bump re-runs this effect once they are.
    if (src === undefined || map.getLayer("radius-outline") === undefined) {
      return;
    }
    src.setData(circleGeoJson(lat, lng, radiusKm));

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
        element: userMarkerEl(theme),
        pitchAlignment: "map",
      })
        .setLngLat([lng, lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([lng, lat]);
      // Keep the dot on the current theme's primary (cheap idempotent set).
      userMarkerRef.current.getElement().style.background = BRAND[theme];
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
    // styleEpoch re-runs this after a theme swap re-adds the (empty, hidden)
    // ring layers; theme keeps the user dot's fill current.
  }, [map, lat, lng, radiusKm, hasLocation, ready, styleEpoch, theme]);

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

  // --- Centre the selected shop above the mobile sheet -----------------------
  // A selection (list row or pin tap) snaps the mobile sheet to half, so ease
  // the camera until the pin sits centred in the strip of map left visible
  // above it — offset shifts the target up by half the sheet's height. Desktop
  // (sm+) anchors a popup over the pin instead, so no camera move there.
  useEffect(() => {
    if (!map || !ready || selectedShopId === null) return;
    if (window.matchMedia("(min-width: 640px)").matches) return; // Tailwind sm
    const shop = allShops.find((s) => s.id === selectedShopId);
    if (shop === undefined) return;
    map.easeTo({
      center: [shop.lng, shop.lat],
      offset: [0, -sheetHalfHeightPx() / 2],
      duration: 600,
    });
  }, [map, ready, selectedShopId, allShops]);

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
      const html = pinSvg(isSelected, isOut, theme);

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
        // Update icon only when state changed (cheap string compare; theme is
        // part of the state so every pin repaints on a theme toggle).
        const el = marker.getElement();
        if (el.dataset.state !== `${isSelected}-${isOut}-${theme}`) {
          el.innerHTML = html;
        }
      }
      const el = marker.getElement();
      el.dataset.state = `${isSelected}-${isOut}-${theme}`;
      el.style.zIndex = isSelected ? "1000" : "0";
    }

    // Remove markers for shops no longer present.
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
  }, [map, allShops, shops, selectedShopId, ready, theme]);

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
      <div
        ref={containerRef}
        className="size-full"
        // The theme's land colour shows during GL init / style swap so the
        // canvas never flashes a mismatched shade.
        style={{ background: dark ? MAP_BG.dark : MAP_BG.light }}
      />

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
