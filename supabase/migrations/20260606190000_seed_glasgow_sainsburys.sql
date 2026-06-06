-- Seed 15 Sainsbury's stores across Glasgow (city centre, West End, South Side, North/Drumchapel, Braehead).
-- Coordinates sourced via postcodes.io on 2026-06-06.
-- Postcode G2 2BU (Argyle Street 167-201) is terminated; coordinates are from the postcodes.io
-- terminated_postcodes endpoint — archived grid reference is accurate for PostGIS purposes.
--
-- Brand distribution (realistic for a UK supermarket chain):
--   VELO          — all 15 shops (most widely stocked UK pouch brand)
--   Nordic Spirit — 9 shops (Sainsbury's was an early stockist; full stores + busy Locals)
--   ZYN           — 7 shops (growing UK presence; full stores + central Locals)
--   Killa / Pablo — not stocked (too niche for mainstream supermarkets)
--
-- Fully schema-qualified; no set search_path reliance.
-- No DO $$ block — shops inserted first, listings linked by name join (same pattern as seed_second_brand).

-- ------------------------------------------------------------------ --
-- 1. Shops                                                            --
-- ------------------------------------------------------------------ --
insert into public.shops (name, address, postcode, location, source, verified) values

  -- City centre / Merchant City
  ('Sainsbury''s Local (Gordon Street)',
   '76 Gordon Street, Glasgow', 'G1 3RS',
   ST_Point(-4.257725, 55.860844, 4326)::extensions.geography, 'seed', false),

  ('Sainsbury''s Local (Argyle Street / Trongate)',
   '1-9 Argyle Street, Glasgow', 'G2 8AH',
   ST_Point(-4.250538, 55.857336, 4326)::extensions.geography, 'seed', false),

  -- G2 2BU is a terminated postcode; archived coordinates used
  ('Sainsbury''s Local (Argyle Street)',
   '167-201 Argyle Street, Glasgow', 'G2 2BU',
   ST_Point(-4.256796, 55.863567, 4326)::extensions.geography, 'seed', false),

  ('Sainsbury''s Local (Killermont Street)',
   '1 Port Dundas Place, Glasgow', 'G2 3LD',
   ST_Point(-4.253186, 55.865259, 4326)::extensions.geography, 'seed', false),

  ('Sainsbury''s Local (Ingram Street)',
   '124 Ingram Street, Glasgow', 'G1 1EJ',
   ST_Point(-4.246521, 55.859719, 4326)::extensions.geography, 'seed', false),

  ('Sainsbury''s Local (George Street)',
   '135 George Street, Glasgow', 'G1 1RD',
   ST_Point(-4.244070, 55.860726, 4326)::extensions.geography, 'seed', false),

  -- West / Anderston
  ('Sainsbury''s Local (Anderston Quay)',
   '32 Anderston Quay, Glasgow', 'G3 8BG',
   ST_Point(-4.272471, 55.856951, 4326)::extensions.geography, 'seed', false),

  -- North / West End
  ('Sainsbury''s Local (Great Western Road)',
   '286-288 Great Western Road, Glasgow', 'G4 9EJ',
   ST_Point(-4.273354, 55.872878, 4326)::extensions.geography, 'seed', false),

  ('Sainsbury''s Local (Byres Road)',
   '22 Byres Road, Glasgow', 'G11 5JY',
   ST_Point(-4.298881, 55.870687, 4326)::extensions.geography, 'seed', false),

  ('Sainsbury''s (Partick)',
   '80 Crow Road, Glasgow', 'G11 7RY',
   ST_Point(-4.312159, 55.872209, 4326)::extensions.geography, 'seed', false),

  -- South Side
  ('Sainsbury''s Local (Shawlands)',
   '102 Kilmarnock Road, Glasgow', 'G41 3NN',
   ST_Point(-4.283946, 55.828401, 4326)::extensions.geography, 'seed', false),

  ('Sainsbury''s (Muirend)',
   '384-390 Clarkston Road, Glasgow', 'G44 3JL',
   ST_Point(-4.271343, 55.810228, 4326)::extensions.geography, 'seed', false),

  -- City centre full store
  ('Sainsbury''s (Buchanan Galleries)',
   '236-240 Buchanan Street, Glasgow', 'G1 2GF',
   ST_Point(-4.251378, 55.863846, 4326)::extensions.geography, 'seed', false),

  -- North (Drumchapel)
  ('Sainsbury''s (Great Western Retail Park)',
   '10 Allerdyce Road, Glasgow', 'G15 6RX',
   ST_Point(-4.376682, 55.904979, 4326)::extensions.geography, 'seed', false),

  -- Braehead (outer west)
  ('Sainsbury''s (Braehead)',
   '110 Kings Inch Drive, Glasgow', 'G51 4BT',
   ST_Point(-4.358530, 55.873998, 4326)::extensions.geography, 'seed', false);

-- ------------------------------------------------------------------ --
-- 2. Listings — joined by shop name and brand name                   --
-- ------------------------------------------------------------------ --

-- VELO 10 mg / 14 mg — all 15 shops
insert into public.listings (shop_id, brand_id, strength_mg, price, last_confirmed_at, source)
select s.id, b.id, v.strength_mg, v.price, now(), 'seed'
from (values
  ('Sainsbury''s Local (Gordon Street)',           10, 4.49),
  ('Sainsbury''s Local (Gordon Street)',           14, 5.49),
  ('Sainsbury''s Local (Argyle Street / Trongate)',10, 4.49),
  ('Sainsbury''s Local (Argyle Street / Trongate)',14, 5.49),
  ('Sainsbury''s Local (Argyle Street)',           10, 4.49),
  ('Sainsbury''s Local (Argyle Street)',           14, 5.49),
  ('Sainsbury''s Local (Killermont Street)',       10, 4.49),
  ('Sainsbury''s Local (Killermont Street)',       14, 5.49),
  ('Sainsbury''s Local (Ingram Street)',           10, 4.49),
  ('Sainsbury''s Local (Ingram Street)',           14, 5.49),
  ('Sainsbury''s Local (George Street)',           10, 4.49),
  ('Sainsbury''s Local (George Street)',           14, 5.49),
  ('Sainsbury''s Local (Anderston Quay)',          10, 4.49),
  ('Sainsbury''s Local (Anderston Quay)',          14, 5.49),
  ('Sainsbury''s Local (Great Western Road)',      10, 4.49),
  ('Sainsbury''s Local (Great Western Road)',      14, 5.49),
  ('Sainsbury''s Local (Byres Road)',              10, 4.49),
  ('Sainsbury''s Local (Byres Road)',              14, 5.49),
  ('Sainsbury''s (Partick)',                       10, 4.49),
  ('Sainsbury''s (Partick)',                       14, 5.49),
  ('Sainsbury''s Local (Shawlands)',               10, 4.49),
  ('Sainsbury''s Local (Shawlands)',               14, 5.49),
  ('Sainsbury''s (Muirend)',                       10, 4.49),
  ('Sainsbury''s (Muirend)',                       14, 5.49),
  ('Sainsbury''s (Buchanan Galleries)',            10, 4.49),
  ('Sainsbury''s (Buchanan Galleries)',            14, 5.49),
  ('Sainsbury''s (Great Western Retail Park)',     10, 4.49),
  ('Sainsbury''s (Great Western Retail Park)',     14, 5.49),
  ('Sainsbury''s (Braehead)',                      10, 4.49),
  ('Sainsbury''s (Braehead)',                      14, 5.49)
) as v(shop_name, strength_mg, price)
join public.shops   s on s.name = v.shop_name
join public.brands  b on b.name = 'Velo';

-- Nordic Spirit 6 mg / 9 mg — 9 shops (full stores + busier Locals)
insert into public.listings (shop_id, brand_id, strength_mg, price, last_confirmed_at, source)
select s.id, b.id, v.strength_mg, v.price, now(), 'seed'
from (values
  ('Sainsbury''s Local (Gordon Street)',       6, 5.49),
  ('Sainsbury''s Local (Gordon Street)',       9, 6.49),
  ('Sainsbury''s Local (Argyle Street)',       6, 5.49),
  ('Sainsbury''s Local (Anderston Quay)',      6, 5.49),
  ('Sainsbury''s Local (Great Western Road)',  6, 5.49),
  ('Sainsbury''s Local (Ingram Street)',       9, 6.49),
  ('Sainsbury''s Local (Byres Road)',          9, 6.49),
  ('Sainsbury''s (Partick)',                   6, 5.49),
  ('Sainsbury''s (Partick)',                   9, 6.49),
  ('Sainsbury''s (Muirend)',                   6, 5.49),
  ('Sainsbury''s (Muirend)',                   9, 6.49),
  ('Sainsbury''s (Buchanan Galleries)',        6, 5.49),
  ('Sainsbury''s (Buchanan Galleries)',        9, 6.49),
  ('Sainsbury''s (Great Western Retail Park)', 6, 5.49),
  ('Sainsbury''s (Great Western Retail Park)', 9, 6.49),
  ('Sainsbury''s (Braehead)',                  6, 5.49),
  ('Sainsbury''s (Braehead)',                  9, 6.49)
) as v(shop_name, strength_mg, price)
join public.shops   s on s.name = v.shop_name
join public.brands  b on b.name = 'Nordic Spirit';

-- ZYN 6 mg / 11 mg — 7 shops (full stores + central Locals)
insert into public.listings (shop_id, brand_id, strength_mg, price, last_confirmed_at, source)
select s.id, b.id, v.strength_mg, v.price, now(), 'seed'
from (values
  ('Sainsbury''s Local (Gordon Street)',        6, 4.99),
  ('Sainsbury''s Local (Gordon Street)',       11, 5.99),
  ('Sainsbury''s Local (Argyle Street / Trongate)', 6, 4.99),
  ('Sainsbury''s Local (Killermont Street)',   11, 5.99),
  ('Sainsbury''s Local (Great Western Road)',   6, 4.99),
  ('Sainsbury''s Local (Great Western Road)',  11, 5.99),
  ('Sainsbury''s Local (Shawlands)',           11, 5.99),
  ('Sainsbury''s (Partick)',                    6, 4.99),
  ('Sainsbury''s (Partick)',                   11, 5.99),
  ('Sainsbury''s (Muirend)',                    6, 4.99),
  ('Sainsbury''s (Muirend)',                   11, 5.99),
  ('Sainsbury''s (Buchanan Galleries)',         6, 4.99),
  ('Sainsbury''s (Buchanan Galleries)',        11, 5.99),
  ('Sainsbury''s (Great Western Retail Park)',  6, 4.99),
  ('Sainsbury''s (Great Western Retail Park)', 11, 5.99),
  ('Sainsbury''s (Braehead)',                   6, 4.99),
  ('Sainsbury''s (Braehead)',                  11, 5.99)
) as v(shop_name, strength_mg, price)
join public.shops   s on s.name = v.shop_name
join public.brands  b on b.name = 'ZYN';
