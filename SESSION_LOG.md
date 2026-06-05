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

## 2026-06-04 — Make schema push-safe and restore read-only RLS migration

- **What changed:** Two migration edits for reproducibility. (1) Added `set
  search_path to extensions, public;` to the top of
  `20260603230038_create_initial_schema.sql` so the PostGIS `geography` type
  resolves under `db push` (direct connection), not only the Management API.
  (2) The RLS block (enable + three `public read` SELECT policies) was
  duplicated — it lived in `230038` while the dedicated
  `20260603230602_enable_rls_read_only.sql` sat empty. Moved RLS out of `230038`
  into `230602` so it's defined exactly once across the migration chain.
- **Why:** As written, the requested task would have *created* a replay bug:
  filling `230602` with RLS while `230038` already had it means a fresh `db
  reset` replays both and dies on `policy ... already exists`. Single source of
  truth fixes that. Remote already had correct RLS (from `230038`), so no remote
  re-apply was needed or done — verified `rls_enabled=true` on all three tables,
  3 SELECT policies, 0 write policies, before and after.
- **Unsure about / flagged for review:**
  - **Local replay proof not yet run.** The real "test, don't assume" proof —
    `supabase start` + `supabase db reset` replaying `230038 → 230602 → 235303`
    locally and confirming shops:4 / listings:12 / brands:1 / RLS on — is
    **deferred**. This machine had no Docker, then no WSL2; installing WSL2
    needs a reboot. Docker Desktop + WSL2 are now installed; run the proof in a
    fresh session after reboot. Replay-safety is currently established by
    inspection only (RLS defined once, search_path present).
  - Editing an already-applied migration (`230038`) is normally something to
    avoid, but here both `230038` and `230602` are applied on remote and the
    net DB state is unchanged — this is purely a file reorganisation for clean
    local replay / portfolio readability.
- **What I'd do differently:** Nothing — the move is the correct fix. Only
  open item is executing the local reset once the reboot is done.

## 2026-06-04 — Add PostGIS extension migration and qualify geography type for replay safety

- **What changed:** Ran the deferred local replay proof (Docker + WSL2 now
  installed). The first `supabase db reset` failed: `type "geography" does not
  exist`. Root cause — PostGIS had only ever been enabled by hand in the
  dashboard, never in a migration, so a clean replay had no extension.
  Fixes: (1) new migration `20260603230000_enable_postgis.sql` (sorts first)
  running `create extension if not exists postgis with schema extensions;`.
  (2) Schema-qualified the column type to `extensions.geography(Point, 4326)` in
  `230038` so it resolves regardless of search_path.
