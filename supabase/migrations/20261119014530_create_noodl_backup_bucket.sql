-- The Worker uses a server key. Browser roles get no storage policy here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('noodl-backups', 'noodl-backups', false, 8388608, array['application/json'])
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1
    from storage.buckets
    where id = 'noodl-backups'
      and (name is distinct from 'noodl-backups'
        or public is distinct from false
        or file_size_limit is distinct from 8388608
        or allowed_mime_types is distinct from array['application/json'])
  ) then
    raise exception 'Existing noodl-backups bucket has conflicting settings';
  end if;
end
$$;
