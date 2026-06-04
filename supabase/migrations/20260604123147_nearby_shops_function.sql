create or replace function public.nearby_shops(
  in_lat       double precision,
  in_lng       double precision,
  in_radius_km double precision default 10
)
returns table (
  id         uuid,
  name       text,
  address    text,
  postcode   text,
  lat        double precision,
  lng        double precision,
  verified   boolean,
  distance_m double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id,
    s.name,
    s.address,
    s.postcode,
    extensions.ST_Y(s.location::extensions.geometry) as lat,
    extensions.ST_X(s.location::extensions.geometry) as lng,
    s.verified,
    extensions.ST_Distance(
      s.location,
      extensions.ST_SetSRID(extensions.ST_MakePoint(in_lng, in_lat), 4326)::extensions.geography
    ) as distance_m
  from public.shops s
  where extensions.ST_DWithin(
    s.location,
    extensions.ST_SetSRID(extensions.ST_MakePoint(in_lng, in_lat), 4326)::extensions.geography,
    in_radius_km * 1000
  )
  order by distance_m asc;
$$;

grant execute on function public.nearby_shops(double precision, double precision, double precision)
  to anon, authenticated;
