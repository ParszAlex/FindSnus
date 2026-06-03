# Session Log

## 2026-06-01 — Landing hero + age gate + compliance footer

- **What changed:** Built the first real surface, replacing the create-next-app
  scaffold. New files: `components/AgeGate.tsx` (client), `components/Hero.tsx`,
  `components/PostcodeSearch.tsx` (client), `components/Wordmark.tsx`,
  `components/SiteFooter.tsx`. Rewrote `app/page.tsx` (thin composition),
  `app/layout.tsx` (Public Sans via next/font, en-GB, real metadata), and
  `app/globals.css` (OKLCH design tokens, focus ring, reduced-motion, the one
  `rise` entrance animation, semantic z-index scale).
- **Why:** `craft landing hero`. Established the visual identity: "official
  wayfinding" — pure white surface, one olive-green brand (the seed anchor
  `oklch(0.35 0.08 110)`) as primary, no second accent (Restrained). Public Sans
  chosen for its USWDS/official-document read, reinforcing legitimacy. Age gate
  is the first interactive surface (keyboard-trapped dialog, localStorage-
  persisted, hard block for under-18). Footer carries the PRODUCT.md compliance
  framing.
- **Scope honoured:** No map, no Supabase, no listing data, no new dependencies,
  no motion libraries. Server Components throughout except AgeGate and
  PostcodeSearch. Existing palette anchor used as primary; no new palette.
- **Unsure about / flagged for review:**
  - Age-gate confirmed users see a one-frame "checking" blank before the gate
    resolves from localStorage (chose to never expose content to unverified
    visitors over avoiding the flicker). Acceptable, but worth a look if it
    bothers you.
  - The nicotine-addiction warning line is intentionally omitted (your call) —
    revisit `SiteFooter.tsx` when legal copy is finalised.
  - The age gate is client-side only; it deters but does not enforce. Real age
    verification (if ever required) is a server/provider concern, not this UI.
  - Deliberately shipped zero imagery. Defensible here (PRODUCT.md bans
    lifestyle imagery; utility brand), but flagging since brand surfaces usually
    want imagery.
  - Caught and fixed a "ghost-card" border+shadow pairing on the gate during the
    in-browser review pass.
- **What I'd do differently:** Nothing structural. When the search gains real
  behaviour, `PostcodeSearch` will need loading/error/empty states and likely a
  "use my location" affordance — built the input so that slots in cleanly.

## 2026-06-04 — Wire Supabase client into app

- **What changed:** Installed `@supabase/supabase-js@2.107.0` and `@supabase/ssr@0.10.3` as production dependencies. Created `utils/supabase/client.ts` (browser client via `createBrowserClient`) and `utils/supabase/server.ts` (async server client via `createServerClient` with Next.js `cookies()`). Created `.env.local` with placeholder values (gitignored). Added a temporary `select count(*) from shops` query to `app/page.tsx` to prove the connection, rendered as a small gray debug line below the hero.
- **Why:** Wiring step before any real data features. Connection proof catches misconfigured env vars and PostgREST access issues before they show up buried in a feature.
- **Unsure about / flagged for review:**
  - **Data API exposure:** The April 2026 Supabase breaking change ("Tables not exposed to Data and GraphQL API automatically") means the `shops` table may need an explicit `GRANT SELECT ON shops TO anon, authenticated;` beyond just the RLS policy. The existing migration has the RLS policy but not the explicit grant. If the count query returns an error, that's the first thing to check in the Supabase dashboard under API settings.
  - **Env var name:** Using `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the new recommended name from 2025+). The old `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works until end of 2026 — whichever key format you copy from the Supabase dashboard, put it under the publishable var name.
  - **No middleware yet:** The server client swallows `setAll` errors from Server Components. This is fine now, but once auth is added, a middleware file (`middleware.ts`) is required to refresh sessions properly — the `setAll` catch block is a placeholder for that future state.
  - Docs for the `@supabase/ssr` `createServerClient` pattern required multiple fetches to confirm — the official quickstart pages didn't serve full code blocks via fetch. Cross-checked against the changelog and SSR README instead.
- **What I'd do differently:** Nothing structural. The client/server split in `utils/supabase/` is the right shape. When middleware is added, it will sit at `utils/supabase/middleware.ts` and `middleware.ts` at root — the helpers are already laid out to accept that cleanly.

## 2026-06-01 — impeccable init (project design context)

- **What changed:** Added `PRODUCT.md` at the repo root — the strategic design
  brief (register, users, purpose, brand personality, anti-references, 5 design
  principles, accessibility stance). No code or dependencies touched.
- **Why:** The `impeccable` design skill (and future design work) reads
  PRODUCT.md before doing anything, so design choices stay on-brief and
  consistent. The repo was a clean create-next-app scaffold with no design
  system or stated visual direction yet.
- **Unsure about / flagged for review:**
  - Register is set to `product` but noted as mixed (locator tool + a
    marketing landing of equal weight). If the landing grows into the hero,
    we may want to revisit that default.
  - Accessibility was answered as "not a focus," but I still wrote in baseline
    craft defaults (contrast, focus, reduced-motion) and a note to plan the
    map's keyboard/screen-reader fallback up front. Flagging in case you want
    a stricter or looser stance recorded.
  - Brand seed from the palette tool is a deep olive / yellow-green (hue ~110).
    That's the *anchor*, not a committed palette — DESIGN.md isn't written yet.
- **What I'd do differently:** Nothing notable; this was setup. The real
  design decisions (palette, type, components) are deferred to DESIGN.md, which
  is best generated once there's actual UI code to capture rather than guessed
  pre-build.