- **The real catch (a bug I'd introduced last task):** With those two fixes the
  reset passed and counts were right (4/12/1) — but a verification query showed
  all three tables had been created in the **`extensions`** schema, not
  `public`. Cause: the `set search_path to extensions, public;` line I'd added
  to `230038` in the previous task. With `extensions` first in the path,
  unqualified `create table` lands tables there. The count query masked it
  (`from shops` still resolves via the path), but it meant (a) replay didn't
  reproduce remote, where tables are in `public`, and (b) PostgREST/the Data API
  only exposes `public`, so the app couldn't read them. Removed that line
  entirely — the qualified `extensions.geography` type makes it unnecessary.
  This deviated from the prior task's "leave it; harmless" note, but the replay
  proved it was not harmless. This is exactly what the local test exists to find.
- **Verified (clean replay, `230000 → 230038 → 230602 → 235303`):** reset
  completes with no errors; tables in **`public`**; RLS `true` on all three;
  3 SELECT policies (`anon,authenticated`), 0 write policies; counts shops:4,
  listings:12, brands:1.
- **Unsure about / flagged for review:**
  - **Remote vs. migrations drift, now understood:** remote was built with
    PostGIS enabled manually and tables in `public`; the migration chain now
    reproduces that *correctly* from scratch. Remote itself is unchanged (these
    edits are file-only; not pushed). If you ever rebuild remote from
    migrations, it will now match.
  - The seed `235303` keeps its own `set search_path to extensions, public;` —
    that's fine and needed: it only does INSERTs (never `create table`), and it
    needs `extensions` in the path for the `::geography` cast and `ST_*`
    functions. INSERTs still target `public` tables. No change made there.
- **What I'd do differently:** I'd have caught the wrong-schema bug last task if
  I'd verified the *schema* of the created tables, not just that a count query
  ran. Lesson: when search_path is in play, check where objects actually land.

## 2026-06-04 — Add nearby_shops PostGIS RPC function (§5.4 nearest-shops query)

- **What changed:** New migration
  `20260604123147_nearby_shops_function.sql` defining
  `public.nearby_shops(in_lat, in_lng, in_radius_km default 10)` — a `language
  sql`, `stable`, `security invoker` function that returns shops within a radius
  of a point, ordered by distance ascending. Uses `ST_DWithin` on `geography`
  for the radius filter and `ST_Distance` for `distance_m`; projects lat/lng
  back out via `ST_Y`/`ST_X` on the `::geometry` cast. `execute` granted to
  `anon, authenticated`.
- **Why:** §5.4 — the core query the locator UI needs: "which shops are near
  me, nearest first." `ST_DWithin` (not `ST_Distance < x`) so the GiST index on
  `shops.location` can be used for the radius bound.
- **Security/replay shape:** `set search_path = ''` (empty) on the function, so
  every identifier is fully schema-qualified on purpose (`extensions.ST_*`,
  `public.shops`). This is the Supabase-recommended hardening — an empty
  search_path means the function can't be hijacked by a malicious schema on the
  caller's path, and it makes the function replay-clean regardless of session
  search_path. `security invoker` so it runs as the caller (RLS still applies).
- **Proven by local replay + two tests (not just "it compiled"):**
  - `db reset` replays all 5 migrations clean.
  - Test A (10km from Airdrie centre `55.8663,-3.9810`): 4 rows, ascending —
    High St 358m, Gartlea 397m, Connor St 2271m, Coatbridge 2720m. Correct
    `ST_MakePoint(lng, lat)` ordering (swapped args would give huge distances or
    0 rows).
  - Test B (500m from High St Tesco's own coords): **exactly 1 row** (High St,
    0m); the ~730m nearest neighbour is correctly excluded — proves the
    `ST_DWithin` bound actually bounds.
- **Unsure about / flagged for review:** Nothing blocking. Function is local +
  file only; remote untouched. When the UI wires this up it'll call it via
  `supabase.rpc('nearby_shops', { in_lat, in_lng, in_radius_km })`.
- **What I'd do differently:** Nothing — the test pair (a positive radius and a
  tight radius that must exclude a known-nearby shop) is the right shape to
  prove a geo filter rather than just smoke-test it.

## 2026-06-04 — Prove client → nearby_shops RPC path (data-layer step 1/4)

- **What changed:** Added a temporary client component at `app/rpc-test/page.tsx`
  that calls `supabase.rpc("nearby_shops", { in_lat, in_lng, in_radius_km })`
  against hardcoded Airdrie-centre coords (55.8657, -3.9803) via the existing
  browser client (`utils/supabase/client.ts`), and dumps `data`/`error` to the
  page as `<pre>` + `console.log`. Also **pushed two pending migrations to
  remote** (`supabase db push --include-all`): `20260603230000_enable_postgis`
  (idempotent no-op — PostGIS was already enabled by hand on remote, logged
  `extension "postgis" already exists, skipping`) and
  `20260604123147_nearby_shops_function` (the function the test needs).
- **Why:** Step 1 of wiring the data layer to the UI — confirm in isolation that
  the client can reach the RPC and get correct rows back, before any map / real
  input / listings join. No new project dependencies (`@supabase/ssr` +
  `supabase-js` already installed).
