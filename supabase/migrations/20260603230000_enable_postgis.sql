-- PostGIS must exist before the schema migration creates a geography column.
-- Installed into the `extensions` schema (Supabase convention) so it stays out
-- of `public`. A clean replay (db reset) has no extensions until this runs.
create extension if not exists postgis with schema extensions;
