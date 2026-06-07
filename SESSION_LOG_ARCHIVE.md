# Session Log — Archive

Full history of rotated entries (append-only). The live log is
`SESSION_LOG.md`; entries move here when that file grows past ~200 lines.
Don't read this start to finish — search it when a specific past decision is
in question.

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

## 2026-06-05 — Consolidate locator onto gated home, remove /shops (Unit A)

- **What changed:**
  - **Extracted** the locator UI from `app/shops/page.tsx` into
    `components/Locator.tsx` — a pure move (same `getNearbyShopsWithListings`
    fetch, same hardcoded Airdrie coord, same render + states), export renamed
    `ShopsPage` → `Locator`.
  - **Rewrote `app/page.tsx`** as the gated home (now a Client Component). It
    reads the AgeGate's existing localStorage key and: `null` while reading →
    renders nothing; not confirmed → `<AgeGate />` only; confirmed →
    `<Locator />`. The locator is **not mounted until confirmed**, so an
    unconfirmed visitor's DOM has zero shop/brand data (absent, not hidden).
  - **Reused the gate's key** by adding `export` to `STORAGE_KEY` in
    `components/AgeGate.tsx` — the only change to that file; its logic and the
    key value are untouched. Single source of truth, no duplicated magic string.
  - **Deleted the `/shops` route** (`git rm app/shops/page.tsx`; dir gone).
  - `app/rpc-test` left untouched (separate cleanup later).
- **Why the poll:** the AgeGate writes the key in the same tab, where the
  `storage` event does NOT fire. So the home polls localStorage (200 ms) while
  unconfirmed to catch the confirm transition, plus a `storage` listener for the
  cross-tab case; both tear down the moment confirmation is seen.
- **Verified (real browser, Playwright):**
  - Fresh context (no key): age gate shown; full page HTML contains none of
    `Velo` / `Nordic Spirit` / `Nearby shops` / `£5.` / `£6.` — proven absent via
    `page.content()`, not merely visually hidden.
  - After clicking "Yes, I am 18 or over": four shops render in order
    Gartlea → High St → Connor St → Coatbridge; Coatbridge's Velo row reads
    "Not stocked here"; key becomes `true`.
  - `/shops` returns HTTP 404. No page errors.
- **Unsure about / flagged for review:**
  - **The confirmed home now renders ONLY `<Locator />`** — the `Hero` and
    `SiteFooter` (the latter carried the PRODUCT.md compliance framing) are no
    longer on the page, per the explicit "confirmed → render `<Locator />`"
    instruction. If that compliance footer should persist on the locator, say so
    and I'll wrap it back in. `Hero.tsx` / `SiteFooter.tsx` / `PostcodeSearch.tsx`
    are now unused (files kept, not deleted — out of scope); `Wordmark` is still
    used by the AgeGate.
  - `app/page.tsx` went from a Server Component to a Client Component (required
    to read localStorage). Metadata still lives in `app/layout.tsx`, so nothing
    was lost there.
  - The 200 ms poll is a pragmatic same-tab sync. The cleaner alternative — an
    `onConfirm` callback on the AgeGate — was deliberately not done because it
    would change the gate's logic, which was out of scope.
- **What I'd do differently:** Nothing within this unit's scope. If revisited, an
  AgeGate `onConfirm` callback would remove the poll.

## 2026-06-05 — Leaflet map on the gated home, hardcoded coord (Unit B)

- **New dependency (flagged, React-19-gated):** `react-leaflet@5.0.0` +
  `leaflet@1.9.4` (prod) and `@types/leaflet@1.9.21` (dev). Pre-flight confirmed
  `react@19.2.4`, so react-leaflet **5.x** is the correct line (4.x is React 18);
  had React not been 19 I'd have stopped rather than downgrade. Free OSM tiles,
  no API key — consistent with the locked stack.
