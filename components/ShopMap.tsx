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
// Markers are custom HTML markers (maplibregl.Marker with our own DOM): every
// shop is a cartoon pouch sachet (one shared /pouch-marker.png) whose CSS
// carries state — brand-blue ring + scale = selected, plain = stocks an active
// brand, greyscaled/faded = filtered out. At low zoom, nearby shops merge into
// round count bubbles via MapLibre's built-in GeoJSON source clustering (the
// supercluster engine bundled inside maplibre-gl — no extra dependency). One
// structural exception: the SELECTED shop is excluded from the clustered
// source and rendered as its own dedicated marker, so its ring can never be
// swallowed into a count bubble at any zoom (see the selection marker effect).
// The shop popup is NOT a MapLibre popup — it's a React overlay positioned from
// the marker's screen point via map.project(), so its styling is wholly ours
// (see <ShopPopup>).
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

// Shop markers are a cartoon pouch sachet image, lying flat on the map. One
// shared asset for every marker — the browser decodes the bitmap once however
// many shops are pinned. The PNG is 120x51; drawn at 44x19 CSS px it has ~2.7x
// density headroom, so it stays crisp on retina screens.
const POUCH_SRC = "/pouch-marker.png";
const POUCH_W = 44;
const POUCH_H = 19; // 44 * (51 / 120) — the asset's aspect ratio

// State is pure CSS on the shared image — no per-state assets, no innerHTML
// swaps, so a state flip costs one style recalc per marker and never re-decodes
// or re-lays-out:
//   selected → scaled up + a brand-blue ring (box-shadow; theme-aware, using
//              the lightened BRAND.dark on the night map like the old pin did)
//   normal   → subtle drop shadow
//   "out"    → greyscaled + faded so filtered-out shops recede
// The pouch artwork itself is theme-invariant; only the ring colour follows
// the theme. transform/opacity get a short transition; filter and box-shadow
// switch instantly (animating them would force continuous repaints).
function styleMarker(
  el: HTMLElement,
  isSelected: boolean,
  isOut: boolean,
  theme: ThemeName,
): void {
  const img = el.firstElementChild as HTMLImageElement;
  img.style.transform = isSelected ? "scale(1.15)" : "scale(1)";
  img.style.opacity = isOut ? "0.55" : "1";
  img.style.filter = isOut
    ? "grayscale(1) drop-shadow(0 1px 1.5px oklch(0 0 0 / .2))"
    : isSelected
      ? "drop-shadow(0 2px 4px oklch(0 0 0 / .35))"
      : "drop-shadow(0 1.5px 2px oklch(0 0 0 / .3))";
  // The pouch is near-rectangular, so a rounded-rect ring hugs it cleanly.
  img.style.boxShadow = isSelected ? `0 0 0 2.5px ${BRAND[theme]}` : "none";
}

// Builds a marker's DOM: a padded hit-target div (the bare pouch is only 19px
// tall — too thin to tap) wrapping the shared image. Symmetric padding keeps
// the pouch centred for the marker's "center" anchor.
function pouchMarkerEl(shopName: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = "cursor:pointer;padding:8px 2px;";
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", shopName);
  const img = document.createElement("img");
  img.src = POUCH_SRC;
  img.alt = "";
  img.draggable = false;
  img.width = POUCH_W;
  img.height = POUCH_H;
  img.style.cssText =
    "display:block;border-radius:6px;transition:transform .15s ease,opacity .15s ease;";
  el.appendChild(img);
  return el;
}

// Builds a cluster bubble's DOM: a round brand-blue badge showing how many
// shops merged at this zoom. Static structure here; count/colour/size live in
// styleCluster so a bubble whose membership changes restyles in place.
function clusterMarkerEl(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText =
    "cursor:pointer;display:grid;place-items:center;border-radius:50%;" +
    "color:#fff;font-weight:700;font-size:13px;line-height:1;" +
    "border:2px solid #fff;user-select:none;" +
    "box-shadow:0 2px 6px oklch(0 0 0 / .3);" +
    "transition:opacity .15s ease;";
  el.setAttribute("role", "button");
  return el;
}

