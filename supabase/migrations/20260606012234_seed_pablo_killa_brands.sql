-- Seed two more tobacco-free nicotine pouch brands, Pablo and Killa, into the
-- brand catalogue. Brands only — no shops and no listings are added here, so
-- with zero listings these brands are stocked nowhere yet (the UI derives its
-- visible brand set from existing listings, so they stay hidden until a listing
-- links them to a shop).
--
-- Fully schema-qualified; no `set search_path` reliance (Bug-2 lesson).
-- Idempotent: same `on conflict (name) do nothing` pattern as the Velo/NS seeds.

insert into public.brands (name) values ('Pablo') on conflict (name) do nothing;
insert into public.brands (name) values ('Killa') on conflict (name) do nothing;
