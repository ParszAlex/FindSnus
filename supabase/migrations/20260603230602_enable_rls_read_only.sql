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