- **The blocker I hit (and surfaced before acting):** The env points at remote
  (`tifcrkhhtlzwmowulmai`), but `nearby_shops` had only ever been applied
  locally — exactly as the previous entry flagged ("remote untouched"). A direct
  REST probe returned `404 PGRST202 (function not found)`, while the call shape
  was already correct (PostgREST parsed `in_lat, in_lng`). So this was a
  *deployment* gap, not a client bug. I stopped and asked rather than pushing
  unprompted; you chose "push migration, test remote."
- **Second bug, caught in-browser, not papered over:** the first route used the
  task's example name `app/_rpc-test/` — but in the App Router a `_`-prefixed
  folder is a **private folder excluded from routing**, so it 404'd. Renamed to
  `app/rpc-test/` and it rendered.
- **Verified (real browser via Playwright, not just curl):** page renders 4 rows,
  `distance_m` ascending (318, 433, 2245, 2744 m — all < 4000), `error` is null,
  and `console.log` shows the array + null error. Same 4 rows confirmed by a
  direct REST probe to remote post-push.
- **Unsure about / flagged for review:**
  - **`app/rpc-test/` is temporary** and should be deleted once the real locator
    UI consumes `nearby_shops` (it's labelled as such in a header comment).
  - **Remote migration history is now in sync** through `123147` (push also
    recorded `230000`). Remote DB state is unchanged by the postgis no-op; the
    only real addition is the function.
  - One-time: set up the vendored `playwright-skill` (installed Chromium into the
    skill's own `node_modules`, which is gitignored — not a project dependency).
  - Distances differ slightly from the prior entry's Test A because the coords
    differ marginally (55.8657,-3.9803 vs 55.8663,-3.9810); shape is consistent.
- **What I'd do differently:** Nothing structural. The deploy-vs-test-target
  mismatch was the real risk and was worth surfacing as a decision rather than
  guessing.

## 2026-06-04 — Prove merged shops+listings shape (data-layer step 2/4)

- **What changed:** Iterated the temporary `app/rpc-test/page.tsx` (client only —
  no migration, `nearby_shops` untouched). It now does a two-step client-side
  join: (1) `rpc("nearby_shops", …)` for shops + `distance_m`, (2) a second query
  `from("listings").select("shop_id, strength_mg, price, last_confirmed_at,
  source, brands(name)").in("shop_id", shopIds)` that embeds the brand **name**
  via the `brand_id → brands` FK, then merges listings under each shop (grouped by
  `shop_id`) and dumps the nested JSON. Added local `ShopRow` / `ListingRow` /
  `MergedShop` types so the throwaway page is still strict-clean.
- **Why:** Step 2 of 4 — prove the merged data shape the locator UI will consume
  (per shop: its listings as brand name + strength + price), with the join done
  in the client via PostgREST FK embedding rather than in SQL. Keeps
  `nearby_shops` as the proven, listings-free primitive from step 1.
- **Docs checked (not memory):** PostgREST nested select `relation(columns)` +
  alias `alias:relation(...)` + FK disambiguation `relation!fk(...)` confirmed
  current; `.in(column, array)` signature unchanged. Also probed the live embed
  against remote before coding — `brands(name)` returns a single nested object
  (many listings → one brand), which the code relies on.
- **Verified two ways (not just "it compiled"):**
  - A lightweight `supabase-js` Node script (same query path) against remote.
  - The actual page in a real browser (Playwright): 4 shops, distance ascending,
    each with 3 nested listings (12 total — matches the seed), every listing
    `{brand:string, strength_mg:number, price:number}`, brand resolved to
    "Nordic Spirit" (the one seeded brand), `error` null.
- **Unsure about / flagged for review:**
  - **Two round-trips, merged in the client** (not a single SQL join). Fine and
    intentional for this step; if the listing volume per shop grows, revisit
    whether `nearby_shops` should return listings or whether to page them.
  - **Seed data is monochrome** — every listing is the same brand at one price,
    so the proof exercises *shape*, not cross-brand/cross-price variety. Worth
    seeding a second brand + varied prices before building the real comparison UI.
  - The `as unknown as ListingRow[]` cast on the embedded select is because the
    client is untyped (no generated DB types). Generating `Database` types would
    remove the cast — deferred (no codegen tooling added without asking).
  - Transient environment note: free disk on C: briefly read 0.11 GB mid-task
    (one probe truncated with an ENOSPC error) then recovered to ~2 GB; the
    browser proof ran clean. Flagging in case it recurs.
- **What I'd do differently:** Nothing structural. The client-side merge is the
  right call for this step; the open question is purely data variety in the seed.

## 2026-06-04 — Seed a second brand (Velo) with varied stock + prices

- **What changed:** New seed migration
  `20260604165020_seed_second_brand.sql` (created via
  `supabase migration new`, not hand-named). Inserts brand `Velo`
  (idempotent `on conflict (name) do nothing`) and exactly 5 Velo listings
  across the 4 existing shops: High St + Gartlea stock 6mg **and** 10mg,
  Connor St stocks 6mg only, Coatbridge stocks none. Velo 6mg is a different
  price at each stocking shop (5.49 / 5.50 / 5.95); Velo 10mg is 5.75 / 6.10.
  Fully schema-qualified (`public.brands` / `public.shops` / `public.listings`),
  no `set search_path` (Bug-2 lesson) — it does only INSERTs, no `ST_*`.
  Links to shops by **name** via a `(shop_name, strength, price)` VALUES table
  joined to `public.shops`, mirroring the NS seed's no-hardcoded-uuids pattern
  (adapted from a uniform cross-join to a VALUES table because prices now vary).
  A comment flags the prices as representative UK values, not live-verified.
- **Why:** The monochrome NS seed (1 brand, £6.50 everywhere) can't validate a
  comparison UI — nothing to compare. This gives real cross-brand / cross-price
  data. Did **not** touch `nearby_shops`, the rpc-test page, or the immutable NS
  seed (`235303`, already on remote).
- **Verified by a clean `db reset` (the defined proof):** all SIX migrations
  replay in order with no errors; post-reset state (authoritative — not a manual
  apply) shows brands:2, shops:4, listings:17, Velo listings:5, Velo 6mg at 3
  shops at 3 distinct prices (5.49/5.50/5.95), Velo 10mg 5.75/6.10, exactly 1
  shop (Coatbridge) with zero Velo, RLS true on all three tables in `public`.
- **The incident (honest):** Disk read 2.14 GB — under the 3 GB line I was told
  to stop at — so I stopped and asked; you chose "run reset now at 2.14 GB."
  That reset triggered Docker Desktop to crash mid-run (the ENOSPC risk you'd
  flagged): the local DB went down (connection refused) and, paradoxically, free
  space jumped to ~18.7 GB as Docker's VM disk released. Recovery was exactly the
  anticipated path: relaunched Docker Desktop, `supabase start`, then re-ran the
  reset cleanly with ample space → green. So the *successful* proof ran at
  ~18.7 GB, not 2.14 GB.
- **Verification-tooling note:** `supabase db query` only executes ONE statement
  per call (and each call is its own connection), so I couldn't run a
  `begin…rollback` dry-run or apply the 2-statement migration in one shot. Before
  the reset I sanity-checked the SQL by applying the two statements to the live
  local DB and reading back the counts; that mutates local, but the subsequent
  `db reset` wiped and replayed it cleanly, so the committed proof is the reset,
  not the manual apply.
- **Unsure about / flagged for review:**
  - **Prices are representative, not real** (noted in a SQL comment). Fine for a
    portfolio comparison UI; revisit if you ever want live-sourced prices.
  - **Not pushed.** For the rpc-test page (which hits **remote**) to show Velo,
    this migration must be pushed to remote — you said you'll handle that.
  - Listings insert is a plain insert (no `on conflict`), matching the NS seed;
    only meaningful on a clean replay, which is how seeds run. The 5 rows are
    distinct on `unique(shop_id, brand_id, strength_mg)`.
- **What I'd do differently:** Given the 3 GB guardrail, crossing it surfaced the
  exact failure it was meant to prevent — though it self-recovered and ended
  clean. Next time at low disk I'd reclaim space (or wait) *before* the reset
  rather than during, to avoid the Docker crash detour.

## 2026-06-05 — Shop list UI + extract fetch to lib/shops (step 3/4)

- **What changed (one unit, two sub-steps):**
  - **3a (pure move):** Extracted the RPC-call + client-side listings-join + nest
    logic out of `app/rpc-test/page.tsx` into `lib/shops.ts` as
    `getNearbyShopsWithListings(lat, lng, radiusKm)`, returning the §4 shape
    (`{ ...shopCols, distance_m, listings: [{ brand, strength_mg, price }] }`) in
    the RPC's distance-ascending order. The `nearby_shops` query and the
    listings `select(... brands(name)).in("shop_id", …)` are byte-identical to
    before. `rpc-test` now just calls the lib and dumps the result (still
    temporary, **not deleted**).
  - **3b (list UI):** New `app/shops/page.tsx` — a client component mirroring
    rpc-test's fetch mechanism (no server/client refactor). Renders shops
    nearest-first (no re-sort), name + sensibly-formatted distance (`320 m` /
    `2.2 km`), listings grouped by brand with strengths ascending + GBP prices,
    `Not stocked here` for a brand a shop lacks, and loading / error / empty
    states. Styled with the existing OKLCH semantic tokens (`text-muted`,
    `border-border`, `bg-surface`), not guessed `gray-*`.
- **Deviation from the brief (flagged + approved):** The task said "new
  `app/page.tsx`", but that file IS the landing page (`AgeGate` + `Hero` +
  `SiteFooter`) and the `AgeGate` enforces CLAUDE.md's "Age gate (18+) on entry"
  hard rule. Overwriting it would have dropped the age gate. I stopped and asked;
  you chose a **new `/shops` route**, leaving the landing + age gate untouched.
- **Design note — "Not stocked here":** the brand universe is derived from the
  union of brands across the *returned* shops (not a hardcoded brand set, not a
  separate brands fetch), so Coatbridge correctly shows Velo as not stocked
  because Velo appears at other nearby shops. Limitation: a brand carried by *no*
  nearby shop can't appear as "not stocked" anywhere — honest, since the result
  set is all we know about. Revisit if/when brand filtering needs the full brand
  list.
- **Verified (real browser, Playwright — not "looks fine"):**
  - 3a regression: `/rpc-test` JSON byte-identical to pre-extraction (Velo
    present, 6mg 5.49/5.50/5.95, Coatbridge no Velo, error null).
  - 3b success: 4 cards in order Gartlea→High St→Connor St→Coatbridge; distances
    `320 m / 430 m / 2.2 km / 2.7 km`; every card lists both brands; Coatbridge
    Velo = the single "Not stocked here"; prices £5.49/£5.50/£5.95/£5.75/£6.10/
    £6.50 all present; no console/page errors; screenshot looks clean.
  - 3b states: mocked the RPC to prove all three — `[]`→empty message, `500`→
    error message, delayed→loading message.
- **Docs:** No new doc lookups needed — both sub-steps reuse the client fetch
  pattern already proven on this exact Next 16 / supabase-js stack in steps 1–2
  (not from memory). Tailwind v4 `@theme`→utility resolution was confirmed by the
  actual render, not assumed.
- **Unsure about / flagged for review:**
  - **`/shops` is not itself age-gated.** It relies on the gated landing as the
    entry point; the gate is localStorage-persisted, so once `/shops` is linked
    from the landing the gate carries over — but direct navigation to `/shops`
    bypasses it. Revisit when routing/linking is finalised (middleware or a
    shared gate wrapper).
  - `rpc-test` is now redundant with `/shops` for the happy path but kept as the
    raw-shape probe until the locator is settled.
- **What I'd do differently:** Nothing structural. Step 4 (cheapest-highlight,
  and likely wiring real input + the map) builds on `getNearbyShopsWithListings`
  unchanged.

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
