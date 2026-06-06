# Session log

One entry per task, newest last — format in `CLAUDE.md`. To keep this file
cheap to read (for humans and AI alike), it holds **recent entries only**:
when it grows past ~200 lines, move the oldest entries into
`SESSION_LOG_ARCHIVE.md` (append-only, full history). Do not read the archive
start to finish — consult it only when a specific past decision is in
question.

## 2026-06-06 — Mobile footer + re-centre fix

- What changed: `SiteFooter.tsx` — mobile shows a single compact line ("18+ only · Tobacco-free pouches · Not a shop · © findsnus") via `sm:hidden`; full compliance text is `hidden sm:block`; standalone copyright hidden on mobile to avoid duplication; `py-2 sm:py-3` trims vertical padding. `ShopMap.tsx` + `Locator.tsx` — added `recenterKey` state (bumped on every explicit location request) and `prevRecenterKeyRef` in ShopMap; any location action now always triggers `flyTo` before falling through to the existing `centerChanged`/`fitBounds` logic, so tapping "Use my location" re-centres the map even when GPS returns the same fix.
- Why: Footer was ~90px tall on mobile, visibly shrinking the map area. Re-centre was broken when panning away and tapping "Use my location" a second time with the same GPS fix.
- Unsure about / flagged for review: The `centerChanged` branch after the `keyChanged` early-return is now technically unreachable for explicit location requests — it only fires on radius-only changes. Worth a cleanup pass later if the recenter logic grows more complex.
- What I'd do differently: Nothing significant.

Everything up to 2026-06-06 is in the archive: initial locator build, Stadia
basemap, MapLibre cartoon-map swap + palette tuning, popup brand-filter fix,
Pablo/Killa brand seed, town search + geolocation guard, list-view drawer +
no-location empty state + smooth fly-in + stuck-loading fix.

## 2026-06-06 — Pre-launch cleanup + polish

- What changed: Deleted dead-code components `Hero.tsx` and `PostcodeSearch.tsx` (never rendered in `page.tsx`). Default radius changed from 3 mi to 1 mi. Added `openGraph` and `twitter` metadata to `layout.tsx`; created `app/opengraph-image.tsx` (1200×630 dark card via `next/og`). Fixed list drawer overlapping controls on mobile with `mt-[200px] sm:m-[18px]` + matching `max-h` classes.
- Why: Cleanup before v1 deploy — dead code removed, social share previews now populated, drawer usable on narrow screens, radius default matches a realistic "near me" search.
- Unsure about / flagged for review: `metadataBase` omitted from metadata — Next.js may warn about relative OG image URLs until the production domain is added. The 200px mobile drawer margin is a fixed estimate; will need revisiting if `LocatorControls` grows taller.
- What I'd do differently: Nothing significant for this scope.

## 2026-06-06 — Fix list drawer overlapping controls card on mobile

- What changed: In `components/ShopList.tsx`, the inner card div's margin was changed from `m-[18px]` to `mx-[18px] mb-[18px] mt-[200px] sm:m-[18px]`. The inline `style={{ maxHeight: "calc(100% - 36px)" }}` was removed and replaced with Tailwind classes `max-h-[calc(100%-218px)] sm:max-h-[calc(100%-36px)]` on the same div.
- Why: On mobile the controls card stacks vertically (`flex-col`) and is roughly 196px tall from the container top (18px inset + ~178px card height). The drawer's inner card was starting at `inset-y-0` top with only 18px margin, so it visually appeared under or collided with the controls despite the z-index. Pushing the card down 200px on mobile clears the controls; `sm:m-[18px]` restores the desktop layout. The matching `max-h` update keeps the card from overflowing the bottom of the container.
- Unsure about / flagged for review: The 200px top margin is a fixed estimate based on the described controls height (~170–180px + 18px inset). If `LocatorControls` ever grows taller on mobile (more rows, larger font) this value will need revisiting. A CSS custom property approach (measuring actual height) would be more robust long-term but adds JS complexity that wasn't warranted here.
- What I'd do differently: Nothing significant — the fix is minimal and targeted. If controls height were dynamic I'd measure with a ResizeObserver and expose a CSS variable instead.

## 2026-06-06 — Glasgow Tesco seed migration

