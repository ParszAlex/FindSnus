set search_path to extensions, public;

-- a) brand (idempotent)
insert into brands (name) values ('Nordic Spirit') on conflict (name) do nothing;

-- b) shops
insert into shops (name, address, postcode, location, source, verified) values
  ('Tesco Express (High St)',      '24 High St, Airdrie',        'ML6 0DT', ST_SetSRID(ST_MakePoint(-3.9856818, 55.8681451),4326)::geography, 'seed', true),
  ('Tesco Express (Connor St)',    'Connor St, Airdrie',         'ML6 7AY', ST_SetSRID(ST_MakePoint(-3.9457004, 55.8710121),4326)::geography, 'seed', true),
  ('Tesco Superstore (Gartlea Rd)','Gartlea Rd, Airdrie',        'ML6 9JB', ST_SetSRID(ST_MakePoint(-3.9781575, 55.8631116),4326)::geography, 'seed', true),
  ('Tesco Extra (Coatbridge)',     'Faraday Retail Pk, Coatbridge','ML5 3SQ', ST_SetSRID(ST_MakePoint(-4.0226843, 55.8594188),4326)::geography, 'seed', true);

-- c) listings: Nordic Spirit 6/9/11 mg @ £6.50 at every shop (12 rows)
insert into listings (shop_id, brand_id, strength_mg, price, last_confirmed_at, source)
select s.id, b.id, v.strength_mg, 6.50, now(), 'seed'
from shops s
cross join (values (6),(9),(11)) as v(strength_mg)
join brands b on b.name = 'Nordic Spirit'
where s.name in (
  'Tesco Express (High St)','Tesco Express (Connor St)',
  'Tesco Superstore (Gartlea Rd)','Tesco Extra (Coatbridge)'
);
