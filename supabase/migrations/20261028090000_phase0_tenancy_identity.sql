-- PressingPro CI — Phase 0, socle neuf (Option B)
-- ATTENTION : migration de conception/prototype. Ne pas appliquer à
-- Pressing_Pro sans décision et environnement de validation distincts.
-- Le schéma cible est Supabase/PostgreSQL : auth.users et auth.uid() existent.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = private, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon;
grant execute on function private.set_updated_at() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Comptes et administration plateforme
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  locale text not null default 'fr-CI',
  time_zone text not null default 'Africa/Abidjan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(user_id) on delete set null
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'closed')),
  country_code text not null default 'CI' check (country_code ~ '^[A-Z]{2}$'),
  default_currency text not null default 'XOF' check (default_currency = 'XOF'),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  public_slug text unique check (
    public_slug is null or public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'closed')),
  address text,
  city text,
  country_code text not null default 'CI' check (country_code ~ '^[A-Z]{2}$'),
  phone_display text,
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  opening_hours jsonb not null default '{}'::jsonb,
  time_zone text not null default 'Africa/Abidjan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  unique (organization_id, id)
);

create index shops_org_status_idx
  on public.shops (organization_id, status);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  legacy_id text,
  full_name text not null check (length(btrim(full_name)) between 1 and 160),
  phone_display text,
  position text not null check (length(btrim(position)) between 1 and 120),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'leave')),
  hired_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  unique (organization_id, shop_id, id)
);

create unique index employees_legacy_id_uq
  on public.employees (shop_id, legacy_id)
  where legacy_id is not null;
create index employees_shop_status_idx
  on public.employees (shop_id, status, full_name);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  shop_id uuid,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  employee_id uuid,
  role text not null check (
    role in ('organization_owner', 'shop_manager', 'cashier', 'workshop', 'courier')
  ),
  status text not null default 'active'
    check (status in ('invited', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  foreign key (organization_id, shop_id, employee_id)
    references public.employees(organization_id, shop_id, id)
    on delete set null (employee_id),
  check (employee_id is null or shop_id is not null),
  check (
    (role = 'organization_owner' and shop_id is null)
    or (role <> 'organization_owner' and shop_id is not null)
  )
);

create unique index memberships_user_scope_uq
  on public.memberships (
    user_id,
    organization_id,
    coalesce(shop_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index memberships_org_user_idx
  on public.memberships (organization_id, user_id, status);
create index memberships_shop_user_idx
  on public.memberships (shop_id, user_id, status)
  where shop_id is not null;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  shop_id uuid,
  email text,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  role text not null check (
    role in ('organization_owner', 'shop_manager', 'cashier', 'workshop', 'courier')
  ),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  invited_by uuid references public.profiles(user_id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  check (email is not null or phone_e164 is not null),
  check (accepted_at is null or revoked_at is null),
  check (
    (role = 'organization_owner' and shop_id is null)
    or (role <> 'organization_owner' and shop_id is not null)
  )
);

create index invitations_org_expiry_idx
  on public.invitations (organization_id, expires_at)
  where accepted_at is null and revoked_at is null;

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  employee_id uuid not null,
  business_date date not null,
  status text not null check (status in ('present', 'absent', 'leave', 'late')),
  arrival_time time,
  reason text,
  notes text,
  recorded_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id, employee_id)
    references public.employees(organization_id, shop_id, id) on delete restrict,
  unique (shop_id, employee_id, business_date)
);

create index attendance_shop_date_idx
  on public.attendance_records (shop_id, business_date, employee_id);

-- ---------------------------------------------------------------------------
-- Paramètres et catalogue par agence
-- ---------------------------------------------------------------------------

create table public.shop_settings (
  shop_id uuid primary key,
  organization_id uuid not null,
  tagline text not null default '',
  currency text not null default 'XOF' check (currency = 'XOF'),
  enable_sms boolean not null default false,
  enable_thermal_printer boolean not null default false,
  pickup_fee_xof bigint not null default 1000 check (pickup_fee_xof >= 0),
  delivery_fee_xof bigint not null default 1000 check (delivery_fee_xof >= 0),
  storage_assignment_required boolean not null default false,
  storage_allow_capacity_overflow boolean not null default true,
  storage_suggestions_enabled boolean not null default true,
  storage_default_capacity_packages integer not null default 20
    check (storage_default_capacity_packages between 1 and 999),
  messaging_business_hours jsonb not null default '{}'::jsonb,
  messaging_out_of_hours_message text,
  show_storage_code_to_customers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete cascade
);

create table public.service_catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  legacy_key text,
  name text not null check (length(btrim(name)) between 1 and 160),
  audience_category text not null default 'all'
    check (audience_category in ('all', 'men', 'women', 'home', 'pro')),
  service_category text not null
    check (service_category in ('pressing', 'blanchisserie', 'both')),
  pricing_type text not null check (pricing_type in ('unit', 'kilo')),
  unit_price_xof bigint not null check (unit_price_xof >= 0),
  unit_label text,
  icon_emoji text,
  image_url text,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  unique (organization_id, shop_id, id)
);

create unique index service_catalog_legacy_key_uq
  on public.service_catalog_items (shop_id, legacy_key)
  where legacy_key is not null;
create index service_catalog_shop_active_idx
  on public.service_catalog_items (shop_id, is_active, sort_order, name);

-- ---------------------------------------------------------------------------
-- Clients CRM et liaison de compte
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legacy_id text,
  full_name text not null check (length(btrim(full_name)) between 1 and 160),
  phone_display text not null check (length(btrim(phone_display)) >= 3),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  address text,
  deposits_count integer not null default 0 check (deposits_count >= 0),
  balance_xof bigint not null default 0,
  loyalty_discount_percent numeric(5,2) not null default 0
    check (loyalty_discount_percent between 0 and 100),
  is_vip boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index customers_legacy_id_uq
  on public.customers (organization_id, legacy_id)
  where legacy_id is not null;
create unique index customers_org_phone_e164_uq
  on public.customers (organization_id, phone_e164)
  where phone_e164 is not null;
create index customers_org_name_idx
  on public.customers (organization_id, lower(full_name));
create index customers_org_phone_idx
  on public.customers (organization_id, phone_display);

create table public.customer_account_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  customer_id uuid not null,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  verified_phone_e164 text not null
    check (verified_phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, customer_id)
    references public.customers(organization_id, id) on delete restrict,
  check (status <> 'revoked' or revoked_at is not null)
);

create unique index customer_account_link_customer_active_uq
  on public.customer_account_links (customer_id)
  where status = 'active';
create unique index customer_account_link_user_org_active_uq
  on public.customer_account_links (user_id, organization_id)
  where status = 'active';
create index customer_account_links_user_idx
  on public.customer_account_links (user_id, status);

-- Profil applicatif créé à l'inscription Supabase Auth.
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
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    case
      when new.phone ~ '^\+[1-9][0-9]{6,14}$' then new.phone
      else null
    end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
grant execute on function private.handle_new_user() to service_role;

-- Supabase Auth insère auth.users avec son rôle d'administration : lui seul
-- doit pouvoir déclencher cette fonction, sans l'exposer à l'API.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant usage on schema private to supabase_auth_admin';
    execute 'grant execute on function private.handle_new_user() to supabase_auth_admin';
  end if;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();
