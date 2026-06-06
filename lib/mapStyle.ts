// The cartoon/plastic basemap style for the locator, built by hand on Stadia's
// OpenMapTiles vector source. We don't use Stadia's stock style JSON — we want a
// glossy, saturated-but-tasteful "polished toy map" look that still reads as a
// clean UK store locator under the brand-coloured pins. So this is a custom
// MapLibre StyleSpecification: same vector source, our own layer paint.
//
// Endpoints (verified against https://docs.stadiamaps.com/, June 2026):
//   source    https://tiles.stadiamaps.com/data/openmaptiles.json?api_key=…
//   glyphs    https://tiles.stadiamaps.com/fonts/{fontstack}/{range}.pbf
//   sprite    https://tiles.stadiamaps.com/styles/alidade-smooth/sprite
// The key is the client-safe, domain-restricted NEXT_PUBLIC_STADIA_API_KEY.
// If it's missing we fall back to a free no-key raster style (see buildStyle)
// so the map never renders a blank grey box.

import type { StyleSpecification } from "maplibre-gl";

// Stadia ships these font stacks with its glyph server; using any other name
// 404s and labels vanish. Keep to these three weights.
const FONT_REGULAR = ["Stadia Regular"];
const FONT_SEMIBOLD = ["Stadia Semibold"];
const FONT_BOLD = ["Stadia Bold"];

// The cartoon palettes — one per theme. Soft, slightly desaturated colours
// with enough pop to feel "plastic" but muted enough that the brand-blue pins
// stay the loudest thing on the map. All sRGB hex (MapLibre paints its own GL
// canvas and can't read our CSS custom properties).
const LIGHT = {
  water: "#74d2f7", // bright pool blue
  waterDeep: "#3fbef0",
  land: "#f6efd8", // warm cream paper
  green: "#9be86f", // park / wood — punchy mint
  greenDark: "#7ad94f",
  grass: "#aef07e",
  sand: "#f7df9a",
  residential: "#f0e7c8",
  road: "#ffffff",
  roadCasing: "#ecc8a0",
  roadMinor: "#fffaf0",
  motorway: "#ffbf40", // candy-orange trunk roads
  motorwayCasing: "#f59415",
  building: "#f0dcc0", // warm cream (flat + short buildings)
  buildingShade: "#e0c098",
  // Height-graded "toy model" buildings: cream → peach → terracotta as they
  // get taller. Warm hues complement the land and keep the blue pins loudest.
  buildingLow: "#f3e3c8",
  buildingMid: "#f2c79a",
  buildingTall: "#e89a78",
  buildingXTall: "#df8060",
  label: "#5a5346",
  labelHalo: "#fffdf7",
  waterLabel: "#2f86b8",
  boundary: "#e89ac0",
};

// Night variant: the same toy city after dark. Deep desaturated slate land,
// ink-blue water, pine greens, roads as faintly lit ribbons and a muted amber
// glow on motorways. Buildings get LIGHTER as they get taller (lit windows),
// inverting the light theme's warm ramp. Calm and legible — deliberately not
// the neon "vape shop at night" look the brand bans.
const DARK: typeof LIGHT = {
  water: "#27567c",
  waterDeep: "#1d4364",
  land: "#232a39", // deep slate — also the dark UI's html/theme colour
  green: "#2f5444",
  greenDark: "#28493c",
  grass: "#35604b",
  sand: "#4d4738",
  residential: "#28303f",
  road: "#46526b", // lit-street ribbons, lighter than the land
  roadCasing: "#161c28",
  roadMinor: "#3a4458",
  motorway: "#c4913f", // muted amber — warm sodium-lamp arterials
  motorwayCasing: "#7d5a22",
  building: "#303849",
  buildingShade: "#1a202c",
  buildingLow: "#323a4d",
  buildingMid: "#3e4860",
  buildingTall: "#4f5a78",
  buildingXTall: "#626e92",
  label: "#b6bdcc",
  labelHalo: "#1b2029",
  waterLabel: "#7fb6d9",
  boundary: "#8a6d9c",
};

// The land colours double as the page background behind the map canvas (html
// background, theme-color meta, map container) so safe-area strips and tile
// load-in always blend with the basemap. Single source of truth for all three.
export const MAP_BG = { light: LIGHT.land, dark: DARK.land } as const;

const STADIA_SOURCE = (key: string) =>
  `https://tiles.stadiamaps.com/data/openmaptiles.json?api_key=${key}`;

/**
 * A hand-built cartoonish MapLibre style on Stadia's OpenMapTiles vector tiles.
 * Includes 3D fill-extrusion buildings (render_height) at high zoom for the
 * "plastic toy" look. Pass the Stadia API key and theme; returns a full
 * StyleSpecification painted from the matching palette.
 */
