-- Seed a second brand (Velo) with varied stock and prices, so the upcoming
-- comparison UI has real cross-brand / cross-price data to compare against the
-- monochrome Nordic Spirit seed (20260603235303, immutable — already on remote).
--
-- Fully schema-qualified throughout; no `set search_path` reliance (Bug-2 lesson).
-- Links listings to shops by NAME (no hardcoded uuids), mirroring the NS seed.
--
-- NOTE: prices are representative UK values for portfolio realism, NOT
-- live-verified retail prices.

-- a) brand (idempotent, same pattern as the NS seed)
insert into public.brands (name) values ('Velo') on conflict (name) do nothing;

-- b) listings: exactly 5 Velo rows across the 4 existing shops.
--    Distribution:
--      - High St      : 6mg + 10mg   (stocks both)
--      - Gartlea Rd    : 6mg + 10mg   (stocks both)
--      - Connor St     : 6mg only
--      - Coatbridge    : no Velo
--    Velo 6mg is a different price at each stocking shop (5.49 / 5.50 / 5.95);
--    Velo 10mg is 5.75 / 6.10 at the two shops that carry it.
--    One row per (shop, brand, strength) — respects unique(shop_id,brand_id,strength_mg).
insert into public.listings (shop_id, brand_id, strength_mg, price, last_confirmed_at, source)
select s.id, b.id, v.strength_mg, v.price, now(), 'seed'
from (values
  ('Tesco Express (High St)',       6,  5.49),
  ('Tesco Express (High St)',       10, 5.75),
  ('Tesco Superstore (Gartlea Rd)', 6,  5.50),
  ('Tesco Superstore (Gartlea Rd)', 10, 6.10),
  ('Tesco Express (Connor St)',     6,  5.95)
) as v(shop_name, strength_mg, price)
join public.shops s on s.name = v.shop_name
join public.brands b on b.name = 'Velo';
