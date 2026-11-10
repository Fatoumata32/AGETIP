alter table public.app_records
  drop constraint if exists app_records_record_type_check;

alter table public.app_records
  add constraint app_records_record_type_check
  check (record_type in (
    'incident',
    'operational',
    'toner_movement',
    'notification_preferences',
    'report_history',
    'assistant_chat',
    'document'
  ));

drop policy if exists "Authenticated users can read app records" on public.app_records;
create policy "Authenticated users can read app records"
  on public.app_records for select to authenticated
  using (
    record_type in ('incident', 'operational', 'toner_movement', 'document')
    or created_by = (select auth.uid())
  );

drop policy if exists "Admins and technicians can create operational app records" on public.app_records;
create policy "Authorized users can create app records"
  on public.app_records for insert to authenticated
  with check (
    (
      record_type in ('notification_preferences', 'report_history', 'assistant_chat')
      and created_by = (select auth.uid())
    )
    or (
      record_type = 'document'
      and (select public.has_role(array['admin', 'technician']))
      and created_by = (select auth.uid())
    )
    or (select public.has_role(array['admin']))
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

drop policy if exists "Authorized users can update app records" on public.app_records;
create policy "Authorized users can update app records"
  on public.app_records for update to authenticated
  using (
    (
      record_type in ('notification_preferences', 'report_history', 'assistant_chat')
      and created_by = (select auth.uid())
    )
    or (
      record_type = 'document'
      and (select public.has_role(array['admin', 'technician']))
    )
    or (select public.has_role(array['admin']))
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
    (
      record_type in ('notification_preferences', 'report_history', 'assistant_chat')
      and created_by = (select auth.uid())
    )
    or (
      record_type = 'document'
      and (select public.has_role(array['admin', 'technician']))
    )
    or (select public.has_role(array['admin']))
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

drop policy if exists "Authorized users can delete app records" on public.app_records;
create policy "Authorized users can delete app records"
  on public.app_records for delete to authenticated
  using (
    (
      record_type in ('notification_preferences', 'report_history', 'assistant_chat')
      and created_by = (select auth.uid())
    )
    or (
      record_type = 'document'
      and (select public.has_role(array['admin', 'technician']))
    )
    or (select public.has_role(array['admin']))
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agetip-documents',
  'agetip-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can read AGETIP documents" on storage.objects;
create policy "Authenticated users can read AGETIP documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'agetip-documents');

drop policy if exists "Technicians and admins can upload AGETIP documents" on storage.objects;
create policy "Technicians and admins can upload AGETIP documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'agetip-documents'
    and (select public.has_role(array['admin', 'technician']))
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Technicians and admins can update AGETIP documents" on storage.objects;
create policy "Technicians and admins can update AGETIP documents"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'agetip-documents'
    and (select public.has_role(array['admin', 'technician']))
  )
  with check (
    bucket_id = 'agetip-documents'
    and (select public.has_role(array['admin', 'technician']))
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Technicians and admins can delete AGETIP documents" on storage.objects;
create policy "Technicians and admins can delete AGETIP documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'agetip-documents'
    and (select public.has_role(array['admin', 'technician']))
  );