export function cartoonStyle(apiKey: string, dark = false): StyleSpecification {
  const C = dark ? DARK : LIGHT;
  return {
    version: 8,
    name: "findsnus-cartoon",
    glyphs: "https://tiles.stadiamaps.com/fonts/{fontstack}/{range}.pbf",
    sprite: "https://tiles.stadiamaps.com/styles/alidade-smooth/sprite",
    sources: {
      openmaptiles: {
        type: "vector",
        url: STADIA_SOURCE(apiKey),
      },
    },
    // A soft warm sky behind everything, so the globe edges never flash grey.
    light: { anchor: "viewport", intensity: 0.45 },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": C.land },
      },

      // --- Landcover / land use: big soft colour blobs --------------------
      {
        id: "landuse-residential",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landuse",
        filter: ["==", ["get", "class"], "residential"],
        paint: { "fill-color": C.residential, "fill-opacity": 0.9 },
      },
      {
        id: "landcover-wood",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["wood", "forest"]]],
        paint: { "fill-color": C.green, "fill-opacity": 0.95 },
      },
      {
        id: "landcover-grass",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["grass", "meadow"]]],
        paint: { "fill-color": C.grass, "fill-opacity": 0.95 },
      },
      {
        id: "landuse-park",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "park",
        paint: { "fill-color": C.greenDark, "fill-opacity": 0.85 },
      },
      {
        id: "landcover-sand",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "sand"],
        paint: { "fill-color": C.sand },
      },

      // --- Water: glossy, with a slightly deeper tint by zoom -------------
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        filter: ["!=", ["get", "intermittent"], 1],
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            C.waterDeep,
            12,
            C.water,
          ],
        },
      },
      {
        id: "waterway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "waterway",
        paint: {
          "line-color": C.waterDeep,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 16, 3],
        },
      },

      // --- Roads: chunky white ribbons with soft casings -----------------
      {
        id: "road-casing",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["motorway", "trunk", "primary", "secondary"]],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": [
            "match",
            ["get", "class"],
            "motorway",
            C.motorwayCasing,
            "trunk",
            C.motorwayCasing,
            C.roadCasing,
          ],
          "line-width": [
            "interpolate",
            ["exponential", 1.5],
            ["zoom"],
            8,
            2,
            14,
            10,
            18,
            26,
          ],
        },
      },
      {
        id: "road-minor",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 12,
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["minor", "service", "residential"]],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": C.roadMinor,
          "line-width": [
            "interpolate",
            ["exponential", 1.5],
            ["zoom"],
            12,
            1,
            18,
            12,
          ],
        },
      },
      {
        id: "road-fill",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["motorway", "trunk", "primary", "secondary"]],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": [
            "match",
            ["get", "class"],
            "motorway",
            C.motorway,
            "trunk",
            C.motorway,
            C.road,
          ],
          "line-width": [
            "interpolate",
            ["exponential", 1.5],
            ["zoom"],
            8,
            1,
            14,
            7,
            18,
            20,
          ],
        },
      },

      // --- Boundaries: a soft dashed candy line --------------------------
      {
        id: "boundary",
        type: "line",
        source: "openmaptiles",
        "source-layer": "boundary",
        filter: ["<=", ["get", "admin_level"], 4],
        layout: { "line-join": "round" },
        paint: {
          "line-color": C.boundary,
          "line-dasharray": [3, 2],
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 12, 2],
          "line-opacity": 0.7,
        },
      },

      // --- 3D plastic buildings ------------------------------------------
      // Flat fill at mid-zoom, then extruded "toy blocks" once close in. The
      // height is exaggerated a touch (×1.4) so the city reads as a glossy
      // model rather than a flat map.
      {
        id: "building-flat",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        maxzoom: 15,
        paint: {
          "fill-color": C.building,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, 0.7],
          "fill-outline-color": C.buildingShade,
        },
      },
      {
        id: "building-3d",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["get", "render_height"],
            0,
            C.buildingLow,
            20,
            C.buildingMid,
            60,
            C.buildingTall,
            120,
            C.buildingXTall,
          ],
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            0,
            15.5,
            ["*", ["coalesce", ["get", "render_height"], 5], 2.3],
          ],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 1,
        },
      },

      // --- Labels --------------------------------------------------------
      {
        id: "water-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "water_name",
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": FONT_REGULAR,
          "text-size": 12,
          "text-max-width": 6,
        },
        paint: {
          "text-color": C.waterLabel,
          "text-halo-color": C.labelHalo,
          "text-halo-width": 1.2,
        },
      },
      {
        id: "road-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        minzoom: 13,
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": FONT_SEMIBOLD,
          "text-size": 11,
          "symbol-placement": "line",
          "text-max-angle": 30,
        },
        paint: {
          "text-color": C.label,
          "text-halo-color": C.labelHalo,
          "text-halo-width": 1.4,
        },
      },
      {
        id: "place-label-minor",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: [
          "in",
          ["get", "class"],
          ["literal", ["suburb", "neighbourhood", "village", "town"]],
        ],
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": FONT_SEMIBOLD,
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 11, 15, 15],
          "text-max-width": 8,
        },
        paint: {
          "text-color": C.label,
          "text-halo-color": C.labelHalo,
          "text-halo-width": 1.6,
        },
      },
      {
        id: "place-label-city",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["city"]]],
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": FONT_BOLD,
          "text-size": ["interpolate", ["linear"], ["zoom"], 6, 13, 12, 22],
          "text-max-width": 8,
        },
        paint: {
          "text-color": C.label,
          "text-halo-color": C.labelHalo,
          "text-halo-width": 1.8,
        },
      },
    ],
  };
}

// A free, no-key raster fallback (CartoDB Voyager — already credited in the old
// build) so a missing/blank Stadia key never renders an empty grey grid. No 3D
// buildings here, but the map still works and stays branded-friendly.
export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.stadiamaps.com/fonts/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{ratio}.png",
      ].map((u) => u.replace("{ratio}", "")),
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    { id: "carto", type: "raster", source: "carto" },
  ],
};

/** Pick the cartoon Stadia style when a key exists, else the no-key fallback.
 *  The raster fallback has no dark variant — it stays light in both themes. */
export function buildStyle(dark = false): StyleSpecification {
  const key = process.env.NEXT_PUBLIC_STADIA_API_KEY;
  return key ? cartoonStyle(key, dark) : FALLBACK_STYLE;
}
