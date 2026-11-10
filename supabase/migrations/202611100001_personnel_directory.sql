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
    'document',
    'personnel'
  ));

create policy "Authenticated users can read personnel records"
  on public.app_records for select to authenticated
  using (record_type = 'personnel');

create policy "Admins can manage personnel records"
  on public.app_records for all to authenticated
  using (
    record_type = 'personnel'
    and (select public.has_role(array['admin']))
  )
  with check (
    record_type = 'personnel'
    and (select public.has_role(array['admin']))
  );
