-- PressingPro CI — Administration plateforme réservée au super-admin.
--
-- Les pressings et blanchisseries inscrits sont des clients de la plateforme.
-- Cette migration donne à leur éditeur les moyens de gérer abonnements,
-- suspension, support et configuration globale, sans ouvrir les commandes
-- métier au super-admin et sans permettre à un tenant de s'attribuer ce rôle.

-- ---------------------------------------------------------------------------
-- 1. Un seul super-admin actif, aucune inscription via l'application
-- ---------------------------------------------------------------------------

create unique index platform_admins_single_active_uq
  on public.platform_admins (is_active)
  where is_active;

-- ---------------------------------------------------------------------------
-- 2. Configuration globale et notes internes de support
-- ---------------------------------------------------------------------------

create table public.platform_config (
  id smallint primary key default 1 check (id = 1),
  registrations_open boolean not null default true,
  support_message text not null default '' check (length(support_message) <= 500),
  support_message_tone text not null default 'info'
    check (support_message_tone in ('info', 'warning', 'critical')),
  updated_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_config (id) values (1);

alter table public.platform_config enable row level security;
alter table public.platform_config force row level security;

create table public.platform_support_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid,
  author_user_id uuid references public.profiles(user_id) on delete set null,
  category text not null check (category in ('support', 'configuration')),
  note text not null check (length(btrim(note)) between 2 and 4000),
  created_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete cascade
);

create index platform_support_notes_org_created_idx
  on public.platform_support_notes (organization_id, created_at desc);

alter table public.platform_support_notes enable row level security;
alter table public.platform_support_notes force row level security;

-- Aucune lecture/écriture directe : les RPC ci-dessous filtrent et journalisent.
revoke all on public.platform_config from public, anon, authenticated;
revoke all on public.platform_support_notes from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Le verrouillage d'un compte est appliqué par les helpers RLS existants
-- ---------------------------------------------------------------------------

create or replace function private.has_organization_access(
  target_organization_id uuid,
  allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select exists (
    select 1
    from public.organizations o
    join public.memberships m
      on m.organization_id = o.id
    where o.id = target_organization_id
      and o.status = 'active'
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

create or replace function private.has_shop_access(
  target_shop_id uuid,
  allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select exists (
    select 1
    from public.shops s
    join public.organizations o
      on o.id = s.organization_id
     and o.status = 'active'
    join public.memberships m
      on m.organization_id = s.organization_id
     and (m.shop_id is null or m.shop_id = s.id)
    where s.id = target_shop_id
      and s.status = 'active'
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

-- Fermer les nouvelles inscriptions ne ferme ni Auth ni les comptes existants :
-- seule la création d'une organisation par un utilisateur est bloquée.
create or replace function private.enforce_platform_registration()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_open boolean;
begin
  if auth.uid() is not null and not private.is_platform_admin() then
    select registrations_open into v_open
      from public.platform_config where id = 1;
    if not coalesce(v_open, true) then
      raise exception 'Les nouvelles inscriptions de pressings sont temporairement fermées'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_platform_registration() from public, anon, authenticated;

drop trigger if exists enforce_platform_registration on public.organizations;
create trigger enforce_platform_registration
before insert on public.organizations
for each row execute function private.enforce_platform_registration();

-- ---------------------------------------------------------------------------
-- 4. Lecture publique limitée à l'annonce de support
-- ---------------------------------------------------------------------------

create or replace function public.get_platform_public_config()
returns jsonb
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select jsonb_build_object(
    'registrations_open', registrations_open,
    'support_message', support_message,
    'support_message_tone', support_message_tone,
    'updated_at', updated_at
  )
  from public.platform_config
  where id = 1;
$$;

revoke all on function public.get_platform_public_config() from public, anon;
grant execute on function public.get_platform_public_config() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Vue d'administration : comptes clients, jamais commandes ni données métier
-- ---------------------------------------------------------------------------

create or replace function public.get_platform_admin_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = private, pg_catalog
as $$
declare
  v_config jsonb;
  v_organizations jsonb;
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Accès réservé au super-admin de la plateforme'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'registrations_open', registrations_open,
    'support_message', support_message,
    'support_message_tone', support_message_tone,
    'updated_at', updated_at
  ) into v_config
  from public.platform_config
  where id = 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'slug', o.slug,
        'status', o.status,
        'created_at', o.created_at,
        'owner', (
          select jsonb_build_object(
            'user_id', owner_membership.user_id,
            'display_name', owner_profile.display_name,
            'email', owner_auth.email
          )
          from public.memberships owner_membership
          join public.profiles owner_profile
            on owner_profile.user_id = owner_membership.user_id
          left join auth.users owner_auth
            on owner_auth.id = owner_membership.user_id
          where owner_membership.organization_id = o.id
            and owner_membership.role = 'organization_owner'
          order by owner_membership.created_at
          limit 1
        ),
        'shops', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', s.id,
                'name', s.name,
                'slug', s.slug,
                'status', s.status,
                'city', s.city,
                'phone_display', s.phone_display,
                'email', s.email,
                'subscription', jsonb_build_object(
                  'plan', coalesce(sub.plan, 'free'),
                  'status', coalesce(sub.status, 'essai'),
                  'requested_plan', sub.requested_plan,
                  'requested_at', sub.requested_at,
                  'trial_started_at', sub.trial_started_at,
                  'renews_on', sub.renews_on
                )
              ) order by s.name
            ),
            '[]'::jsonb
          )
          from public.shops s
          left join public.shop_subscriptions sub on sub.shop_id = s.id
          where s.organization_id = o.id
        ),
        'support_notes', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', n.id,
                'shop_id', n.shop_id,
                'category', n.category,
                'note', n.note,
                'created_at', n.created_at
              ) order by n.created_at desc
            ),
            '[]'::jsonb
          )
          from public.platform_support_notes n
          where n.organization_id = o.id
        )
      ) order by o.created_at desc
    ),
    '[]'::jsonb
  ) into v_organizations
  from public.organizations o;

  return jsonb_build_object(
    'config', coalesce(v_config, public.get_platform_public_config()),
    'organizations', v_organizations
  );
