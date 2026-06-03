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
  location   geography(Point, 4326) not null,
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
-- put the bouncer on the door for all three tables
alter table brands   enable row level security;
alter table shops    enable row level security;
alter table listings enable row level security;

-- the only name on the guest list: anyone may read
create policy "public read brands"
  on brands for select to anon, authenticated using (true);

create policy "public read shops"
  on shops for select to anon, authenticated using (true);

create policy "public read listings"
  on listings for select to anon, authenticated using (true);