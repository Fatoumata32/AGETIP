create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role text not null default 'reader'
    check (role in ('admin', 'technician', 'finance', 'reader')),
  created_at timestamptz not null default now()
);

create or replace function public.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_user_profile();

create or replace function public.has_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = (select auth.uid())
      and role = any (required_roles)
  );
$$;

revoke all on function public.has_role(text[]) from public, anon;
grant execute on function public.has_role(text[]) to authenticated;

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  designation text not null,
  category text not null,
  assigned_to text not null default '',
  status text not null default 'En service',
  location text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.incidents (
  id text primary key,
  reported_at timestamptz not null,
  reporter text not null,
  classification text not null check (classification in ('Critique', 'Majeur', 'Mineur')),
  type text not null,
  equipment_id uuid references public.equipment (id) on delete set null,
  equipment_label text not null default '',
  description text not null,
  cause text not null default '',
  recorded_by text not null default '',
  assignee text not null default '',
  taken_at timestamptz,
  treatments text not null default '',
  closed boolean not null default false,
  closed_at timestamptz,
  observations text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sonatel_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  received_at date not null,
  billed_period text not null,
  category text not null,
  description text not null,
  amount_xof numeric(14, 2) not null check (amount_xof >= 0),
  status text not null default 'À valider',
  source_file text,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.toner_items (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  designation text not null,
  compatibility text not null default '',
  quantity integer not null default 0 check (quantity >= 0),
  minimum_quantity integer not null default 0 check (minimum_quantity >= 0),
  updated_at timestamptz not null default now()
);

create table public.toner_movements (
  id uuid primary key default gen_random_uuid(),
  toner_item_id uuid not null references public.toner_items (id) on delete restrict,
  movement_type text not null check (movement_type in ('entrée', 'sortie', 'ajustement')),
  quantity integer not null check (quantity > 0),
  reason text not null,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);

create table public.maintenance_interventions (
  id text primary key,
  equipment_id uuid references public.equipment (id) on delete set null,
  equipment_label text not null default '',
  description text not null,
  scheduled_at date,
  completed_at date,
  status text not null default 'Planifiée',
  provider text not null default '',
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reference_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text not null,
  storage_path text,
  mime_type text not null,
  indexed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index incidents_reported_at_idx on public.incidents (reported_at);
create index incidents_equipment_id_idx on public.incidents (equipment_id);
create index sonatel_invoices_received_at_idx on public.sonatel_invoices (received_at);
create index maintenance_scheduled_at_idx on public.maintenance_interventions (scheduled_at);
create index toner_movements_item_date_idx on public.toner_movements (toner_item_id, occurred_at);

alter table public.user_profiles enable row level security;
alter table public.equipment enable row level security;
alter table public.incidents enable row level security;
alter table public.sonatel_invoices enable row level security;
alter table public.toner_items enable row level security;
alter table public.toner_movements enable row level security;
alter table public.maintenance_interventions enable row level security;
alter table public.reference_documents enable row level security;

create policy "Users can read their own profile; admins can read all"
  on public.user_profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.has_role(array['admin'])));
create policy "Admins can update profiles"
  on public.user_profiles for update to authenticated
  using ((select public.has_role(array['admin'])))
  with check ((select public.has_role(array['admin'])));

create policy "Authenticated users can read equipment"
  on public.equipment for select to authenticated using (true);
create policy "Technicians and admins can manage equipment"
  on public.equipment for all to authenticated
  using ((select public.has_role(array['admin', 'technician'])))
  with check ((select public.has_role(array['admin', 'technician'])));

create policy "Authenticated users can read incidents"
  on public.incidents for select to authenticated using (true);
create policy "Technicians and admins can create incidents"
  on public.incidents for insert to authenticated
  with check ((select public.has_role(array['admin', 'technician'])));
create policy "Technicians and admins can update incidents"
  on public.incidents for update to authenticated
  using ((select public.has_role(array['admin', 'technician'])))
  with check ((select public.has_role(array['admin', 'technician'])));
create policy "Admins can delete incidents"
  on public.incidents for delete to authenticated
  using ((select public.has_role(array['admin'])));

create policy "Finance and admins can read SONATEL invoices"
  on public.sonatel_invoices for select to authenticated
  using ((select public.has_role(array['admin', 'finance'])));
create policy "Finance and admins can manage SONATEL invoices"
  on public.sonatel_invoices for all to authenticated
  using ((select public.has_role(array['admin', 'finance'])))
  with check ((select public.has_role(array['admin', 'finance'])));

create policy "Authenticated users can read toner inventory"
  on public.toner_items for select to authenticated using (true);
create policy "Technicians and admins can manage toner inventory"
  on public.toner_items for all to authenticated
  using ((select public.has_role(array['admin', 'technician'])))
  with check ((select public.has_role(array['admin', 'technician'])));
create policy "Authenticated users can read toner movements"
  on public.toner_movements for select to authenticated using (true);
create policy "Technicians and admins can record toner movements"
  on public.toner_movements for insert to authenticated
  with check ((select public.has_role(array['admin', 'technician'])));

create policy "Authenticated users can read maintenance"
  on public.maintenance_interventions for select to authenticated using (true);
create policy "Technicians and admins can manage maintenance"
  on public.maintenance_interventions for all to authenticated
  using ((select public.has_role(array['admin', 'technician'])))
  with check ((select public.has_role(array['admin', 'technician'])));

create policy "Authenticated users can read document metadata"
  on public.reference_documents for select to authenticated using (true);
create policy "Technicians and admins can manage document metadata"
  on public.reference_documents for all to authenticated
  using ((select public.has_role(array['admin', 'technician'])))
  with check ((select public.has_role(array['admin', 'technician'])));
