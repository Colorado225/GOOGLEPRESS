-- PressingPro CI — persistance durable des espaces de travail réels.
-- Migration additive : aucune table existante n'est supprimée ou réécrite.
-- Les instantanés sont accessibles uniquement aux membres actifs de l'agence,
-- section par section. Le super-admin plateforme n'a aucun accès implicite.

create table public.workspace_snapshots (
  shop_id uuid primary key,
  organization_id uuid not null,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  created_by uuid references public.profiles(user_id) on delete set null,
  updated_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete cascade,
  check (jsonb_typeof(data) = 'object')
);

alter table public.workspace_snapshots enable row level security;
alter table public.workspace_snapshots force row level security;
revoke all on public.workspace_snapshots from public, anon, authenticated;
grant select, insert, update on public.workspace_snapshots to service_role;

comment on table public.workspace_snapshots is
  'Sauvegarde métier JSON par agence, relue via RPC avec permissions par section. Aucun accès super-admin implicite.';

create or replace function private.can_sync_workspace_section(
  target_shop_id uuid,
  section text,
  for_write boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = private, pg_catalog
as $$
begin
  if not private.has_shop_access(target_shop_id) then
    return false;
  end if;

  if for_write then
    case section
      when 'customers', 'cashRegister', 'nextTicketNumber' then
        return private.has_shop_access(
          target_shop_id, array['organization_owner', 'shop_manager', 'cashier']
        );
      when 'orders', 'logisticsTasks' then
        return private.has_shop_access(
          target_shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
        );
      when 'stockMovements' then
        return private.has_shop_access(
          target_shop_id, array['organization_owner', 'shop_manager', 'workshop']
        );
      when 'employees', 'attendanceRecords', 'products', 'expenses', 'expenseCategories' then
        return private.has_shop_access(
          target_shop_id, array['organization_owner', 'shop_manager']
        );
      else
        return false;
    end case;
  end if;

  case section
    when 'customers', 'cashRegister', 'nextTicketNumber' then
      return private.has_shop_access(
        target_shop_id, array['organization_owner', 'shop_manager', 'cashier']
      );
    when 'orders', 'logisticsTasks', 'employees', 'products', 'stockMovements' then
      return private.has_shop_access(
        target_shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
      );
    when 'attendanceRecords', 'expenses', 'expenseCategories' then
      return private.has_shop_access(
        target_shop_id, array['organization_owner', 'shop_manager']
      );
    else
      return false;
  end case;
end;
$$;

revoke all on function private.can_sync_workspace_section(uuid, text, boolean)
from public, anon;
grant execute on function private.can_sync_workspace_section(uuid, text, boolean)
to authenticated;

create or replace function public.get_workspace_snapshot(target_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = private, pg_catalog
as $$
declare
  v_snapshot public.workspace_snapshots%rowtype;
  v_data jsonb := '{}'::jsonb;
  v_visible jsonb := '{}'::jsonb;
  v_permissions jsonb := '{}'::jsonb;
  v_section text;
  v_sections constant text[] := array[
    'customers', 'orders', 'cashRegister', 'nextTicketNumber', 'logisticsTasks',
    'employees', 'attendanceRecords', 'products', 'stockMovements',
    'expenses', 'expenseCategories'
  ];
begin
  if auth.uid() is null or not private.has_shop_access(target_shop_id) then
    raise exception 'Agence introuvable ou inaccessible' using errcode = '42501';
  end if;

  select * into v_snapshot
  from public.workspace_snapshots
  where shop_id = target_shop_id;

  if found then
    if v_snapshot.organization_id <> (
      select organization_id from public.shops where id = target_shop_id
    ) then
      raise exception 'Périmètre de sauvegarde incohérent' using errcode = '42501';
    end if;
    v_data := v_snapshot.data;
  end if;

  foreach v_section in array v_sections loop
    v_permissions := v_permissions || jsonb_build_object(
      v_section,
      jsonb_build_object(
        'read', private.can_sync_workspace_section(target_shop_id, v_section, false),
        'write', private.can_sync_workspace_section(target_shop_id, v_section, true)
      )
    );

    if private.can_sync_workspace_section(target_shop_id, v_section, false) then
      v_visible := v_visible || jsonb_build_object(
        v_section,
        coalesce(
          v_data -> v_section,
          case
            when v_section = 'cashRegister' then '{}'::jsonb
            when v_section = 'nextTicketNumber' then '1'::jsonb
            else '[]'::jsonb
          end
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'data', v_visible,
    'permissions', v_permissions,
    'version', case when found then v_snapshot.version else 0 end,
    'updatedAt', case when found then v_snapshot.updated_at else null end
  );
end;
$$;

revoke all on function public.get_workspace_snapshot(uuid) from public, anon;
grant execute on function public.get_workspace_snapshot(uuid) to authenticated, service_role;

create or replace function public.save_workspace_snapshot(
  target_shop_id uuid,
  patch jsonb,
  expected_version bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = private, pg_catalog
as $$
declare
  v_snapshot public.workspace_snapshots%rowtype;
  v_organization_id uuid;
  v_section text;
  v_value jsonb;
  v_sections constant text[] := array[
    'customers', 'orders', 'cashRegister', 'nextTicketNumber', 'logisticsTasks',
    'employees', 'attendanceRecords', 'products', 'stockMovements',
    'expenses', 'expenseCategories'
  ];
  v_saved_sections text[] := '{}';
  v_version bigint;
  v_saved_at timestamptz;
begin
  if auth.uid() is null or not private.has_shop_access(target_shop_id) then
    raise exception 'Agence introuvable ou inaccessible' using errcode = '42501';
  end if;
  if patch is null or jsonb_typeof(patch) <> 'object' or patch = '{}'::jsonb then
    raise exception 'Une section de sauvegarde non vide est requise' using errcode = '22023';
  end if;
  if expected_version is null or expected_version < 0 then
    raise exception 'Version de sauvegarde invalide' using errcode = '22023';
  end if;
  if length(patch::text) > 8000000 then
    raise exception 'La sauvegarde dépasse la taille maximale de 8 Mo' using errcode = '22023';
  end if;

  select organization_id into v_organization_id
  from public.shops
  where id = target_shop_id;
  if not found then
    raise exception 'Agence introuvable' using errcode = '42501';
  end if;

  for v_section in select jsonb_object_keys(patch) loop
    if not v_section = any(v_sections) then
      raise exception 'Section de sauvegarde inconnue : %', v_section using errcode = '22023';
    end if;
    if not private.can_sync_workspace_section(target_shop_id, v_section, true) then
      raise exception 'Votre rôle ne permet pas d’enregistrer la section %', v_section
        using errcode = '42501';
    end if;

    v_value := patch -> v_section;
    if v_section = 'cashRegister' then
      if jsonb_typeof(v_value) <> 'object' then
        raise exception 'La caisse doit être un objet' using errcode = '22023';
      end if;
    elsif v_section = 'nextTicketNumber' then
      if jsonb_typeof(v_value) <> 'number'
         or (v_value::text)::numeric < 1
         or (v_value::text)::numeric > 1000000000
         or (v_value::text)::numeric <> trunc((v_value::text)::numeric) then
        raise exception 'Le compteur de tickets est invalide' using errcode = '22023';
      end if;
    else
      if jsonb_typeof(v_value) <> 'array' or jsonb_array_length(v_value) > 5000 then
        raise exception 'La section % doit être une liste de 5000 éléments au maximum', v_section
          using errcode = '22023';
      end if;
      if exists (
        select 1
        from jsonb_array_elements(v_value) as item(value)
        where jsonb_typeof(item.value) <> 'object'
           or jsonb_typeof(item.value -> 'id') is distinct from 'string'
           or length(item.value ->> 'id') not between 1 and 160
      ) then
        raise exception 'Chaque élément de % doit avoir un identifiant texte valide', v_section
          using errcode = '22023';
      end if;
    end if;
    v_saved_sections := array_append(v_saved_sections, v_section);
  end loop;

  -- Sérialise aussi la toute première écriture de deux appareils : le second
  -- attend puis reçoit un conflit de version au lieu d'un doublon de clé.
  perform pg_advisory_xact_lock(
    hashtext('pressingpro:workspace_snapshot:' || target_shop_id::text)
  );

  select * into v_snapshot
  from public.workspace_snapshots
  where shop_id = target_shop_id
  for update;

  if found then
    if v_snapshot.version <> expected_version then
      raise exception 'Conflit de version : rechargez la sauvegarde avant de réessayer'
        using errcode = 'P0002';
    end if;
    v_version := v_snapshot.version + 1;
    v_saved_at := now();
    update public.workspace_snapshots
    set data = v_snapshot.data || patch,
        version = v_version,
        updated_by = auth.uid(),
        updated_at = v_saved_at
    where shop_id = target_shop_id;
  else
    if expected_version <> 0 then
      raise exception 'Conflit de version : la sauvegarde a été recréée, rechargez-la'
        using errcode = 'P0002';
    end if;
    v_version := 1;
    v_saved_at := now();
    insert into public.workspace_snapshots (
      shop_id, organization_id, data, version, created_by, updated_by, created_at, updated_at
    ) values (
      target_shop_id, v_organization_id, patch, v_version,
      auth.uid(), auth.uid(), v_saved_at, v_saved_at
    );
  end if;

  return jsonb_build_object(
    'version', v_version,
    'savedAt', v_saved_at,
    'sections', to_jsonb(v_saved_sections)
  );
end;
$$;

revoke all on function public.save_workspace_snapshot(uuid, jsonb, bigint) from public, anon;
grant execute on function public.save_workspace_snapshot(uuid, jsonb, bigint)
to authenticated, service_role;