// Same in-place CSS state pattern as styleMarker: brand blue when at least one
// member shop matches the active brand filter, greyed/faded (like an "out"
// pouch) when every member is filtered out. Size grows slightly with count,
// capped so big clusters never dwarf the pouches.
function styleCluster(
  el: HTMLElement,
  count: number,
  active: boolean,
  theme: ThemeName,
): void {
  const size = Math.min(44, 30 + count * 2);
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.background = active ? BRAND[theme] : "oklch(0.58 0 0)";
  el.style.opacity = active ? "1" : "0.65";
  el.textContent = String(count);
  el.setAttribute("aria-label", `Cluster of ${count} shops`);
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

// Degrees of latitude/longitude spanned by `radiusKm` at the given latitude —
// the small-circle approximation shared by the ring polygon and its bounding
// box (single source of truth for the deg-per-km constants).
function radiusDegrees(lat: number, radiusKm: number) {
  return {
    latR: radiusKm / 110.574, // deg per km, latitude
    lngR: radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180)),
  };
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
  const { latR, lngR } = radiusDegrees(lat, radiusKm);
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

// Bounding box of the radius ring with a little breathing room (×1.2), used by
// every "frame the search area" camera move (recenter on mobile, radius change
// everywhere).
function ringBounds(
  lat: number,
  lng: number,
  radiusKm: number,
): maplibregl.LngLatBounds {
  const pad = 1.2;
  const { latR, lngR } = radiusDegrees(lat, radiusKm);
  return new maplibregl.LngLatBounds(
    [lng - lngR * pad, lat - latR * pad],
    [lng + lngR * pad, lat + latR * pad],
  );
}

// Per-call camera padding for framing the search area. On mobile the bottom
// sheet snaps to half after every fetch and covers the bottom of the map, so
// bottom padding reserves that strip (sheet height + a small margin) and the
// framed area lands fully in the visible map above it. Desktop (sm+) has no
// overlaying sheet, so padding stays uniform. Always passed per-call in the
// fitBounds options — never via map.setPadding(), which would persist and skew
// every later camera op and the popup's map.project() math.
function framePadding(): maplibregl.PaddingOptions {
  const base = 40;
  const bottom = window.matchMedia("(min-width: 640px)").matches // Tailwind sm
    ? base
    : sheetHalfHeightPx() + 24;
  return { top: base, bottom, left: base, right: base };
}

const CIRCLE_SOURCE = "radius-circle";
const SHOPS_SOURCE = "shops";
// 60px cluster radius: the pouch is a 44px-wide landscape sprite, so anything
// tighter lets two pouches overlap before they merge. Past z14 clustering
// stops entirely — at street level every shop deserves its own pin.
const CLUSTER_RADIUS = 60;
const CLUSTER_MAX_ZOOM = 14;

