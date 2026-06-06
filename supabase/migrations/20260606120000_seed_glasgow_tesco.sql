-- Seed 10 Tesco Express stores in and around Glasgow city centre, each with
-- a realistic spread of nicotine pouch brand listings.
--
-- Coordinates sourced from postcodes.io on 2026-06-06.
-- G1 1DU returned a terminated-postcode result; its archived coordinates are used.
--
-- Brand distribution rationale:
--   VELO   — most widely stocked (all 10 shops)
--   ZYN    — common (6 of 10 shops)
--   Killa  — less common (4 of 10 shops)
--   Pablo  — least common (3 of 10 shops)
--
-- Fully schema-qualified where it matters; no `set search_path` at file level
-- (same convention as 20260603230038_create_initial_schema.sql).

do $$
declare
  -- shop IDs
  v_hope_st        uuid := gen_random_uuid();
  v_argyle_st      uuid := gen_random_uuid();
  v_byres_rd       uuid := gen_random_uuid();
  v_victoria_rd    uuid := gen_random_uuid();
  v_high_st        uuid := gen_random_uuid();
  v_cowcaddens     uuid := gen_random_uuid();
  v_maryhill       uuid := gen_random_uuid();
  v_paisley_rd     uuid := gen_random_uuid();
  v_duke_st        uuid := gen_random_uuid();
  v_dumbarton_rd   uuid := gen_random_uuid();

  -- brand IDs (looked up once)
  v_velo   uuid;
  v_zyn    uuid;
  v_killa  uuid;
  v_pablo  uuid;

