-- PressingPro CI — profil créé à l'inscription client
--
-- L'inscription e-mail transmet le nom et le téléphone des dépôts dans les
-- métadonnées Supabase Auth. Le déclencheur d'origine ne lisait que le nom et
-- le téléphone d'une inscription par SMS. Cette migration conserve aussi le
-- téléphone déclaré à l'inscription e-mail afin que le pressing puisse le
-- contrôler avant de créer une liaison `customer_account_links`.
--
-- Important : `profiles.phone_e164` reste une coordonnée déclarée. Elle ne
-- remplace ni la vérification du pressing ni `verified_phone_e164`.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  insert into public.profiles (user_id, display_name, phone_e164)
  values (
    new.id,
    nullif(
      btrim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          ''
        )
      ),
      ''
    ),
    case
      when new.phone ~ '^\+[1-9][0-9]{6,14}$' then new.phone
      when new.raw_user_meta_data ->> 'phone_e164' ~ '^\+[1-9][0-9]{6,14}$'
        then new.raw_user_meta_data ->> 'phone_e164'
      when new.raw_user_meta_data ->> 'phone' ~ '^\+[1-9][0-9]{6,14}$'
        then new.raw_user_meta_data ->> 'phone'
      else null
    end
  )
  on conflict (user_id) do update
  set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    phone_e164 = coalesce(public.profiles.phone_e164, excluded.phone_e164),
    updated_at = case
      when public.profiles.display_name is null and excluded.display_name is not null
        then now()
      when public.profiles.phone_e164 is null and excluded.phone_e164 is not null
        then now()
      else public.profiles.updated_at
    end;

  return new;
end;
$$;

revoke all on function private.handle_new_user()
  from public, anon, authenticated;
grant execute on function private.handle_new_user() to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant usage on schema private to supabase_auth_admin';
    execute 'grant execute on function private.handle_new_user() to supabase_auth_admin';
  end if;
end;
$$;
