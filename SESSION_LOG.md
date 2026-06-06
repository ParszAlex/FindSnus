# Session log

One entry per task, newest last — format in `CLAUDE.md`. To keep this file
cheap to read (for humans and AI alike), it holds **recent entries only**:
when it grows past ~200 lines, move the oldest entries into
`SESSION_LOG_ARCHIVE.md` (append-only, full history). Do not read the archive
start to finish — consult it only when a specific past decision is in
question.

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

## 2026-06-06 — OpenGraph and Twitter card metadata
- What changed: Expanded `metadata` export in `app/layout.tsx` to include `openGraph` (type: website) and `twitter` (card: summary_large_image) fields, both reusing the existing title and description. Created `app/opengraph-image.tsx` using Next.js built-in `ImageResponse` (no new dependency) — 1200×630, dark `#0f1117` background, white bold wordmark "findsnus" at 96px, muted tagline below. `pnpm tsc --noEmit` passed clean.
- Why: Social share previews were blank; platforms show the OG image when a link is pasted.
- Unsure about / flagged for review: `metadataBase` was omitted per spec — without it Next.js may log a warning in dev about relative OG URLs. Worth adding once the production domain is confirmed.
- What I'd do differently: Nothing significant for this scope. If a real brand font is ever self-hosted, it can be loaded via `ArrayBuffer` inside ImageResponse rather than a fetch — that approach also works with the no-Google-font constraint.