- What changed: Created `supabase/migrations/20260606120000_seed_glasgow_tesco.sql`. Adds 10 Tesco Express stores across Glasgow city centre (Hope St, Argyle St, Byres Rd, Victoria Rd, High St, Cowcaddens Rd, Maryhill Rd, Paisley Rd West, Duke St, Dumbarton Rd) with coordinates from postcodes.io. Listings cover VELO (all 10 shops), ZYN (6 shops), Killa (4 shops), Pablo (3 shops) at realistic UK Tesco prices and strength variants. Uses a single `DO $$` block with declared UUID variables so shop IDs are referenced cleanly without hardcoded literals.
- Why: First real Glasgow data cluster to make the map useful during development and demo.
- Unsure about / flagged for review: G1 1DU is a terminated postcode (postcodes.io returned 404); archived coordinates from the API's `terminated` field were used — these are close but may not sit exactly on the store. Worth verifying manually before promoting to `verified=true`. The 200px mobile drawer margin is still an estimate and would need revisiting if LocatorControls grows.
- What I'd do differently: Nothing significant. Could have used a CTE-based approach instead of `DO $$` variables — both are readable, the DO block mirrors what we'd expect if this grows further.

## 2026-06-06 — Compact mobile footer

- What changed: In `components/SiteFooter.tsx`, added a mobile-only `<p className="text-xs text-muted sm:hidden">` with the short line `18+ only · Tobacco-free pouches · Not a shop · © 2026 findsnus` above the existing paragraph. The existing paragraph gained `hidden sm:block` so it is suppressed on mobile. Container padding changed from `py-3` to `py-2 sm:py-3`. The desktop copyright `<p>` (`shrink-0`) is unchanged and still renders on `sm:` and above. `pnpm tsc --noEmit` passed clean.
- Why: On mobile the multi-line compliance paragraph made the footer ~90px tall, visibly shrinking the map in the `h-dvh` flex column. All required compliance text is still present on mobile, just condensed to one line.
- Unsure about / flagged for review: The mobile line is a summary, not the full legal text — that's the intended trade-off, but worth confirming the shortened copy is acceptable from a compliance standpoint. The desktop `© findsnus` `<p>` is now redundant with the mobile line but intentionally kept so the desktop layout is unchanged.
- What I'd do differently: Nothing significant for this scope.

## 2026-06-06 — Fix "Use my location" re-centre on identical GPS fix

- What changed: Added `recenterKey` (integer, starts at 0) to `Locator` state. Bumped unconditionally in `handleLocationChange` alongside `fetchNonce`. Passed as a new required prop to `<ShopMap>`. In `ShopMap`, added `recenterKey: number` to `Props`, destructured it, added `prevRecenterKeyRef = useRef(0)`, and inserted a `keyChanged` check at the top of the `hasLocation` branch: if `recenterKey` differs from the stored ref we always `flyTo` and `return` early — skipping the `centerChanged`/`fitBounds` path entirely. Added `recenterKey` to the effect dependency array. `pnpm tsc --noEmit` clean.
- Why: When GPS returns the same coordinates twice (user has panned away and taps "Use my location" again), `centerChanged` was false so the effect fell through to `fitBounds` instead of flying in. The `recenterKey` tells the map "this is a new intent, regardless of coordinates", so repeat GPS hits always produce a `flyTo`. Radius-only changes (key unchanged, coords unchanged) still fall through to `fitBounds` as before.
- Unsure about / flagged for review: `prevRecenterKeyRef` is initialised to `0` and `recenterKey` starts at `0`, so the very first render (before any location is set) has `keyChanged = false` — which is correct because `hasLocation` is still false at that point and the effect returns early anyway. Worth confirming this edge case manually.
- What I'd do differently: Nothing significant for this scope.

## 2026-06-06 — OpenGraph and Twitter card metadata
- What changed: Expanded `metadata` export in `app/layout.tsx` to include `openGraph` (type: website) and `twitter` (card: summary_large_image) fields, both reusing the existing title and description. Created `app/opengraph-image.tsx` using Next.js built-in `ImageResponse` (no new dependency) — 1200×630, dark `#0f1117` background, white bold wordmark "findsnus" at 96px, muted tagline below. `pnpm tsc --noEmit` passed clean.
- Why: Social share previews were blank; platforms show the OG image when a link is pasted.
- Unsure about / flagged for review: `metadataBase` was omitted per spec — without it Next.js may log a warning in dev about relative OG URLs. Worth adding once the production domain is confirmed.
- What I'd do differently: Nothing significant for this scope. If a real brand font is ever self-hosted, it can be loaded via `ArrayBuffer` inside ImageResponse rather than a fetch — that approach also works with the no-Google-font constraint.
