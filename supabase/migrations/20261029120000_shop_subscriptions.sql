-- PressingPro — Abonnement et essai côté serveur.
--
-- Objectif : la formule, l'essai de 14 jours et les quotas ne vivent plus dans
-- le navigateur. Ils sont lisibles par l'agence, mais seul l'éditeur peut les
-- changer ; les quotas sont vérifiés par des triggers, donc impossibles à
-- contourner depuis le client.

-- ---------------------------------------------------------------------------
-- 1. Table d'abonnement (une ligne par agence)
-- ---------------------------------------------------------------------------

create table public.shop_subscriptions (
  shop_id uuid primary key,
  organization_id uuid not null,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  status text not null default 'essai'
    check (status in ('essai', 'actif', 'suspendu')),
  -- Date de départ de l'essai, fixée par le serveur : c'est elle qui rend le
  -- chronomètre infalsifiable.
  trial_started_at timestamptz not null default now(),
  -- Le client peut seulement *demander* une formule ; il ne l'applique pas.
  requested_plan text check (requested_plan in ('free', 'pro', 'business')),
  requested_at timestamptz,
  renews_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_subscriptions_shop_fk foreign key (organization_id, shop_id)
    references public.shops (organization_id, id) on delete restrict
);

create index shop_subscriptions_organization_idx
  on public.shop_subscriptions (organization_id);

create trigger set_updated_at_shop_subscriptions
before update on public.shop_subscriptions
for each row execute function private.set_updated_at();

alter table public.shop_subscriptions enable row level security;
alter table public.shop_subscriptions force row level security;

-- Lecture : tout membre actif de l'agence (l'écran Paramètres l'affiche).
create policy shop_subscriptions_select on public.shop_subscriptions
for select to authenticated
using (private.has_shop_access(shop_id));

-- Écriture : le propriétaire peut seulement déposer une demande. Les droits
-- par colonne (plus bas) interdisent de toucher à `plan`, `status` ou à la
-- date d'essai.
create policy shop_subscriptions_update on public.shop_subscriptions
for update to authenticated
using (private.has_shop_access(shop_id, array['organization_owner']))
with check (private.has_shop_access(shop_id, array['organization_owner']));

grant select on public.shop_subscriptions to authenticated;
grant update (requested_plan, requested_at) on public.shop_subscriptions to authenticated;
revoke all on public.shop_subscriptions from anon, public;

-- ---------------------------------------------------------------------------
-- 2. Création automatique et reprise des agences existantes
-- ---------------------------------------------------------------------------