- **What changed:** New `components/ShopMap.tsx` (client-only) — a `MapContainer`
  + OpenStreetMap `TileLayer` + one `Marker` per shop, rendered from the **same**
  `getNearbyShopsWithListings` fetch the list uses (one data path, so pins and
  list can't disagree). Each popup shows shop name, distance, and the per-brand
  breakdown driven off the same brand-universe logic as the list, so Coatbridge's
  popup reads "Not stocked here" for Velo exactly as its list card does. A small
  `FitToMarkers` child fits the view to the markers (frames all four now, and
  still works once the coord goes dynamic). `Locator` mounts it **above** the
  existing list via `next/dynamic(() => import("./ShopMap"), { ssr: false })`
  with a placeholder — Leaflet reads `window` on import, so it must never be
  evaluated on the server. Still on the hardcoded Airdrie coord — search /
  geolocation is Unit C; this proves the render pipe before swapping the input.
- **The bug I caught and fixed (not papered over):** first browser run showed
  four markers but with `src="undefined"` and zero-loaded icons. Cause: under
  **Turbopack** a `*.png` import resolves at runtime to a **URL string**, not the
  `StaticImageData` object that `next-env` types it as — so `iconUrl.src` was
  `undefined`. `tsc` passed because the type said otherwise. Fixed with an
  `assetUrl()` normaliser (handles string **or** `{ src }`); re-ran and icons
  load from `/_next/static/media/marker-icon.*`. This is the known leaflet +
  bundler icon-path issue — fixed properly, not left as broken squares.
- **Verified (real browser, Playwright — discriminating, not "4 pins appeared"):**
  - Tiles: 4/4 loaded from `tile.openstreetmap.org` (real map, not a grey box).
  - Markers: exactly 4; all icons loaded (naturalWidth > 0, not 404).
  - Per-shop truth matches the list: Gartlea popup Velo `6 mg £5.50 / 10 mg
    £6.10`, High St `6 mg £5.49 / 10 mg £5.75`, Connor St `6 mg £5.95`,
    **Coatbridge Velo "Not stocked here"** — i.e. a Velo-stocking shop lists Velo
    while Coatbridge shows it absent, the same brand truth the list encodes.
  - No console errors, no page errors, **no "window is not defined"**; dev-server
    terminal compiled clean (the only `/undefined` 404s were the pre-fix icon run
    and stop after the fix).
- **Test-method note:** marker pointer-clicks were intercepted by the overlapping
  open popup / auto-pan, so the verifier keyboard-activates each marker (they're
  focusable `role="button"` — focus + Enter), which is overlay-independent. App
  behaviour unchanged; this only affected how the test drives the map.
- **Unsure about / flagged for review:**
  - **Hardcoded coord still** (`55.8657, -3.9803`) — deliberate for Unit B. Real
    postcode / "use my location" input is Unit C; the fetch + map don't change.
  - **OSM tiles are third-party requests** from the client (each pan/zoom hits
    `tile.openstreetmap.org`). Attribution is rendered as OSM's usage policy
    requires. No key/cost; flag only as an external-dependency/privacy note.
  - `formatDistance` / `formatPrice` are duplicated as two one-liners in
    `ShopMap` (kept local so the client-only module is self-contained rather than
    importing from the list component). Trivially de-dupable into `lib/` later.
  - Map is `ssr: false`, so first paint shows a bordered placeholder box for a
    frame before Leaflet hydrates — intentional (Leaflet can't SSR).
- **What I'd do differently:** Nothing structural. If the formatters spread to a
  third place I'd lift them into `lib/format.ts`; not worth it for two callers.

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

## 2026-06-06 — Map-first locator redesign (design-system handoff)

- **What changed:** Implemented the `Design System/` handoff (map-first, full-
  bleed locator). Rewrote `Locator.tsx` (state shell) and `ShopMap.tsx`; added
  four presentational components: `LocatorControls`, `BrandFilter`, `ShopPopup`,
  `ResultsPill`. The map now fills the viewport with floating chrome over it:
  search card + radius + "use my location" (top-left), brand-filter chips
  (top-right), live results pill (bottom-centre), custom zoom (bottom-right).
  - Tiles switched OSM → **CartoDB Positron** (muted/clinical, still no key).
  - Markers are custom SVG `divIcon` pins whose fill encodes state (blue =
    selected, white = stocks an active brand, grey = filtered out). Dashed
    `<Circle>` radius indicator; animated "you are here" dot.
  - Popup is a **React overlay, not a Leaflet `<Popup>`** — positioned from the
    marker's `latLngToContainerPoint`, re-derived during render on every map
    move/zoom so it stays pinned. Full styling control; shows brand → strengths
    → prices, distance, address, "Not stocked here" rows, and a Verified badge.
  - **Postcode search via postcodes.io** (`fetch` only, UK, no key) and
    `navigator.geolocation`. Verified live: valid postcode recentres + refetches;
    bad postcode shows an inline hint; geolocation failure shows a hint.
  - `globals.css`: added `.leaflet-container` rule, `.user-ping` keyframes, and
    named elevation tokens (`--shadow-float/popup/zoom/pill`) + `--color-border-
    strong` so the cards/popup/pill share one shadow vocabulary.
  - Data layer **unchanged** — still the one proven `getNearbyShopsWithListings`
    fetch. Radius is user-facing miles, converted to km only for the query.
- **Why:** Mould the new design into the existing stack per the handoff while
  keeping every CLAUDE.md rule. Verified end-to-end with Playwright at 390 /
  768 / 1440 px: age gate → confirm → map, marker select, brand toggle (count
  4→3, shop greys out), radius 3→5 mi (circle grows + refetch), postcode
  recentre, 0-shops empty state. `tsc --noEmit` and `eslint` both clean.
- **Age gate:** **Untouched and still in force.** `app/page.tsx` still mounts
  `<Locator>` only after `AgeGate` confirms; `AgeGate.tsx`, `SiteFooter.tsx`,
  `Wordmark.tsx`, `lib/shops.ts`, `utils/` were not modified.
- **Unsure about / flagged for review:**
  - **Footer layout — deliberate deviation from the handoff.** The handoff put
    the map at `fixed inset-0` with `<SiteFooter>` as an absolute overlay at the
    bottom. Overlaying our existing ~180px footer covered the Leaflet tile
    attribution (a legal requirement) and the zoom controls, and fought the
    results pill. I used a flex column instead (`h-dvh` → map in a `flex-1`
    region, footer in normal flow beneath). The map is full-bleed in its region
    but is viewport-height **minus** the footer, not literally 100vh. This keeps
    attribution + footer fully visible. Say the word if you want the literal
    full-viewport map with the footer floating over it.
  - **Responsive top rail is my addition** (handoff was desktop-only). The two
    fixed-width cards (312 + 246) overlapped on narrow screens, so I wrap them
    in a rail that stacks below `sm` and sits at opposite corners above it;
    cards go full-width on mobile. Mobile still loses a fair bit of (shorter)
    map to the stacked cards — a collapse/expand control would be better later.
  - **Dropped the mockup's "+ Add brand" chip** (non-functional stub; CLAUDE.md
    says locator-only, no fake UI). The popup footer shows only "Verified" when
    `shop.verified` is true — the mockup's "Confirmed 2 days ago / 3 reports"
    needs columns we don't surface yet, so omitted rather than invented.
  - **Added shadow/border tokens** to `globals.css` (handoff said add only the
    map-height util + ping). Justified: avoids repeating long oklch shadow
    literals across four cards. Flag if you'd rather inline them.
  - **React 19 lint shaped two patterns.** `react-hooks/set-state-in-effect`
    rejected the handoff's `useEffect(() => setActiveBrands(...))` and the fetch
    effect. The brand filter now resets by *adjusting state during render*
    (keyed on the brand universe), and the fetch effect sets state only in the
    promise callbacks (loading comes from handlers + initial state). Behaviour
    is identical; both are documented React patterns.
  - **Minor:** a selected shop right at the top edge can have its upward popup
    slide partly under the top control card (card stacks above). Not broken,
    just a corner-case overlap.
  - Left the design's exact px as Tailwind arbitrary values (`px-[14px]` etc.)
    rather than scale utilities — matches the spec 1:1 and the repo's existing
    `text-[1.0625rem]` precedent. The IDE flags them as non-canonical; the lint
    gate doesn't.
- **What I'd do differently:** `formatDistance`/`formatPrice` now live in
  `ShopPopup`; a third copy would justify a `lib/format.ts` — not yet. A mobile
  collapse for the controls would reclaim map space. And I'd revisit the
  footer-vs-full-viewport question with you rather than deciding it solo.

## 2026-06-06 — Locator visual polish (footer + basemap)

- **What changed:** Two small follow-ups at the user's request.
  1. `SiteFooter.tsx` condensed from a tall three-paragraph block (~190px) to a
     single small-print bar (~64px desktop): same compliance copy (18+, info-
     tool-not-shop, no health claims, snus banned), now one `text-xs` line with
     the copyright pushed right on `sm+`. Gives the map more vertical room.
  2. `ShopMap.tsx` basemap swapped CartoDB **Positron → Voyager** (same provider,
     no key, same attribution) — soft road/water/park colour and proper road
     hierarchy instead of flat grey, which read as dated.
- **Why:** User feedback: footer too tall, map felt outdated. `tsc`/`eslint`
  clean; verified at 1440 + 390px.
- **Unsure about / flagged for review:** Voyager adds gentle colour — still
  restrained, but if it reads as too "lively" against the clinical brief,
  Positron (`/light_all/`) or a dark theme (`/dark_all/`) are one-line swaps.
- **What I'd do differently:** Nothing; both reversible one-liners.

## 2026-06-06 — Stadia Maps "Alidade Smooth" basemap

- **What changed:** In `components/ShopMap.tsx`, swapped the single `<TileLayer>`
  from CartoDB Voyager to Stadia Maps "Alidade Smooth"
  (`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=…`).
  URL and attribution are now computed from `process.env.NEXT_PUBLIC_STADIA_API_KEY`:
  when the key is set, we use Stadia + the Stadia/OpenMapTiles/OpenStreetMap
  attribution required by their TOS; when it's absent, both fall back to the old
  Voyager URL and CARTO/OSM attribution so a missing key never renders a blank
  grey grid. Nothing else touched — markers, popups, radius circle, zoom
  controls, and MapController are unchanged.
- **Why:** Stadia is a newly approved external map-tile provider (user signed up
  for a free key). Alidade Smooth is a low-contrast basemap that lets the
  brand-coloured pins read more clearly. The key uses the `NEXT_PUBLIC_` prefix
  and is domain-restricted at Stadia's dashboard, so it is client-safe to expose.
- **Verification:** `tsc --noEmit` passes; `next dev` compiles and serves `/`
  (HTTP 200). Confirmed the `alidade_smooth` slug, `{z}/{x}/{y}{r}.png` path, and
  `?api_key=` param are current against docs.stadiamaps.com, and that a direct
  request to the tile endpoint returns 401 (auth required) rather than 404 —
  i.e. host/slug/path are valid and only the key is missing on an unauth probe.
- **Unsure about / flagged for review:** `NEXT_PUBLIC_STADIA_API_KEY` was not
  actually present in my `.env.local` at runtime, so the live map currently
  renders via the CartoDB fallback. Add the key locally (and to Vercel env) to
  see Stadia tiles; the code path is correct and waiting on the key. Did not
  live-confirm an authenticated Stadia tile fetch for that reason.
- **What I'd do differently:** Nothing — the fallback makes this a safe,
  reversible one-line provider swap.

## 2026-06-06 — Seed Pablo + Killa brands (catalogue only)

- **What changed:** New migration
  `supabase/migrations/20260606012234_seed_pablo_killa_brands.sql`, inserting two
  tobacco-free nicotine pouch brands — `Pablo` and `Killa` — into
  `public.brands` via `on conflict (name) do nothing`. No shops, no listings.
  Mirrors the Velo seed pattern exactly: schema-qualified `public.brands`,
  idempotent, no `set search_path`, explanatory header. Applied to remote with
  `supabase db push` (dry-run first confirmed it was the only pending migration).
- **Why:** Grow the brand catalogue ahead of the listings that will reference
  these brands. Brands-first keeps each migration single-purpose and lets the
  listing data land in its own later task.
- **Unsure about / flagged for review:** These two brands are intentionally
  invisible in the UI until at least one listing references them. `allBrands` in
  `components/Locator.tsx` (L52–64) derives the brand universe purely from the
  listings of returned shops, so a brand with zero listings never appears in the
  filter or popups. That is expected, not a bug. Verified via the Data API:
  `select name from public.brands order by name` returns Killa + Pablo (with
  Nordic Spirit, Velo), and a join to `listings` returns 0 rows for both.
- **What I'd do differently:** Nothing. Idempotent and re-runnable; the migration
  is now in remote history, so a repeat `db push` is a no-op.

## 2026-06-06 — Popup brand availability respects the filter (+ full brand universe)

- **What changed:** The shop popup's brand list now (a) includes brands with
  zero listings and (b) respects the active brand filter.
  - `lib/shops.ts`: added a `Brand` type and `getAllBrands()` — reads the full
    `brands` catalogue (id, name) ordered by name. A zero-listing brand (e.g.
    the newly seeded Pablo/Killa, stocked nowhere) can never be reconstructed
    from shop listings, so the universe has to come from `brands` directly.
  - `Locator.tsx`: fetches the catalogue once on mount (location-independent,
    so it doesn't re-run on centre/radius change) and **unions** it with the
    brands actually listed by returned shops (so data drift never drops a
    listing's brand). Derived `popupBrands` resolves against the filter — no
    filter active (nothing selected, or all selected = the default) → the full
    universe; a specific selection → only those brands — and passes that to the
    popup. The filter chips still receive the full universe, so Pablo/Killa
    appear as toggleable chips.
  - `ShopPopup.tsx` / `BrandFilter.tsx`: comment-only updates documenting that
    the popup receives an already-filter-resolved brand set.
- **Why:** User report — filtering to one brand still showed unrelated brands as
  "Not stocked here", and the new zero-listing brands never appeared at all. User
  chose "respect the filter": filter = {Nordic Spirit} → Coatbridge popup shows
  only Nordic Spirit; no filter → shows every brand incl. Pablo/Killa as "Not
  stocked here". Pablo/Killa are tobacco-free nicotine pouch brands.
- **Unsure about / flagged for review:**
  - `getAllBrands()` is a second client round-trip on mount (separate from the
    per-location shop fetch). Cheap and cached by React state; fine for the
    catalogue size, revisit only if the brand list grows large.
  - Catalogue fetch failure is non-fatal: `allBrands` falls back to the
    listing-derived set, so the locator still works — it just won't surface
    zero-listing brands until the fetch succeeds.
  - "No filter" is treated as `size === 0 || size === allBrands.length`. That
    matches the existing default (all chips active), so the full universe shows
    on first load — intended.
- **What I'd do differently:** Nothing structural. If the popup ever needs to
  distinguish "deselected" from "carried-but-filtered-out", that'd be a separate
  presentational concern, not a data change.

## 2026-06-06 — MapLibre cartoon basemap (Leaflet → MapLibre GL swap)

- **What changed:** Replaced the Leaflet map with MapLibre GL to get a
  cartoonish / plasticky "polished toy map" basemap (user-approved stack swap).
  - Added `lib/mapStyle.ts`: a hand-built MapLibre `StyleSpecification` on
    Stadia's OpenMapTiles **vector** source, heavily restyled — soft warm-paper
    land, glossy pastel water, mint parks, chunky white road ribbons with soft
    casings, candy-orange motorways, dashed candy boundaries, and **3D
    fill-extrusion buildings** (`render_height` × 1.4) at zoom ≥ 15 for the
    plastic-block look. Includes a free no-key CartoDB Voyager raster fallback
    (`buildStyle()` picks it when the key is missing) so the map never renders
    blank.
  - Rewrote `components/ShopMap.tsx` to drive MapLibre directly via a ref +
    effects (no React wrapper — the popup was already a manual projected
    overlay, so a wrapper bought nothing). Reimplemented every existing
    behaviour: one custom HTML marker per shop with the same blue/white/grey
    state encoding; the "you are here" dot + `.user-ping`; the dashed radius
    indicator (a 64-pt GeoJSON polygon, since MapLibre has no Circle); recenter
    on centre/radius change via `fitBounds` (keeping pitch/bearing); the
    bottom-right zoom card; and the React-overlay popup anchored from
    `map.project()` and re-pinned on every `move`/`zoom`. Map stored in state
    (not a ref) so render-time projection is render-safe under the React 19
    lint rules.
  - Imported `maplibre-gl/dist/maplibre-gl.css`. Renamed the `.leaflet-container`
    CSS rule to `.maplibregl-map` in `app/globals.css` and refreshed the
    Leaflet-referencing comments in `globals.css`, `Locator.tsx`, `ShopPopup.tsx`.
  - Updated CLAUDE.md stack line to note the MapLibre swap (2026-06-06).
  - Visible attribution now credits Stadia Maps + OpenMapTiles + OpenStreetMap.
- **Why:** "Genuinely cartoonish / plasticky basemap that still reads as a clean
  UK store locator." The flat Stadia raster `alidade_smooth` look was replaced
  with a vector style we can fully art-direct, including real 3D buildings.
- **Dependencies:** Added `maplibre-gl@5.24.0` (no peer deps; no React-19
  conflict). Removed `leaflet@1.9.4`, `react-leaflet@5.0.0`, and
  `@types/leaflet@1.9.21` — confirmed via grep that nothing in the repo still
  imports them. No new tile provider; reused the existing
  `NEXT_PUBLIC_STADIA_API_KEY` (never hardcoded).
- **Stadia endpoints used (verified against docs.stadiamaps.com, June 2026):**
  - vector source `https://tiles.stadiamaps.com/data/openmaptiles.json?api_key=…`
  - glyphs `https://tiles.stadiamaps.com/fonts/{fontstack}/{range}.pbf`
    (font stacks: "Stadia Regular/Semibold/Bold")
  - sprite `https://tiles.stadiamaps.com/styles/alidade-smooth/sprite`
- **Verification:** `pnpm install`, `pnpm tsc --noEmit`, and `pnpm build` all
  clean; `pnpm lint` clean for all app/component/lib files (the only remaining
  lint errors live in untracked `.agents`/`.claude` skill scripts, pre-existing
  and unrelated). Browser-tested via playwright-skill on the gated home: age
  gate passes, MapLibre vector tiles load (1 TileJSON + ~44 .pbf + glyph
  requests, no blank box), 4 shop markers + the user dot render, selecting a
  marker opens the popup pinned above it and it stays pinned on pan/zoom, the
  radius circle + zoom controls work, and the 3D buildings render obliquely over
  central London. Filter contract intact: with only "Velo" active the popup
  shows ONLY Velo; with no filter it shows all brands incl. Pablo/Killa as "Not
  stocked here". Zero console errors after the colour fix below. Screenshots in
  `.screenshots/` (gitignored): `map-cartoon-overview.png`,
  `map-cartoon-popup.png`, `map-cartoon-filtered.png`, `map-cartoon-3d.png`.
- **Unsure about / flagged for review:**
  - MapLibre's GL paint-property colour validator rejects `oklch()` (it only
    accepts legacy CSS colours), so the radius-circle layers use a hardcoded
    `#004590` constant = the sRGB equivalent of our `oklch(0.4 0.14 255)` brand
    blue. The HTML markers still use the oklch literal (real DOM/CSS accepts it).
    If the brand blue token ever changes, that hex must be re-derived. A possible
    follow-up: centralise the brand blue as a single hex token.
  - 3D building heights depend on OpenMapTiles `render_height`; rural areas
    (e.g. the Airdrie seed location) have little/no height data, so the toy-3D
    effect is most visible in cities. Acceptable, but worth knowing.
  - The map keeps a fixed `pitch: 45 / bearing: -12`. Looks great for the
    cartoon/3D feel; if a flatter top-down read is ever preferred for the
    locator, that's a one-line change.
  - `.agents`/`.claude` skill scripts trip `no-require-imports` /
    `react-hooks` lint errors. They're external tooling (untracked), not app
    code — left as-is rather than widening eslint ignore in this task.
- **What I'd do differently:** Nothing structural. The custom style is verbose
  but that's inherent to art-directing a vector basemap; it's well-commented and
  isolated in `lib/mapStyle.ts`.

## 2026-06-06 — Louder cartoon palette + warm height-graded buildings

- **What changed:** Tuned `lib/mapStyle.ts` only (no logic touched). The first
  cartoon style read too subtle, so the palette is now louder: bright pool-blue
  water, punchy mint greens/grass, candy-orange motorways, fuller flat-fill
  opacities. Buildings are now **height-graded** ("toy model"): cream for short
  buildings → peach → terracotta for towers (`fill-extrusion-color` interpolated
  on `render_height` with four stops), and the extrusion is taller (× 1.4 → 2.3)
  and fully opaque (0.9 → 1).
- **Why:** User compared a subtle (A) vs a loud all-pink (B) render and chose
  "louder, but retune the hue" (pink fought the blue brand pins). Warm
  height-graded buildings keep B's punch and 3D drama while complementing the
  warm land and leaving the blue pins as the loudest thing on the map.
- **How verified:** Built two standalone MapLibre harnesses (Node 24 type-strip
  import of `cartoonStyle`, Chromium via the vendored playwright-skill) and
  screenshotted A/B/final at an identical oblique London camera + a top-down
  view of the Airdrie seed area. `pnpm tsc --noEmit` clean. Renders in
  `.screenshots/`: `compare-A.png`, `compare-B.png`, `compare-C.png`,
  `compare-C-town.png`.
- **Unsure about / flagged for review:** Building hue is a one-line palette swap
  (`buildingLow/Mid/Tall/XTall`) if terracotta isn't the wanted vibe. The town
  overview has no tall buildings, so the 3D toy effect there is colour/greenery
  only — expected (height data is city-centric).
- **What I'd do differently:** Nothing — palette-only, fully reversible.

## 2026-06-06 — Search accepts UK towns + geolocation in-flight guard

- **What changed:** `components/LocatorControls.tsx` only. The location box now
  geocodes towns as well as postcodes: input is routed by a loose UK-postcode
  regex — postcode-shaped queries hit postcodes.io `/postcodes/:pc`, everything
  else hits `/places?q=` (response is an array; best match first), each falling
  back to the other on a miss. Failure copy is no longer postcode-specific.
  "Use my location" gained a `locating` state (button disabled + spinner +
  "Locating…" while a fix is pending) and explicit geolocation options
  (`enableHighAccuracy`, 10s timeout, `maximumAge: 0`).
- **Why:** Typing a town previously dead-ended with "postcode not found"
  despite the placeholder promising towns; the location button could fire
  overlapping geolocation requests with no feedback.
- **How verified:** postcodes.io `/places` shape confirmed live (Airdrie,
  Manchester, Glasgow resolve; junk → empty array) before wiring. Full browser
  pass after merge: town search "Airdrie" resolves with no error hint
  (`verify-2-town-search.png`). `pnpm tsc --noEmit` clean.
- **Unsure about / flagged for review:** postcodes.io places coverage is OS
  Open Names — solid for towns/villages, but street-level queries won't match
  (by design; this is a town/postcode finder). Nominatim fallback was
  considered and not needed.
- **What I'd do differently:** Nothing; single-file change, same provider, no
  new dependency.

## 2026-06-06 — List-view drawer, no-location empty state, smooth fly-in, loading fix

- **What changed:** `Locator.tsx`, `ShopMap.tsx`, `ResultsPill.tsx`, new
  `ShopList.tsx`. (1) Fixed the stuck-forever "Searching nearby…" when "use my
  location" resolved to identical coords twice: a `fetchNonce` joined the fetch
  effect deps so a same-coords request still completes the load cycle;
  re-selecting the current radius is now a no-op. (2) New `hasLocation` state:
  until the user picks a location the map sits on the Airdrie default with shop
  pins but NO radius ring and NO "you are here" dot, and never auto-pans.
  (3) On a new centre the map now does a smooth close fly-in (`flyTo`, zoom
  14.5, 1.2s, pitch/bearing kept); radius-only changes still `fitBounds` to
  frame the ring. (4) The ResultsPill "List view" stub is now real: a left-edge
  sliding drawer (`ShopList`) listing matching shops — name, distance, address,
  per-brand cheapest-price chips; clicking a row selects + pans + opens the
  popup and keeps the drawer open.
- **Why:** Four user-reported issues: town search dead-end aside, the locator
  showed a misleading "you are here" before any location was given, double
  geolocation froze the UI, results were map-only, and recentring was a
  zoomed-out frame instead of an arrival.
- **How verified:** 10/10 automated Playwright checks against the dev server
  (initial pins-but-no-dot state, town search, geolocate twice without
  sticking, drawer open/rows, row click → popup; screenshots
  `verify-1…6*.png` in `.screenshots/`). `pnpm tsc --noEmit` clean.
- **Unsure about / flagged for review:** The drawer overlaps the top-left
  controls card when open (z-modal above z-sticky) — intentional, since it has
  its own close button, but worth a design pass on small screens. The
  implementing agent hit a session-token limit right at the finish; all code
  was complete, and the orchestrator ran the verification pass.
- **What I'd do differently:** Run agent verification before the final
  report step so a late crash can't orphan an unverified diff.

## 2026-06-06 — Mobile UI: Apple Maps–style layout (Variant A)

- What changed: Added `MobileSearchPill.tsx` (glass floating search pill + GPS button) and `MobileBottomSheet.tsx` (peek/half bottom sheet with list + detail views). Wired into `Locator.tsx` via `sm:hidden` / `hidden sm:block` — mobile shows the new components, desktop keeps the existing card + drawer chrome. `ShopMap.tsx`: popup wrapped in `hidden sm:block` (desktop-only; mobile uses the sheet detail view instead), zoom controls shifted from `bottom-[40px]` to `bottom-[106px] sm:bottom-[40px]` to sit above the peek sheet. `SiteFooter` wrapped in `hidden sm:block` so the map fills the full viewport on mobile.
- Why: Full Apple Maps–style mobile redesign from `Mobile Locator.html` Variant A. Two parallel subagents built the components, then wired by hand to ensure prop interfaces were consistent.
- Unsure about / flagged for review: (1) Compliance footer hidden on mobile — age gate still shows, but footer text isn't visible while using the locator. (2) `top-[18px]` for the pill assumes web context — a PWA needs `env(safe-area-inset-top)` to clear the notch. (3) `Mobile Locator.html` sits in the repo root — should be gitignored or moved to `design/`. (4) Bottom sheet `h-[460px]` is fixed — on very short phones the list may not scroll comfortably.
- What I'd do differently: Should have specified `top-[18px]` in the agent prompt instead of leaving the iOS frame offset (`top-[66px]`) to be fixed post-hoc.

## 2026-06-06 — Re-centre fix (split effects) + UK map bounds

- What changed: `ShopMap.tsx` — split the combined ring/marker/camera effect into two focused effects: Effect A handles ring geometry, visibility, and user dot (no camera); Effect B fires only on `recenterKey` changes and calls `flyTo` using coord refs so lat/lng are NOT in its dep array. This guarantees the flyTo always fires on explicit location requests (GPS, search, repeated taps after panning) without being confused by radius changes or other dep noise. Also added `maxBounds: [[-10.5, 49.5], [2.2, 61.5]]` and `minZoom: 5` to the map init so users can't pan outside UK waters.
- Why: "Use my location" was not re-centring the map after panning away. Root cause: the previous `prevRecenterKeyRef` mechanism lived in a single effect with many deps; if any other dep changed between taps, the ref was updated without firing flyTo, so the next tap saw a matching ref and skipped the animation. Separating camera into its own effect with a minimal dep array (`[map, ready, hasLocation, recenterKey]`) removes the interference.
- Unsure about / flagged for review: `maxBounds` clips at 2.2°E which cuts off a small strip east of the UK coast — unlikely to matter for the use case but worth checking if Channel Tunnel / ferry port searches ever come up.
- What I'd do differently: Should have used the split-effect pattern from the start rather than the `prevRecenterKeyRef` approach.

## 2026-06-06 — Mobile footer + re-centre fix

- What changed: `SiteFooter.tsx` — mobile shows a single compact line ("18+ only · Tobacco-free pouches · Not a shop · © findsnus") via `sm:hidden`; full compliance text is `hidden sm:block`; standalone copyright hidden on mobile to avoid duplication; `py-2 sm:py-3` trims vertical padding. `ShopMap.tsx` + `Locator.tsx` — added `recenterKey` state (bumped on every explicit location request) and `prevRecenterKeyRef` in ShopMap; any location action now always triggers `flyTo` before falling through to the existing `centerChanged`/`fitBounds` logic, so tapping "Use my location" re-centres the map even when GPS returns the same fix.
- Why: Footer was ~90px tall on mobile, visibly shrinking the map area. Re-centre was broken when panning away and tapping "Use my location" a second time with the same GPS fix.
- Unsure about / flagged for review: The `centerChanged` branch after the `keyChanged` early-return is now technically unreachable for explicit location requests — it only fires on radius-only changes. Worth a cleanup pass later if the recenter logic grows more complex.
- What I'd do differently: Nothing significant.
