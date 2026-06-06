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

// The cartoon palette. Soft, slightly desaturated pastels with enough pop to
// feel "plastic" but muted enough that the brand-blue pins stay the loudest
// thing on the map. All sRGB hex (MapLibre paints its own GL canvas and can't
// read our CSS custom properties).
const C = {
  water: "#aedcf0", // glossy pool blue
  waterDeep: "#92cdec",
  land: "#f4f1e8", // warm paper
  green: "#c7e6b8", // park / wood — soft mint
  greenDark: "#b3dca0",
  grass: "#d3ecc6",
  sand: "#f0e6c8",
  residential: "#efeadd",
  road: "#ffffff",
  roadCasing: "#e6dfce",
  roadMinor: "#fbf9f3",
  motorway: "#ffd9a8", // candy-orange trunk roads
  motorwayCasing: "#f1b878",
  building: "#e9e0cc",
  buildingTop: "#f3ecda",
  buildingShade: "#ddd2b8",
  label: "#5a5346",
  labelHalo: "#fffdf7",
  waterLabel: "#5b8fb0",
  boundary: "#d8b8c8",
};

const STADIA_SOURCE = (key: string) =>
  `https://tiles.stadiamaps.com/data/openmaptiles.json?api_key=${key}`;

/**
 * A hand-built cartoonish MapLibre style on Stadia's OpenMapTiles vector tiles.
 * Includes 3D fill-extrusion buildings (render_height) at high zoom for the
 * "plastic toy" look. Pass the Stadia API key; returns a full StyleSpecification.
 */
export function cartoonStyle(apiKey: string): StyleSpecification {
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
        paint: { "fill-color": C.residential, "fill-opacity": 0.7 },
      },
      {
        id: "landcover-wood",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["wood", "forest"]]],
        paint: { "fill-color": C.green, "fill-opacity": 0.85 },
      },
      {
        id: "landcover-grass",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["grass", "meadow"]]],
        paint: { "fill-color": C.grass, "fill-opacity": 0.85 },
      },
      {
        id: "landuse-park",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "park",
        paint: { "fill-color": C.greenDark, "fill-opacity": 0.6 },
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
            C.building,
            30,
            C.buildingTop,
          ],
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            0,
            15.5,
            ["*", ["coalesce", ["get", "render_height"], 5], 1.4],
          ],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.9,
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

/** Pick the cartoon Stadia style when a key exists, else the no-key fallback. */
export function buildStyle(): StyleSpecification {
  const key = process.env.NEXT_PUBLIC_STADIA_API_KEY;
  return key ? cartoonStyle(key) : FALLBACK_STYLE;
}
