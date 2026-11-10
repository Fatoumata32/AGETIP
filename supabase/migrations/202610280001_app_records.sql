create table public.app_records (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('incident', 'operational', 'toner_movement')),
  record_key text not null,
  payload jsonb not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_type, record_key)
);

create index app_records_type_idx on public.app_records (record_type);

alter table public.app_records enable row level security;

grant select, insert, update, delete on public.app_records to authenticated;

create policy "Authenticated users can read app records"
  on public.app_records for select to authenticated
  using (true);

create policy "Admins and technicians can create operational app records"
  on public.app_records for insert to authenticated
  with check (
    (select public.has_role(array['admin']))
    or (
      (select public.has_role(array['technician']))
      and (
        record_type in ('incident', 'toner_movement')
        or (record_type = 'operational' and payload ->> 'module' <> 'Factures SONATEL')
      )
    )
    or (
      (select public.has_role(array['finance']))
      and record_type = 'operational'
      and payload ->> 'module' = 'Factures SONATEL'
    )
  );

create policy "Authorized users can update app records"
  on public.app_records for update to authenticated
  using (
    (select public.has_role(array['admin']))
    or (
      (select public.has_role(array['technician']))
      and (
        record_type in ('incident', 'toner_movement')
        or (record_type = 'operational' and payload ->> 'module' <> 'Factures SONATEL')
      )
    )
    or (
      (select public.has_role(array['finance']))
      and record_type = 'operational'
      and payload ->> 'module' = 'Factures SONATEL'
    )
  )
  with check (
    (select public.has_role(array['admin']))
    or (
      (select public.has_role(array['technician']))
      and (
        record_type in ('incident', 'toner_movement')
        or (record_type = 'operational' and payload ->> 'module' <> 'Factures SONATEL')
      )
    )
    or (
      (select public.has_role(array['finance']))
      and record_type = 'operational'
      and payload ->> 'module' = 'Factures SONATEL'
    )
  );

create policy "Authorized users can delete app records"
  on public.app_records for delete to authenticated
  using (
    (select public.has_role(array['admin']))
    or (
      (select public.has_role(array['technician']))
      and (
        record_type in ('incident', 'toner_movement')
        or (record_type = 'operational' and payload ->> 'module' <> 'Factures SONATEL')
      )
    )
    or (
      (select public.has_role(array['finance']))
      and record_type = 'operational'
      and payload ->> 'module' = 'Factures SONATEL'
    )
  );