end;
$$;

revoke all on function public.get_platform_admin_snapshot() from public, anon;
grant execute on function public.get_platform_admin_snapshot() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Actions réservées et journalisées
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_shop_subscription(
  p_shop_id uuid,
  p_plan text,
  p_status text,
  p_renews_on date default null,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = private, pg_catalog
as $$
declare
  v_subscription public.shop_subscriptions%rowtype;
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Accès réservé au super-admin de la plateforme'
      using errcode = '42501';
  end if;
  if p_plan not in ('free', 'pro', 'business') then
    raise exception 'Formule inconnue : %', coalesce(p_plan, '(vide)')
      using errcode = '22023';
  end if;
  if p_status not in ('essai', 'actif', 'suspendu') then
    raise exception 'Statut d’abonnement inconnu : %', coalesce(p_status, '(vide)')
      using errcode = '22023';
  end if;
  if length(coalesce(p_note, '')) > 1000 then
    raise exception 'La note est limitée à 1000 caractères' using errcode = '22023';
  end if;

  update public.shop_subscriptions
     set plan = p_plan,
         status = p_status,
         renews_on = p_renews_on,
         requested_plan = null,
         requested_at = null
   where shop_id = p_shop_id
  returning * into v_subscription;

  if not found then
    raise exception 'Abonnement introuvable pour cette agence' using errcode = 'P0002';
  end if;

  insert into public.audit_log (
    organization_id, shop_id, actor_user_id, actor_type,
    action, resource_type, resource_id, metadata
  ) values (
    v_subscription.organization_id, p_shop_id, auth.uid(), 'platform',
    'platform.subscription_updated', 'shop_subscription', p_shop_id,
    jsonb_build_object(
      'plan', p_plan, 'status', p_status,
      'renews_on', p_renews_on, 'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  return public.get_platform_admin_snapshot();
end;
$$;

revoke all on function public.admin_set_shop_subscription(uuid, text, text, date, text) from public, anon;
grant execute on function public.admin_set_shop_subscription(uuid, text, text, date, text)
  to authenticated, service_role;

create or replace function public.admin_set_organization_status(
  p_organization_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = private, pg_catalog
as $$
declare
  v_organization public.organizations%rowtype;
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Accès réservé au super-admin de la plateforme'
      using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Utilisez active ou suspended pour administrer ce compte'
      using errcode = '22023';
  end if;
  if p_status = 'suspended' and length(btrim(coalesce(p_note, ''))) < 2 then
    raise exception 'Indiquez le motif du verrouillage' using errcode = '22023';
  end if;
  if length(coalesce(p_note, '')) > 1000 then
    raise exception 'Le motif est limité à 1000 caractères' using errcode = '22023';
  end if;

  update public.organizations
     set status = p_status
   where id = p_organization_id
  returning * into v_organization;
  if not found then
    raise exception 'Organisation introuvable' using errcode = 'P0002';
  end if;

  insert into public.audit_log (
    organization_id, shop_id, actor_user_id, actor_type,
    action, resource_type, resource_id, metadata
  ) values (
    p_organization_id, null, auth.uid(), 'platform',
    'platform.organization_status_updated', 'organization', p_organization_id,
    jsonb_build_object('status', p_status, 'note', nullif(btrim(coalesce(p_note, '')), ''))
  );

  return public.get_platform_admin_snapshot();
end;
$$;

revoke all on function public.admin_set_organization_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_organization_status(uuid, text, text)
  to authenticated, service_role;

create or replace function public.admin_add_support_note(
  p_organization_id uuid,
  p_category text,
  p_note text,
  p_shop_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = private, pg_catalog
as $$
declare
  v_note public.platform_support_notes%rowtype;
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Accès réservé au super-admin de la plateforme'
      using errcode = '42501';
  end if;
  if p_category not in ('support', 'configuration') then
    raise exception 'Catégorie de note inconnue' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_note, ''))) not between 2 and 4000 then
    raise exception 'La note doit contenir entre 2 et 4000 caractères'
      using errcode = '22023';
  end if;
  if p_shop_id is not null and not exists (
    select 1 from public.shops s
    where s.id = p_shop_id and s.organization_id = p_organization_id
  ) then
    raise exception 'Cette agence n’appartient pas à l’organisation indiquée'
      using errcode = '22023';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception 'Organisation introuvable' using errcode = 'P0002';
  end if;

  insert into public.platform_support_notes (
    organization_id, shop_id, author_user_id, category, note
  ) values (
    p_organization_id, p_shop_id, auth.uid(), p_category, btrim(p_note)
  ) returning * into v_note;

  insert into public.audit_log (
    organization_id, shop_id, actor_user_id, actor_type,
    action, resource_type, resource_id, metadata
  ) values (
    p_organization_id, p_shop_id, auth.uid(), 'platform',
    'platform.support_note_added', 'platform_support_note', v_note.id,
    jsonb_build_object('category', p_category)
  );

  return public.get_platform_admin_snapshot();
end;
$$;

revoke all on function public.admin_add_support_note(uuid, text, text, uuid) from public, anon;
grant execute on function public.admin_add_support_note(uuid, text, text, uuid)
  to authenticated, service_role;

create or replace function public.admin_update_platform_config(
  p_registrations_open boolean,
  p_support_message text,
  p_support_message_tone text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = private, pg_catalog
as $$
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Accès réservé au super-admin de la plateforme'
      using errcode = '42501';
  end if;
  if p_registrations_open is null then
    raise exception 'Le réglage des inscriptions est obligatoire' using errcode = '22023';
  end if;
  if p_support_message_tone not in ('info', 'warning', 'critical') then
    raise exception 'Niveau d’annonce inconnu' using errcode = '22023';
  end if;
  if length(coalesce(p_support_message, '')) > 500 then
    raise exception 'L’annonce est limitée à 500 caractères' using errcode = '22023';
  end if;

  update public.platform_config
     set registrations_open = p_registrations_open,
         support_message = btrim(coalesce(p_support_message, '')),
         support_message_tone = p_support_message_tone,
         updated_by = auth.uid(),
         updated_at = now()
   where id = 1;

  insert into public.audit_log (
    organization_id, shop_id, actor_user_id, actor_type,
    action, resource_type, resource_id, metadata
  ) values (
    null, null, auth.uid(), 'platform',
    'platform.config_updated', 'platform_config', null,
    jsonb_build_object(
      'registrations_open', p_registrations_open,
      'support_message_tone', p_support_message_tone,
      'support_message_present', length(btrim(coalesce(p_support_message, ''))) > 0
    )
  );

  return public.get_platform_admin_snapshot();
end;
$$;

revoke all on function public.admin_update_platform_config(boolean, text, text) from public, anon;
grant execute on function public.admin_update_platform_config(boolean, text, text)
  to authenticated, service_role;