create or replace function private.create_shop_subscription()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  insert into public.shop_subscriptions (shop_id, organization_id)
  values (new.id, new.organization_id)
  on conflict (shop_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_shop_subscription() from public, anon, authenticated;

drop trigger if exists create_shop_subscription_after_insert on public.shops;
create trigger create_shop_subscription_after_insert
after insert on public.shops
for each row execute function private.create_shop_subscription();

-- Chaque agence existante démarre son essai à la date de mise en service de
-- cette migration (pas de rétro-datation arbitraire, pas de perte de compteur).
insert into public.shop_subscriptions (shop_id, organization_id)
select s.id, s.organization_id from public.shops s
on conflict (shop_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Règles des formules, côté serveur
-- ---------------------------------------------------------------------------

create or replace function private.plan_limits(p_plan text)
returns table (max_users integer, max_orders_month integer, max_storage integer)
language sql
immutable
as $$
  select case p_plan when 'free' then 2 when 'pro' then 8 else null end,
         case p_plan when 'free' then 100 else null end,
         case p_plan when 'free' then 10 else null end;
$$;

revoke all on function private.plan_limits(text) from public, anon, authenticated;

-- Formule réellement appliquée : l'essai de 14 jours ouvre Pro à un compte
-- Free ; une formule suspendue retombe sur Free ; sans ligne, Free.
create or replace function private.effective_plan(
  p_shop_id uuid,
  p_now timestamptz default now()
)
returns text
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select coalesce(
    (
      select case
        when s.status = 'suspendu' then 'free'
        when s.plan <> 'free' then s.plan
        when p_now < s.trial_started_at + interval '14 days' then 'pro'
        else 'free'
      end
      from public.shop_subscriptions s
      where s.shop_id = p_shop_id
    ),
    'free'
  );
$$;

revoke all on function private.effective_plan(uuid, timestamptz) from public, anon;
grant execute on function private.effective_plan(uuid, timestamptz) to authenticated, service_role;

-- Formule la plus élevée de l'organisation (pour les quotas d'équipe, qui se
-- comptent au niveau de l'organisation et non d'une seule agence).
create or replace function private.organization_effective_plan(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select case
    when bool_or(private.effective_plan(s.id) = 'business') then 'business'
    when bool_or(private.effective_plan(s.id) = 'pro') then 'pro'
    else 'free'
  end
  from public.shops s
  where s.organization_id = p_organization_id;
$$;

revoke all on function private.organization_effective_plan(uuid) from public, anon;
grant execute on function private.organization_effective_plan(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Quotas appliqués en base (le client ne peut pas les contourner)
-- ---------------------------------------------------------------------------

-- Rangement : 10 emplacements en Free, illimité dès Pro.
create or replace function private.enforce_storage_quota()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_plan text := private.effective_plan(new.shop_id);
  v_limit integer;
  v_count integer;
begin
  select max_storage into v_limit from private.plan_limits(v_plan);
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_count
    from public.storage_locations
   where shop_id = new.shop_id;
  if v_count >= v_limit then
    raise exception
      'Formule % : % emplacements de rangement au maximum. Passez en Pro pour des casiers illimités.',
      v_plan, v_limit
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_storage_quota() from public, anon, authenticated;

drop trigger if exists enforce_storage_quota on public.storage_locations;
create trigger enforce_storage_quota
before insert on public.storage_locations
for each row execute function private.enforce_storage_quota();

-- Commandes : 100 par mois calendaire en Free.
create or replace function private.enforce_order_quota()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_plan text := private.effective_plan(new.shop_id);
  v_limit integer;
  v_count integer;
begin
  select max_orders_month into v_limit from private.plan_limits(v_plan);
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_count
    from public.orders
   where shop_id = new.shop_id
     and received_at >= date_trunc('month', now());
  if v_count >= v_limit then
    raise exception
      'Formule % : % commandes par mois au maximum. Passez en Pro pour continuer sans plafond.',
      v_plan, v_limit
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_order_quota() from public, anon, authenticated;

drop trigger if exists enforce_order_quota on public.orders;
create trigger enforce_order_quota
before insert on public.orders
for each row execute function private.enforce_order_quota();

-- Équipe : 2 comptes en Free, 8 en Pro, illimité en Business.
create or replace function private.enforce_membership_quota()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_plan text := private.organization_effective_plan(new.organization_id);
  v_limit integer;
  v_count integer;
begin
  if new.status <> 'active' then
    return new;
  end if;
  select max_users into v_limit from private.plan_limits(v_plan);
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_count
    from public.memberships
   where organization_id = new.organization_id
     and status = 'active';
  if v_count >= v_limit then
    raise exception
      'Formule % : % comptes au maximum. Changez de formule pour ajouter un membre.',
      v_plan, v_limit
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_membership_quota() from public, anon, authenticated;

drop trigger if exists enforce_membership_quota on public.memberships;
create trigger enforce_membership_quota
before insert on public.memberships
for each row execute function private.enforce_membership_quota();

-- ---------------------------------------------------------------------------
-- 5. État complet lu par l'application (une seule requête)
-- ---------------------------------------------------------------------------

-- `volatile` et non `stable` : la fonction complète la ligne manquante. En
-- pratique le trigger sur `public.shops` et la reprise ci-dessus la créent
-- toujours, mais une fonction qui écrit ne doit pas être déclarée stable.
create or replace function public.get_shop_subscription_state(p_shop_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = private, pg_catalog
as $$
declare
  v_sub public.shop_subscriptions%rowtype;
  v_effective text;
  v_limits record;
  v_members integer;
  v_orders integer;
  v_storage integer;
  v_trial_end timestamptz;
begin
  if auth.uid() is null or not private.has_shop_access(p_shop_id) then
    raise exception 'Accès refusé à cette agence' using errcode = '42501';
  end if;

  select * into v_sub from public.shop_subscriptions where shop_id = p_shop_id;
  if not found then
    insert into public.shop_subscriptions (shop_id, organization_id)
    select s.id, s.organization_id from public.shops s where s.id = p_shop_id
    returning * into v_sub;
  end if;

  v_effective := private.effective_plan(p_shop_id);
  select * into v_limits from private.plan_limits(v_effective);
  v_trial_end := v_sub.trial_started_at + interval '14 days';

  select count(*) into v_members
    from public.memberships
   where organization_id = v_sub.organization_id
     and status = 'active';
  select count(*) into v_orders
    from public.orders
   where shop_id = p_shop_id
     and received_at >= date_trunc('month', now());
  select count(*) into v_storage
    from public.storage_locations
   where shop_id = p_shop_id;

  return jsonb_build_object(
    'plan', v_sub.plan,
    'status', v_sub.status,
    'effective_plan', v_effective,
    'requested_plan', v_sub.requested_plan,
    'requested_at', v_sub.requested_at,
    'renews_on', v_sub.renews_on,
    'trial_started_at', v_sub.trial_started_at,
    'trial_ends_at', v_trial_end,
    'trial_active',
      v_sub.plan = 'free'
      and v_sub.status <> 'suspendu'
      and now() < v_trial_end,
    'trial_days_left',
      greatest(0, ceil(extract(epoch from (v_trial_end - now())) / 86400.0))::integer,
    'limits', jsonb_build_object(
      'users', v_limits.max_users,
      'orders_per_month', v_limits.max_orders_month,
      'storage_locations', v_limits.max_storage
    ),
    'usage', jsonb_build_object(
      'users', v_members,
      'orders_this_month', v_orders,
      'storage_locations', v_storage
    )
  );
end;
$$;

revoke all on function public.get_shop_subscription_state(uuid) from public, anon;
grant execute on function public.get_shop_subscription_state(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Demande de changement de formule
-- ---------------------------------------------------------------------------
-- Le propriétaire ne peut pas s'attribuer une formule : il dépose une demande
-- que l'éditeur applique. Le contrôle de rôle est fait ici, côté base, pour
-- qu'un appel direct à l'API ne puisse pas contourner l'écran.

create or replace function public.request_subscription_plan(
  p_shop_id uuid,
  p_plan text
)
returns jsonb
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'Connectez-vous pour demander une formule'
      using errcode = '42501';
  end if;
  if p_plan is null or p_plan not in ('free', 'pro', 'business') then
    raise exception 'Formule inconnue : %', coalesce(p_plan, '(vide)')
      using errcode = '22023';
  end if;
  if not private.has_shop_access(p_shop_id, array['organization_owner']) then
    raise exception 'Seul le propriétaire du pressing peut demander un changement de formule'
      using errcode = '42501';
  end if;

  update public.shop_subscriptions
     set requested_plan = p_plan,
         requested_at = now()
   where shop_id = p_shop_id;

  return public.get_shop_subscription_state(p_shop_id);
end;
$$;

revoke all on function public.request_subscription_plan(uuid, text) from public, anon;
grant execute on function public.request_subscription_plan(uuid, text)
  to authenticated, service_role;
