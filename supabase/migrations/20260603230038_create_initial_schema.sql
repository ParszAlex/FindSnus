-- The PostGIS `geography` type is schema-qualified below (extensions.geography)
-- so it resolves without touching search_path. Do NOT add `set search_path to
-- extensions, ...` here: it would make unqualified `create table` land these
-- tables in `extensions` instead of `public`, hiding them from the Data API.

-- brands first (listings will reference it)
create table brands (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table shops (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text not null,
  postcode   text not null,
  location   extensions.geography(Point, 4326) not null,
  source     text not null check (source in ('seed','community')),
  verified   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shops_location_idx on shops using gist (location);

create table listings (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references shops(id) on delete cascade,
  brand_id          uuid not null references brands(id) on delete restrict,
  strength_mg       int  not null,
  price             numeric(5,2) not null,
  last_confirmed_at timestamptz  not null,
  source            text not null check (source in ('seed','community')),
  created_at        timestamptz  not null default now(),
  unique (shop_id, brand_id, strength_mg)
);

-- RLS (enable + read-only policies) lives in the next migration,
-- 20260603230602_enable_rls_read_only.sql.