begin

  -- ------------------------------------------------------------------ --
  -- 1. Resolve brand IDs                                                --
  -- ------------------------------------------------------------------ --
  select id into v_velo  from public.brands where name = 'VELO';
  select id into v_zyn   from public.brands where name = 'ZYN';
  select id into v_killa from public.brands where name = 'Killa';
  select id into v_pablo from public.brands where name = 'Pablo';

  -- ------------------------------------------------------------------ --
  -- 2. Insert shops                                                     --
  -- ------------------------------------------------------------------ --
  insert into public.shops (id, name, address, postcode, location, source, verified) values

    -- G2 6AB  lat=55.859093  lng=-4.259604
    (v_hope_st,
     'Tesco Express (Hope Street)',
     'Hope Street, Glasgow',
     'G2 6AB',
     ST_Point(-4.259604, 55.859093, 4326)::extensions.geography,
     'seed', false),

    -- G2 8BH  lat=55.858217  lng=-4.253961
    (v_argyle_st,
     'Tesco Express (Argyle Street)',
     'Argyle Street, Glasgow',
     'G2 8BH',
     ST_Point(-4.253961, 55.858217, 4326)::extensions.geography,
     'seed', false),

    -- G12 8TS  lat=55.873793  lng=-4.295691
    (v_byres_rd,
     'Tesco Express (Byres Road)',
     'Byres Road, Glasgow',
     'G12 8TS',
     ST_Point(-4.295691, 55.873793, 4326)::extensions.geography,
     'seed', false),

    -- G42 7AD  lat=55.842786  lng=-4.261805
    (v_victoria_rd,
     'Tesco Express (Victoria Road)',
     'Victoria Road, Glasgow',
     'G42 7AD',
     ST_Point(-4.261805, 55.842786, 4326)::extensions.geography,
     'seed', false),

    -- G1 1DU  lat=55.859398  lng=-4.249331  (terminated postcode — archived coords used)
    (v_high_st,
     'Tesco Express (High Street)',
     'High Street, Glasgow',
     'G1 1DU',
     ST_Point(-4.249331, 55.859398, 4326)::extensions.geography,
     'seed', false),

    -- G4 0HT  lat=55.868517  lng=-4.252975
    (v_cowcaddens,
     'Tesco Express (Cowcaddens Road)',
     'Cowcaddens Road, Glasgow',
     'G4 0HT',
     ST_Point(-4.252975, 55.868517, 4326)::extensions.geography,
     'seed', false),

    -- G20 7AA  lat=55.880827  lng=-4.273115
    (v_maryhill,
     'Tesco Express (Maryhill Road)',
     'Maryhill Road, Glasgow',
     'G20 7AA',
     ST_Point(-4.273115, 55.880827, 4326)::extensions.geography,
     'seed', false),

    -- G51 1JY  lat=55.853884  lng=-4.281799
    (v_paisley_rd,
     'Tesco Express (Paisley Road West)',
     'Paisley Road West, Glasgow',
     'G51 1JY',
     ST_Point(-4.281799, 55.853884, 4326)::extensions.geography,
     'seed', false),

    -- G31 1RD  lat=55.858521  lng=-4.219990
    (v_duke_st,
     'Tesco Express (Duke Street)',
     'Duke Street, Glasgow',
     'G31 1RD',
     ST_Point(-4.219990, 55.858521, 4326)::extensions.geography,
     'seed', false),

    -- G11 5QN  lat=55.871958  lng=-4.301098
    (v_dumbarton_rd,
     'Tesco Express (Dumbarton Road)',
     'Dumbarton Road, Glasgow',
     'G11 5QN',
     ST_Point(-4.301098, 55.871958, 4326)::extensions.geography,
     'seed', false);

  -- ------------------------------------------------------------------ --
  -- 3. Insert listings                                                  --
  --                                                                     --
  -- VELO  (10 mg / 14 mg)  £3.99–£5.49  — all 10 shops                 --
  -- ZYN   (6 mg / 11 mg)   £4.49–£5.99  — 6 shops                      --
  -- Killa (16 mg / 24 mg)  £4.99–£6.49  — 4 shops                      --
  -- Pablo (20 mg / 50 mg)  £5.49–£6.99  — 3 shops                      --
  -- ------------------------------------------------------------------ --

  insert into public.listings
    (shop_id, brand_id, strength_mg, price, last_confirmed_at, source)
  values
    -- ── Hope Street (G2 6AB): VELO + ZYN + Killa + Pablo ──────────── --
    (v_hope_st, v_velo,  10, 3.99, now(), 'seed'),
    (v_hope_st, v_velo,  14, 4.99, now(), 'seed'),
    (v_hope_st, v_zyn,    6, 4.49, now(), 'seed'),
    (v_hope_st, v_zyn,   11, 5.49, now(), 'seed'),
    (v_hope_st, v_killa, 16, 5.49, now(), 'seed'),
    (v_hope_st, v_pablo, 20, 5.99, now(), 'seed'),

    -- ── Argyle Street (G2 8BH): VELO + ZYN ───────────────────────── --
    (v_argyle_st, v_velo, 10, 4.29, now(), 'seed'),
    (v_argyle_st, v_velo, 14, 5.29, now(), 'seed'),
    (v_argyle_st, v_zyn,   6, 4.99, now(), 'seed'),

    -- ── Byres Road (G12 8TS): VELO + ZYN + Killa ─────────────────── --
    (v_byres_rd, v_velo,  10, 4.49, now(), 'seed'),
    (v_byres_rd, v_velo,  14, 5.49, now(), 'seed'),
    (v_byres_rd, v_zyn,    6, 4.49, now(), 'seed'),
    (v_byres_rd, v_zyn,   11, 5.99, now(), 'seed'),
    (v_byres_rd, v_killa, 24, 6.49, now(), 'seed'),

    -- ── Victoria Road (G42 7AD): VELO only ────────────────────────── --
    (v_victoria_rd, v_velo, 10, 3.99, now(), 'seed'),
    (v_victoria_rd, v_velo, 14, 4.99, now(), 'seed'),

    -- ── High Street (G1 1DU): VELO + ZYN + Pablo ─────────────────── --
    (v_high_st, v_velo,  10, 4.29, now(), 'seed'),
    (v_high_st, v_velo,  14, 5.49, now(), 'seed'),
    (v_high_st, v_zyn,   11, 5.49, now(), 'seed'),
    (v_high_st, v_pablo, 20, 5.99, now(), 'seed'),
    (v_high_st, v_pablo, 50, 6.99, now(), 'seed'),

    -- ── Cowcaddens Road (G4 0HT): VELO + Killa ────────────────────── --
    (v_cowcaddens, v_velo,  10, 3.99, now(), 'seed'),
    (v_cowcaddens, v_velo,  14, 4.99, now(), 'seed'),
    (v_cowcaddens, v_killa, 16, 4.99, now(), 'seed'),
    (v_cowcaddens, v_killa, 24, 6.49, now(), 'seed'),

    -- ── Maryhill Road (G20 7AA): VELO only ────────────────────────── --
    (v_maryhill, v_velo, 10, 3.99, now(), 'seed'),

    -- ── Paisley Road West (G51 1JY): VELO + ZYN + Killa + Pablo ───── --
    (v_paisley_rd, v_velo,  10, 4.49, now(), 'seed'),
    (v_paisley_rd, v_velo,  14, 5.49, now(), 'seed'),
    (v_paisley_rd, v_zyn,    6, 4.49, now(), 'seed'),
    (v_paisley_rd, v_zyn,   11, 5.99, now(), 'seed'),
    (v_paisley_rd, v_killa, 16, 5.49, now(), 'seed'),
    (v_paisley_rd, v_pablo, 50, 6.99, now(), 'seed'),

    -- ── Duke Street (G31 1RD): VELO + ZYN ────────────────────────── --
    (v_duke_st, v_velo, 10, 4.29, now(), 'seed'),
    (v_duke_st, v_velo, 14, 5.49, now(), 'seed'),
    (v_duke_st, v_zyn,  11, 5.49, now(), 'seed'),

    -- ── Dumbarton Road (G11 5QN): VELO + Pablo ────────────────────── --
    (v_dumbarton_rd, v_velo,  10, 4.49, now(), 'seed'),
    (v_dumbarton_rd, v_velo,  14, 5.49, now(), 'seed'),
    (v_dumbarton_rd, v_pablo, 20, 5.99, now(), 'seed');

end $$;