// (Re)adds the clustered shop source to a freshly-loaded style — same
// lifecycle as addRadiusLayers: first 'load', then again after every theme
// setStyle() swap (which wipes all custom sources/layers; DOM markers
// survive). Clustering is MapLibre's built-in supercluster integration.
// activeCount aggregates how many member shops match the brand filter
// (out=false), so a bubble can grey itself when its whole cluster is filtered
// out. Starts empty — the data effect owns setData.
function addShopsSource(map: maplibregl.Map) {
  map.addSource(SHOPS_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterRadius: CLUSTER_RADIUS,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
    clusterProperties: {
      activeCount: ["+", ["case", ["get", "out"], 0, 1]],
    },
  });
  // querySourceFeatures only surfaces tiles that some layer is rendering, so
  // the source needs at least one layer attached. Fully transparent circles
  // keep it invisible while keeping the viewport's tiles loaded.
  map.addLayer({
    id: "shops-anchor",
    type: "circle",
    source: SHOPS_SOURCE,
    paint: { "circle-radius": 2, "circle-opacity": 0 },
  });
}

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

  // Markers we own — keyed by shop id for pouches, `cluster-${cluster_id}` for
  // count bubbles — so the sync below can update/replace them in place.
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  // The selected shop's dedicated pouch marker (see the selection marker
  // effect). Lives OUTSIDE markersRef so syncMarkers can never reconcile it
  // away; the id rides along so a selection change rebuilds the element (its
  // click closure is per-shop) while theme/filter flips restyle in place.
  const selectedMarkerRef = useRef<{
    id: string;
    marker: maplibregl.Marker;
  } | null>(null);

  // Always-current shop/filter/selection/theme state for syncMarkers, which is
  // also invoked from map event listeners (moveend etc.) and so can't read
  // props directly without re-binding listeners on every change.
  const shopsByIdRef = useRef<Map<string, ShopWithListings>>(new Map());
  const visibleIdsRef = useRef<Set<string>>(new Set());
  const selectedIdRef = useRef(selectedShopId);
  const themeRef = useRef(theme);

  // Tracks the previous radius so we can detect radius-only changes and fitBounds
  // the new ring without affecting camera on location requests.
  const prevRadiusRef = useRef(radiusKm);
  // Always-current lat/lng/radius for the recenter effect, which intentionally
  // omits them from its deps so it only fires on explicit recenter requests.
  const latRef = useRef(lat);
  const lngRef = useRef(lng);
  const radiusKmRef = useRef(radiusKm);

  // Latest selection handler, read by marker click closures without re-binding.
  // Synced in an effect (never mutated during render).
  const onSelectRef = useRef(onSelectShop);
  useEffect(() => {
    onSelectRef.current = onSelectShop;
  }, [onSelectShop]);

  // Keep coord/radius refs fresh after every render — consumed by the recenter
  // effect, which intentionally omits them from its own dep array.
  useEffect(() => {
    latRef.current = lat;
    lngRef.current = lng;
    radiusKmRef.current = radiusKm;
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
      // the closest fit on wide viewports. The recenterKey effect below
      // restores the tilted close-up (pitch 45 / bearing -12) once the user
      // picks a location — fixed zoom 14.5 on desktop, radius-fit on mobile.
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
      addShopsSource(instance);
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
      selectedMarkerRef.current = null;
    };
    // Intentionally run once: subsequent center/radius/hasLocation changes are
    // handled by the dedicated effects below, not by re-creating the map.
    // hasLocation is read here only for the initial camera (always false on
    // first mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Theme swap ------------------------------------------------------------
  // setStyle() replaces every style-owned source and layer (DOM markers
  // survive), so after the new style loads we re-add the radius layers + the
  // clustered shop source and bump styleEpoch, which re-runs the ring and
  // shop-data effects to restore data + visibility.
  const prevDarkRef = useRef(dark);
  const [styleEpoch, setStyleEpoch] = useState(0);
  useEffect(() => {
    if (!map || !ready) return;
    if (prevDarkRef.current === dark) return; // mount or no-op
    prevDarkRef.current = dark;
    map.setStyle(buildStyle(dark));
    map.once("style.load", () => {
      addRadiusLayers(map, dark ? "dark" : "light");
      addShopsSource(map);
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
      // framePadding keeps the new ring above the mobile bottom sheet, which
      // is at half height while the user is changing the radius from it.
      map.fitBounds(ringBounds(lat, lng, radiusKm), {
        padding: framePadding(),
        pitch: 45,
        bearing: -12,
        duration: 600,
      });
    }
    // styleEpoch re-runs this after a theme swap re-adds the (empty, hidden)
    // ring layers; theme keeps the user dot's fill current.
  }, [map, lat, lng, radiusKm, hasLocation, ready, styleEpoch, theme]);

  // --- Re-centre on explicit location request --------------------------------
  // Fires whenever recenterKey bumps — every search, GPS tap, or repeated "use
  // my location" while panned away. Reads coords/radius from refs (not from the
  // dep array) so this effect is triggered ONLY by explicit user requests and
  // never by radius changes, which don't bump recenterKey.
  //
  // Mobile (< sm): the bottom sheet snaps to half right after the fetch, so a
  // blind centre-on-user would leave nearby pins hidden behind it. Instead, fit
  // the radius ring into the strip of map that stays visible above the sheet
  // (framePadding's asymmetric bottom padding), keeping the signature tilt.
  // Desktop (sm+): the left drawer doesn't overlay the map the same way, so
  // keep the classic fixed-zoom flyTo onto the user.
  useEffect(() => {
    if (!map || !ready || !hasLocation || recenterKey === 0) return;
    if (window.matchMedia("(min-width: 640px)").matches) {
      // Tailwind sm+
      map.flyTo({
        center: [lngRef.current, latRef.current],
        zoom: 14.5,
        pitch: 45,
        bearing: -12,
        duration: 1200,
        essential: true,
      });
      return;
    }
    map.fitBounds(ringBounds(latRef.current, lngRef.current, radiusKmRef.current), {
      padding: framePadding(),
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
  // (sm+) anchors a popup over the pin instead, so it only moves when the shop
  // sits outside the viewport (off-screen list selection). No zoom change in
  // either case: the selected shop is excluded from clustering and rendered as
  // its own dedicated marker, so there is never a cluster to break apart for
  // the ring to show. (An earlier version eased to the covering cluster's
  // expansion zoom here — async worker round-trips that raced the post-ease
  // recluster; the structural exclusion made it dead weight.)
  useEffect(() => {
    if (!map || !ready || selectedShopId === null) return;
    const shop = allShops.find((s) => s.id === selectedShopId);
    if (shop === undefined) return;
    if (!window.matchMedia("(min-width: 640px)").matches) {
      // < sm
      map.easeTo({
        center: [shop.lng, shop.lat],
        offset: [0, -sheetHalfHeightPx() / 2],
        duration: 600,
      });
    } else if (!map.getBounds().contains([shop.lng, shop.lat])) {
      map.easeTo({ center: [shop.lng, shop.lat], duration: 600 });
    }
  }, [map, ready, selectedShopId, allShops]);

  // --- Shop markers (clustered source → reconciled DOM pouches/bubbles) ------
  // The source of truth is the clustered GeoJSON source above: one Point per
  // shop, and MapLibre's bundled supercluster engine decides — per zoom — which
  // shops render individually and which merge into count bubbles. We don't use
  // symbol/circle layers for the visuals because the pouch sprite and the shop
  // popup are deliberately DOM/React (CSS state flips, real <img>, our own
  // styling); instead, syncMarkers reads the source's current render set via
  // querySourceFeatures and reconciles a keyed Map of DOM markers against it:
  //   leaf feature    → the pouch marker (key = shop id; same pouchMarkerEl /
  //                     styleMarker / dataset.state machinery as ever)
  //   cluster feature → a count bubble (key = `cluster-${cluster_id}`); click
  //                     eases to the cluster's expansion zoom
  // Markers whose keys persist are restyled in place (cheap dataset.state
  // compare); only vanished keys are removed and new keys created — never a
  // full teardown per frame. Cluster composition only changes with zoom or
  // data, so syncing on moveend/zoomend/sourcedata (not every render frame)
  // is sufficient and keeps pans free of marker churn.
  //
  // The SELECTED shop never appears here: it's excluded from the source data
  // (data effect below) and drawn by the dedicated selection marker, which is
  // keyed outside markersRef so the removal pass can't touch it. The skip
  // guard below covers the gap where stale tiles still surface the selected
  // shop as a leaf before the post-setData recluster lands.
  const syncMarkers = useCallback(() => {
    if (!map || map.getSource(SHOPS_SOURCE) === undefined) return;

    const markers = markersRef.current;
    const seen = new Set<string>();
    const theme = themeRef.current;

    for (const f of map.querySourceFeatures(SHOPS_SOURCE)) {
      if (f.geometry.type !== "Point") continue;
      const props = f.properties as Record<string, unknown>;
      const isCluster = props.cluster === true;
      const key = isCluster ? `cluster-${props.cluster_id}` : String(props.id);
      // Tiles overlap at their edges, so querySourceFeatures returns dupes.
      if (seen.has(key)) continue;
      seen.add(key);

      if (isCluster) {
        const clusterId = props.cluster_id as number;
        const count = props.point_count as number;
        const active = (props.activeCount as number) > 0;
        const coords = f.geometry.coordinates as [number, number];
        const state = `${count}-${active}-${theme}`;
        const marker = markers.get(key);
        if (marker === undefined) {
          const el = clusterMarkerEl();
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            const src = map.getSource(SHOPS_SOURCE) as
              | maplibregl.GeoJSONSource
              | undefined;
            src?.getClusterExpansionZoom(clusterId).then((zoom) => {
              map.easeTo({ center: coords, zoom: zoom + 0.5, duration: 500 });
            });
          });
          styleCluster(el, count, active, theme);
          el.dataset.state = state;
          markers.set(
            key,
            new maplibregl.Marker({ element: el, anchor: "center" })
              .setLngLat(coords)
              .addTo(map),
          );
        } else {
          const el = marker.getElement();
          if (el.dataset.state !== state) {
            styleCluster(el, count, active, theme);
            el.dataset.state = state;
          }
        }
      } else {
        const id = String(props.id);
        // The selected shop is owned by the dedicated selection marker; a
        // stale tile can still hand it back as a leaf until the recluster
        // that excludes it lands. Skipping it here both avoids a duplicate
        // pouch AND lets the removal pass below delete its old leaf marker
        // the moment a selection happens.
        if (id === selectedIdRef.current) continue;
        const shop = shopsByIdRef.current.get(id);
        if (shop === undefined) continue;
        const isOut = !visibleIdsRef.current.has(id);
        const state = `${isOut}-${theme}`;
        const marker = markers.get(id);
        if (marker === undefined) {
          const el = pouchMarkerEl(shop.name);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onSelectRef.current(id);
          });
          styleMarker(el, false, isOut, theme);
          el.dataset.state = state;
          markers.set(
            id,
            new maplibregl.Marker({
              element: el,
              // The pouch lies ON the spot rather than pointing at it, so
              // centre it on the coordinate (the old teardrop was
              // bottom-anchored).
              anchor: "center",
            })
              // The shop's true coordinate, not the tile-quantised geometry
              // querySourceFeatures hands back.
              .setLngLat([shop.lng, shop.lat])
              .addTo(map),
          );
        } else {
          // Restyle only when state changed (cheap string compare; theme is
          // part of the state so a theme toggle re-tints in place).
          const el = marker.getElement();
          if (el.dataset.state !== state) {
            styleMarker(el, false, isOut, theme);
            el.dataset.state = state;
          }
        }
      }
    }

    // Remove markers whose keys vanished from the render set (shops gone,
    // clusters split/merged at the new zoom).
    for (const [key, marker] of markers) {
      if (!seen.has(key)) {
        marker.remove();
        markers.delete(key);
      }
    }
  }, [map]);

  // Re-sync when the camera settles or the source delivers fresh cluster tiles
  // (covers the async recluster after every setData).
  useEffect(() => {
    if (!map || !ready) return;
    const onSourceData = (e: maplibregl.MapSourceDataEvent) => {
      if (e.sourceId === SHOPS_SOURCE && e.isSourceLoaded) syncMarkers();
    };
    map.on("moveend", syncMarkers);
    map.on("zoomend", syncMarkers);
    map.on("sourcedata", onSourceData);
    return () => {
      map.off("moveend", syncMarkers);
      map.off("zoomend", syncMarkers);
      map.off("sourcedata", onSourceData);
    };
  }, [map, ready, syncMarkers]);

  // Push shop/filter/selection changes into the source. `out` rides along per
  // feature so clusters can aggregate activeCount worker-side; the recluster
  // lands via the sourcedata listener above. styleEpoch re-runs this after a
  // theme swap recreates the (empty) source.
  //
  // The selected shop is filtered OUT of the source: a selected shop must
  // never be clustered (its ring would vanish into a count bubble), so it's
  // drawn by the dedicated selection marker below instead. Side effect: while
  // selected, cluster counts and activeCount simply don't include that shop —
  // acceptable, since its ringed pouch stands beside any bubble its former
  // neighbours still form.
  useEffect(() => {
    if (!map || !ready) return;
    shopsByIdRef.current = new Map(allShops.map((s) => [s.id, s]));
    visibleIdsRef.current = new Set(shops.map((s) => s.id));
    // Keep the ref in lockstep with the data we're about to push, so the
    // syncMarkers call below already skips the newly selected shop's leaf.
    selectedIdRef.current = selectedShopId;
    const src = map.getSource(SHOPS_SOURCE) as
      | maplibregl.GeoJSONSource
      | undefined;
    // Mid theme-swap the source is gone; the styleEpoch bump re-runs this.
    if (src === undefined) return;
    src.setData({
      type: "FeatureCollection",
      features: allShops
        .filter((s) => s.id !== selectedShopId)
        .map((s) => ({
          type: "Feature" as const,
          properties: { id: s.id, out: !visibleIdsRef.current.has(s.id) },
          geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
        })),
    });
    // Restyle existing leaf markers for the new filter state right away —
    // the bubbles catch up when the reclustered tiles arrive.
    syncMarkers();
  }, [map, ready, allShops, shops, selectedShopId, styleEpoch, syncMarkers]);

  // --- Dedicated marker for the selected shop ---------------------------------
  // The structural guarantee that a selected shop is never clustered: it's
  // excluded from the clustered source (data effect above) and drawn by this
  // always-present marker instead — same ownership pattern as the user-location
  // dot. Created on select, restyled in place when the theme or brand filter
  // changes, rebuilt when the selection moves to another shop (the click
  // closure is per-shop), removed on deselect. Being plain DOM it survives
  // theme setStyle() swaps untouched; the `theme` dep re-tints its ring.
  useEffect(() => {
    if (!map || !ready) return;
    const shop =
      selectedShopId === null
        ? undefined
        : allShops.find((s) => s.id === selectedShopId);
    const current = selectedMarkerRef.current;
    if (shop === undefined) {
      // Deselected (or selection fell out of radius): the data effect has
      // already restored the shop to the source, so a leaf or bubble takes
      // over once the recluster lands.
      current?.marker.remove();
      selectedMarkerRef.current = null;
      return;
    }
    // The selection ring doesn't exempt the shop from the brand filter — a
    // selected-but-filtered-out shop reads as ringed AND greyed, as before.
    const isOut = !shops.some((s) => s.id === shop.id);
    if (current === null || current.id !== shop.id) {
      current?.marker.remove();
      const el = pouchMarkerEl(shop.name);
      // Already selected — swallow the tap so it can't bubble to the map,
      // matching the old no-op re-select behaviour.
      el.addEventListener("click", (e) => e.stopPropagation());
      styleMarker(el, true, isOut, theme);
      el.style.zIndex = "1000"; // above leaves and bubbles, like before
      selectedMarkerRef.current = {
        id: shop.id,
        marker: new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([shop.lng, shop.lat])
          .addTo(map),
      };
    } else {
      styleMarker(current.marker.getElement(), true, isOut, theme);
    }
  }, [map, ready, selectedShopId, allShops, shops, theme]);

  // Theme flips don't touch the source data — update the refs the sync's
  // event-listener invocations read, then restyle the marker set in place.
  useEffect(() => {
    themeRef.current = theme;
    syncMarkers();
  }, [theme, syncMarkers]);

  // --- Popup anchor (re-derived every render, kept pinned via rerender) ------
  const selectedShop =
    allShops.find((s) => s.id === selectedShopId) ?? null;
  let popup: React.ReactNode = null;
  if (selectedShop && map && ready) {
    const pt = map.project([selectedShop.lng, selectedShop.lat]);
    const size = map.getCanvas();
    const height = size.clientHeight;
    // `bottom` measures up from the container's bottom edge. The marker is
    // centre-anchored, so the selected pouch extends ~13px above the coordinate
    // (19px ÷ 2, × 1.15 selected scale, + the 2.5px ring); +22px clears that
    // plus the popup's little tail. (The old bottom-anchored teardrop needed
    // +46 to clear its full 40px height.)
    popup = (
      <ShopPopup
        shop={selectedShop}
        allBrands={allBrands}
        x={pt.x}
        bottom={height - pt.y + 22}
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
