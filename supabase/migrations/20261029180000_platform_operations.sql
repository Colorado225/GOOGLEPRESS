-- PressingPro CI — Opérations SaaS du super-admin unique.
-- Extension de 20261029170000_platform_admin.sql. Aucune donnée métier tenant
-- (commandes, clients, stock) n'est lue par les vues de cette migration.

-- ---------------------------------------------------------------------------
-- 1. Catalogue commercial, remises et conditions par abonnement
-- ---------------------------------------------------------------------------

create sequence public.platform_invoice_number_seq;
create sequence public.platform_credit_note_number_seq;
create sequence public.platform_ticket_number_seq;

create table public.platform_plan_offers (
  plan text primary key check (plan in ('free', 'pro', 'business')),
  monthly_price_xof integer not null check (monthly_price_xof >= 0),
  max_shops integer check (max_shops is null or max_shops > 0),
  max_users integer check (max_users is null or max_users > 0),
  max_orders_month integer check (max_orders_month is null or max_orders_month > 0),
  max_storage integer check (max_storage is null or max_storage > 0),
  modules text[] not null default '{}',
  trial_days integer not null default 14 check (trial_days between 0 and 365),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.platform_plan_offers (
  plan, monthly_price_xof, max_shops, max_users, max_orders_month,
  max_storage, modules, trial_days
) values
  ('free', 0, 1, 2, 100, 10, array['pos', 'catalog', 'daily_reports', 'manual_backup'], 14),
  ('pro', 12000, 1, 8, null, null,
    array['pos', 'catalog', 'daily_reports', 'manual_backup', 'customer_portal', 'delivery_tracking', 'delivery_proof', 'detailed_reports'], 14),
  ('business', 29000, 3, null, null, null,
    array['pos', 'catalog', 'daily_reports', 'manual_backup', 'customer_portal', 'delivery_tracking', 'delivery_proof', 'detailed_reports', 'multi_shop', 'priority_support'], 14);

create table public.platform_promo_codes (
  code text primary key check (code ~ '^[A-Z0-9_-]{3,32}$'),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  value integer not null check (value > 0),
  active boolean not null default true,
  starts_on date,
  ends_on date,
  max_uses integer check (max_uses is null or max_uses > 0),
  created_at timestamptz not null default now(),
  check (discount_type <> 'percent' or value <= 100),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

create table public.platform_subscription_terms (
  shop_id uuid primary key references public.shop_subscriptions(shop_id) on delete cascade,
  custom_monthly_price_xof integer check (custom_monthly_price_xof is null or custom_monthly_price_xof >= 0),
  auto_renew boolean not null default false,
  auto_lock boolean not null default false,
  grace_days integer not null default 3 check (grace_days between 0 and 90),
  trial_ends_on date,
  scheduled_plan text check (scheduled_plan is null or scheduled_plan in ('free', 'pro', 'business')),
  scheduled_change_on date,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scheduled_plan is null) = (scheduled_change_on is null))
);

-- Les quotas existants restent appliqués par les triggers de la migration des
-- abonnements, mais leurs valeurs viennent désormais du catalogue administrable.
create or replace function private.plan_limits(p_plan text)
returns table (max_users integer, max_orders_month integer, max_storage integer)
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select po.max_users, po.max_orders_month, po.max_storage
  from public.platform_plan_offers po
  where po.plan = p_plan and po.active;
$$;

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
        when p_now::date <= coalesce(
          t.trial_ends_on,
          (s.trial_started_at + make_interval(days => coalesce(po.trial_days, 14)))::date
        ) then 'pro'
        else 'free'
      end
      from public.shop_subscriptions s
      left join public.platform_subscription_terms t on t.shop_id = s.shop_id
      left join public.platform_plan_offers po on po.plan = 'free'
      where s.shop_id = p_shop_id
    ),
    'free'
  );
$$;

create or replace function private.enforce_shop_plan_quota()
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
  select max_shops into v_limit
  from public.platform_plan_offers
  where plan = v_plan and active;
  if v_limit is null then return new; end if;
  select count(*) into v_count from public.shops where organization_id = new.organization_id;
  if v_count >= v_limit then
    raise exception 'Formule % : % agence(s) au maximum.', v_plan, v_limit
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_shop_plan_quota on public.shops;
create trigger enforce_shop_plan_quota
before insert on public.shops
for each row execute function private.enforce_shop_plan_quota();

-- ---------------------------------------------------------------------------
-- 2. Facturation, paiements et avoirs — aucune commande tenant impliquée
-- ---------------------------------------------------------------------------

create table public.platform_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  shop_id uuid not null,
  invoice_number text not null unique default (
    'PP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.platform_invoice_number_seq')::text, 6, '0')
  ),
  status text not null default 'issued' check (status in ('issued', 'paid', 'overdue', 'void')),
  currency text not null default 'XOF' check (currency = 'XOF'),
  period_start date not null,
  period_end date not null,
  due_on date not null,
  subtotal_xof integer not null check (subtotal_xof > 0),
  discount_xof integer not null default 0 check (discount_xof >= 0),
  total_xof integer generated always as (subtotal_xof - discount_xof) stored,
  promo_code text references public.platform_promo_codes(code) on delete restrict,
  note text not null default '' check (length(note) <= 2000),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id) references public.shops(organization_id, id) on delete restrict,
  unique (organization_id, id),
  check (period_start <= period_end),
  check (discount_xof <= subtotal_xof)
);

create table public.platform_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  invoice_id uuid not null,
  amount_xof integer not null check (amount_xof > 0),
  method text not null check (method in ('cash', 'wave', 'orange_money', 'mtn_momo', 'moov_money', 'bank_transfer', 'other')),
  status text not null check (status in ('recorded', 'failed', 'refunded')),
  reference text not null default '' check (length(reference) <= 160),
  paid_at timestamptz not null default now(),
  note text not null default '' check (length(note) <= 2000),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, invoice_id) references public.platform_invoices(organization_id, id) on delete restrict
);

create table public.platform_credit_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  invoice_id uuid not null,
  credit_number text not null unique default (
    'AV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.platform_credit_note_number_seq')::text, 6, '0')
  ),
  amount_xof integer not null check (amount_xof > 0),
  reason text not null check (length(btrim(reason)) between 2 and 1000),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, invoice_id) references public.platform_invoices(organization_id, id) on delete restrict
);

create index platform_invoices_scope_status_idx on public.platform_invoices(organization_id, status, due_on);
create index platform_payments_invoice_created_idx on public.platform_payments(invoice_id, created_at desc);
create index platform_credit_notes_invoice_idx on public.platform_credit_notes(invoice_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Support, campagnes et file d'attente des messages externes
-- ---------------------------------------------------------------------------

create table public.platform_support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shop_id uuid,
  ticket_number text not null unique default (
    'TCK-' || lpad(nextval('public.platform_ticket_number_seq')::text, 6, '0')
  ),
  requester_user_id uuid references public.profiles(user_id) on delete set null,
  subject text not null check (length(btrim(subject)) between 2 and 240),
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (organization_id, shop_id) references public.shops(organization_id, id) on delete cascade,
  unique (organization_id, id)
);

create table public.platform_support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ticket_id uuid not null,
  author_user_id uuid references public.profiles(user_id) on delete set null,
  author_type text not null check (author_type in ('platform', 'tenant')),
  body text not null check (length(btrim(body)) between 1 and 8000),
  internal boolean not null default false,
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  created_at timestamptz not null default now(),
  foreign key (organization_id, ticket_id) references public.platform_support_tickets(organization_id, id) on delete cascade
);

create index platform_support_tickets_queue_idx on public.platform_support_tickets(status, priority, updated_at desc);
create index platform_support_messages_ticket_idx on public.platform_support_ticket_messages(ticket_id, created_at);

create table public.platform_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 240),
  body text not null check (length(btrim(body)) between 2 and 4000),
  tone text not null default 'info' check (tone in ('info', 'warning', 'critical')),
  audience_type text not null default 'all' check (audience_type in ('all', 'plan', 'organization')),
  audience_value text,
  channels text[] not null default array['in_app'],
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  maintenance boolean not null default false,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (audience_type = 'all' or length(btrim(coalesce(audience_value, ''))) > 0),
  check (audience_type <> 'plan' or audience_value in ('free', 'pro', 'business')),
  check (starts_at is null or ends_at is null or starts_at < ends_at),
  check (channels <@ array['in_app', 'email', 'whatsapp']::text[] and cardinality(channels) > 0)
);

create table public.platform_outbound_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.platform_campaigns(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  recipient text not null,
  channel text not null check (channel in ('email', 'whatsapp')),
  subject text not null default '',
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'cancelled')),
  provider text,
  provider_reference text,
  error text,
  scheduled_for timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (campaign_id, organization_id, channel)
);

create table public.platform_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text not null default '',
  organization_id uuid references public.organizations(id) on delete cascade,
  resource_type text,
  resource_id uuid,
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index platform_notifications_unread_idx on public.platform_notifications(created_at desc) where read_at is null;

-- ---------------------------------------------------------------------------
-- 4. Sécurité et supervision du compte unique
-- ---------------------------------------------------------------------------

create table public.platform_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  session_id uuid,
  event_type text not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.platform_automation_runs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.platform_health_checks (
  id uuid primary key default gen_random_uuid(),
  component text not null,
  status text not null check (status in ('healthy', 'degraded', 'down')),
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

-- Protection uniforme : seules les RPC autorisées lisent ou modifient ces tables.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'platform_plan_offers', 'platform_promo_codes', 'platform_subscription_terms',
    'platform_invoices', 'platform_payments', 'platform_credit_notes',
    'platform_support_tickets', 'platform_support_ticket_messages',
    'platform_campaigns', 'platform_outbound_messages', 'platform_notifications',
    'platform_security_events', 'platform_automation_runs', 'platform_health_checks'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
    execute format('revoke all on public.%I from public, anon, authenticated', v_table);
  end loop;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'platform_plan_offers', 'platform_subscription_terms', 'platform_invoices',
    'platform_support_tickets', 'platform_campaigns'
  ] loop
    execute format('drop trigger if exists set_updated_at_%I on public.%I', v_table, v_table);
    execute format('create trigger set_updated_at_%I before update on public.%I for each row execute function private.set_updated_at()', v_table, v_table);
  end loop;
end;
$$;

-- Les journaux de plateforme contiennent des notes internes : ils ne doivent
-- pas devenir lisibles par un propriétaire via la politique audit_log générale.
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
for select to authenticated
using (
  private.is_platform_admin()
  or (
    actor_type <> 'platform'
    and organization_id is not null
    and private.has_organization_access(organization_id, array['organization_owner'])
  )
);

create or replace function private.log_platform_operation()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_after jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_row jsonb := coalesce(v_after, v_before, '{}'::jsonb);
  v_actor text := case when private.is_platform_admin() then 'platform' else 'staff' end;
  v_id uuid;
begin
  begin
    v_id := nullif(v_row ->> 'id', '')::uuid;
  exception when invalid_text_representation then
    v_id := null;
  end;
  insert into public.audit_log (
    organization_id, shop_id, actor_user_id, actor_type,
    action, resource_type, resource_id, metadata
  ) values (
    nullif(v_row ->> 'organization_id', '')::uuid,
    nullif(v_row ->> 'shop_id', '')::uuid,
    auth.uid(), v_actor,
    (case when v_actor = 'platform' then 'platform.' else 'support.' end) || tg_table_name || '.' || lower(tg_op),
    tg_table_name, v_id,
    jsonb_build_object('before', v_before, 'after', v_after)
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'platform_plan_offers', 'platform_promo_codes', 'platform_subscription_terms',
    'platform_invoices', 'platform_payments', 'platform_credit_notes',
    'platform_support_tickets', 'platform_support_ticket_messages',
    'platform_campaigns', 'platform_outbound_messages'
  ] loop
    execute format('drop trigger if exists log_platform_operation on public.%I', v_table);
    execute format('create trigger log_platform_operation after insert or update or delete on public.%I for each row execute function private.log_platform_operation()', v_table);
  end loop;
end;
$$;

-- Historique de connexion limité au seul compte admin, alimenté par Auth.
create or replace function private.capture_platform_admin_session()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_previous public.platform_security_events%rowtype;
  v_unusual boolean := false;
begin
  if not exists (
    select 1 from public.platform_admins pa where pa.user_id = new.user_id and pa.is_active
  ) then
    return new;
  end if;
  select * into v_previous
  from public.platform_security_events
  where user_id = new.user_id and event_type = 'signed_in'
  order by created_at desc limit 1;
  if found and (
    coalesce(v_previous.ip, '') <> coalesce(new.ip::text, '')
    or coalesce(v_previous.user_agent, '') <> coalesce(new.user_agent, '')
  ) then
    v_unusual := true;
  end if;
  insert into public.platform_security_events (user_id, session_id, event_type, ip, user_agent)
  values (new.user_id, new.id, 'signed_in', new.ip::text, new.user_agent);
  if v_unusual then
    insert into public.platform_notifications (
      kind, severity, title, body, resource_type, resource_id, dedupe_key
    ) values (
      'security', 'critical', 'Nouvelle connexion à vérifier',
      'L’appareil, le navigateur ou l’adresse réseau diffère de la connexion précédente.',
      'auth_session', new.id, 'security-session-' || new.id::text
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_platform_admin_session on auth.sessions;
create trigger capture_platform_admin_session
after insert on auth.sessions
for each row execute function private.capture_platform_admin_session();

-- ---------------------------------------------------------------------------
-- 5. Notifications automatiques d'événements commerciaux et support
-- ---------------------------------------------------------------------------

create or replace function private.notify_platform_organization()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  insert into public.platform_notifications (
    kind, severity, title, body, organization_id, resource_type, resource_id, dedupe_key
  ) values (
    'registration', 'info', 'Nouveau pressing inscrit', new.name,
    new.id, 'organization', new.id, 'registration-' || new.id::text
  ) on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

drop trigger if exists notify_platform_organization on public.organizations;
create trigger notify_platform_organization
after insert on public.organizations
for each row execute function private.notify_platform_organization();

create or replace function private.notify_platform_plan_request()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  if new.requested_plan is not null and old.requested_plan is distinct from new.requested_plan then
    insert into public.platform_notifications (
      kind, severity, title, body, organization_id, resource_type, resource_id, dedupe_key
    ) values (
      'plan_request', 'info', 'Demande de formule ' || new.requested_plan,
      'Une agence attend la validation du super-admin.', new.organization_id,
      'shop_subscription', new.shop_id,
      'plan-request-' || new.shop_id::text || '-' || coalesce(new.requested_at::text, clock_timestamp()::text)
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_platform_plan_request on public.shop_subscriptions;
create trigger notify_platform_plan_request
after update of requested_plan on public.shop_subscriptions
for each row execute function private.notify_platform_plan_request();

-- ---------------------------------------------------------------------------
-- 6. Lecture super-admin : uniquement métadonnées commerciales et support
-- ---------------------------------------------------------------------------

create or replace function public.get_platform_operations_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = private, pg_catalog
as $$
declare
  v_latest_migration text;
  v_scheduler boolean := false;
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Accès réservé au super-admin de la plateforme' using errcode = '42501';
  end if;

  if exists (select 1 from pg_namespace where nspname = 'supabase_migrations') then
    execute 'select max(version)::text from supabase_migrations.schema_migrations'
      into v_latest_migration;
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_namespace where nspname = 'cron') then
    execute $query$select exists (select 1 from cron.job where jobname = 'pressingpro-platform-automations')$query$
      into v_scheduler;
  end if;

  return jsonb_build_object(
    'server_time', now(),
    'system', jsonb_build_object(
      'database_name', current_database(),
      'postgres_version', current_setting('server_version'),
      'latest_migration', v_latest_migration,
      'automation_scheduled', v_scheduler
    ),
    'plan_offers', coalesce((
      select jsonb_agg(to_jsonb(po) order by case po.plan when 'free' then 1 when 'pro' then 2 else 3 end)
      from public.platform_plan_offers po
    ), '[]'::jsonb),
    'promo_codes', coalesce((
      select jsonb_agg(to_jsonb(pc) order by pc.code) from public.platform_promo_codes pc
    ), '[]'::jsonb),
    'subscription_terms', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at) from public.platform_subscription_terms t
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id, 'organization_id', i.organization_id, 'shop_id', i.shop_id,
          'organization_name', o.name, 'shop_name', s.name,
          'invoice_number', i.invoice_number, 'status', i.status, 'currency', i.currency,
          'period_start', i.period_start, 'period_end', i.period_end, 'due_on', i.due_on,
          'subtotal_xof', i.subtotal_xof, 'discount_xof', i.discount_xof,
          'total_xof', i.total_xof, 'promo_code', i.promo_code, 'note', i.note,
          'created_at', i.created_at,
          'payments', coalesce((
            select jsonb_agg(to_jsonb(p) order by p.created_at desc)
            from public.platform_payments p where p.invoice_id = i.id
          ), '[]'::jsonb),
          'credit_notes', coalesce((
            select jsonb_agg(to_jsonb(c) order by c.created_at desc)
            from public.platform_credit_notes c where c.invoice_id = i.id
          ), '[]'::jsonb)
        ) order by i.created_at desc
      )
      from public.platform_invoices i
      join public.organizations o on o.id = i.organization_id
      join public.shops s on s.id = i.shop_id
    ), '[]'::jsonb),
    'tickets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id, 'organization_id', t.organization_id, 'shop_id', t.shop_id,
          'organization_name', o.name, 'shop_name', s.name, 'ticket_number', t.ticket_number,
          'requester_user_id', t.requester_user_id, 'subject', t.subject,
          'status', t.status, 'priority', t.priority, 'created_at', t.created_at,
          'updated_at', t.updated_at, 'resolved_at', t.resolved_at,
          'messages', coalesce((
            select jsonb_agg(to_jsonb(m) order by m.created_at)
            from public.platform_support_ticket_messages m where m.ticket_id = t.id
          ), '[]'::jsonb)
        ) order by t.updated_at desc
      )
      from public.platform_support_tickets t
      join public.organizations o on o.id = t.organization_id
      left join public.shops s on s.id = t.shop_id
    ), '[]'::jsonb),
    'campaigns', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.platform_campaigns c
    ), '[]'::jsonb),
    'outbound_messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at desc) from (
        select * from public.platform_outbound_messages order by created_at desc limit 200
      ) m
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (
        select * from public.platform_notifications order by created_at desc limit 200
      ) n
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (
        select a.id, a.organization_id, o.name as organization_name, a.actor_user_id,
               a.action, a.resource_type, a.resource_id, a.metadata, a.created_at
        from public.audit_log a
        left join public.organizations o on o.id = a.organization_id
        where a.actor_type = 'platform'
        order by a.created_at desc limit 300
      ) a
    ), '[]'::jsonb),
    'security_events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (
        select * from public.platform_security_events
        where user_id = auth.uid() order by created_at desc limit 100
      ) e
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'created_at', s.created_at, 'updated_at', s.updated_at,
        'refreshed_at', s.refreshed_at, 'not_after', s.not_after,
        'ip', s.ip::text, 'user_agent', s.user_agent, 'aal', s.aal::text
      ) order by s.created_at desc)
      from auth.sessions s where s.user_id = auth.uid()
    ), '[]'::jsonb),
    'automation_runs', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (
        select * from public.platform_automation_runs order by created_at desc limit 20
      ) r
    ), '[]'::jsonb),
    'health_checks', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.checked_at desc) from (
        select * from public.platform_health_checks order by checked_at desc limit 30
      ) h
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_platform_operations_snapshot() from public, anon;
grant execute on function public.get_platform_operations_snapshot() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Files de campagnes et cycle d'automatisation
-- ---------------------------------------------------------------------------

create or replace function private.enqueue_platform_campaign(p_campaign_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = private, pg_catalog
as $$
declare
  v_campaign public.platform_campaigns%rowtype;
  v_count integer := 0;
begin
  select * into v_campaign from public.platform_campaigns where id = p_campaign_id;
  if not found or v_campaign.status <> 'published' then return 0; end if;

  with recipients as (
    select distinct o.id as organization_id,
           coalesce(nullif(u.email, ''), nullif(u.phone, '')) as recipient
    from public.organizations o
    join public.memberships m on m.organization_id = o.id
      and m.role = 'organization_owner' and m.status = 'active'
    join auth.users u on u.id = m.user_id
    where v_campaign.audience_type = 'all'
       or (v_campaign.audience_type = 'organization' and o.id::text = v_campaign.audience_value)
       or (v_campaign.audience_type = 'plan' and exists (
         select 1 from public.shop_subscriptions sub
         where sub.organization_id = o.id and sub.plan = v_campaign.audience_value
       ))
  ), inserted as (
    insert into public.platform_outbound_messages (
      campaign_id, organization_id, recipient, channel, subject, body, scheduled_for
    )
    select v_campaign.id, r.organization_id, r.recipient, c.channel,
           v_campaign.title, v_campaign.body, coalesce(v_campaign.starts_at, now())
    from recipients r
    cross join lateral unnest(v_campaign.channels) as c(channel)
    where r.recipient is not null and c.channel in ('email', 'whatsapp')
    on conflict (campaign_id, organization_id, channel) do nothing
    returning id
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;

create or replace function public.run_platform_automations()
returns jsonb
language plpgsql
volatile
security definer
set search_path = private, pg_catalog
as $$
declare
  v_record record;
  v_overdue integer := 0;
  v_renewed integer := 0;
  v_trials integer := 0;
  v_campaigns integer := 0;
  v_locked integer := 0;
  v_price integer;
begin
  -- Publication et expiration des campagnes planifiées.
  for v_record in
    select id from public.platform_campaigns
    where status = 'scheduled' and coalesce(starts_at, now()) <= now()
      and (ends_at is null or ends_at > now())
  loop
    update public.platform_campaigns set status = 'published' where id = v_record.id;
    perform private.enqueue_platform_campaign(v_record.id);
    v_campaigns := v_campaigns + 1;
  end loop;
  update public.platform_campaigns set status = 'archived'
  where status in ('scheduled', 'published') and ends_at is not null and ends_at <= now();

  -- Changements de formule et résiliations programmés.
  for v_record in
    select t.*, s.organization_id from public.platform_subscription_terms t
    join public.shop_subscriptions s on s.shop_id = t.shop_id
    where t.scheduled_plan is not null and t.scheduled_change_on <= current_date
  loop
    update public.shop_subscriptions
       set plan = v_record.scheduled_plan, status = 'actif', requested_plan = null, requested_at = null
     where shop_id = v_record.shop_id;
    update public.platform_subscription_terms
       set scheduled_plan = null, scheduled_change_on = null
     where shop_id = v_record.shop_id;
  end loop;
  for v_record in
    select t.*, s.organization_id from public.platform_subscription_terms t
    join public.shop_subscriptions s on s.shop_id = t.shop_id
    where t.cancelled_at is not null and t.cancelled_at <= now() and s.plan <> 'free'
  loop
    update public.shop_subscriptions
       set plan = 'free', status = 'actif', renews_on = null
     where shop_id = v_record.shop_id;
  end loop;

  -- Fin des essais Free : retour explicite à Free actif, jamais suppression.
  for v_record in
    select s.shop_id, s.organization_id from public.shop_subscriptions s
    left join public.platform_subscription_terms t on t.shop_id = s.shop_id
    left join public.platform_plan_offers po on po.plan = 'free'
    where s.plan = 'free' and s.status = 'essai'
      and current_date > coalesce(t.trial_ends_on,
        (s.trial_started_at + make_interval(days => coalesce(po.trial_days, 14)))::date)
  loop
    update public.shop_subscriptions set status = 'actif' where shop_id = v_record.shop_id;
    insert into public.platform_notifications (
      kind, severity, title, body, organization_id, resource_type, resource_id, dedupe_key
    ) values (
      'trial', 'info', 'Essai terminé', 'Le compte est repassé à la formule Free.',
      v_record.organization_id, 'shop_subscription', v_record.shop_id,
      'trial-ended-' || v_record.shop_id::text
    ) on conflict (dedupe_key) do nothing;
    v_trials := v_trials + 1;
  end loop;

  -- Factures de renouvellement et rappels avant échéance.
  for v_record in
    select s.*, t.auto_renew, t.custom_monthly_price_xof, po.monthly_price_xof,
           o.id as organization_id
    from public.shop_subscriptions s
    join public.organizations o on o.id = s.organization_id
    left join public.platform_subscription_terms t on t.shop_id = s.shop_id
    join public.platform_plan_offers po on po.plan = s.plan
    where s.status = 'actif' and s.plan <> 'free' and s.renews_on is not null
      and s.renews_on <= current_date + 7
  loop
    v_price := coalesce(v_record.custom_monthly_price_xof, v_record.monthly_price_xof);
    if coalesce(v_record.auto_renew, false) and not exists (
      select 1 from public.platform_invoices i
      where i.shop_id = v_record.shop_id and i.period_end = v_record.renews_on and i.status <> 'void'
    ) then
      insert into public.platform_invoices (
        organization_id, shop_id, period_start, period_end, due_on, subtotal_xof,
        note, created_by
      ) values (
        v_record.organization_id, v_record.shop_id,
        v_record.renews_on - interval '1 month', v_record.renews_on,
        v_record.renews_on, v_price,
        'Facture de renouvellement générée automatiquement.', null
      );
      v_renewed := v_renewed + 1;
    end if;
    insert into public.platform_notifications (
      kind, severity, title, body, organization_id, resource_type, resource_id, dedupe_key
    ) values (
      'renewal', 'warning', 'Renouvellement à échéance',
      'Une échéance d’abonnement arrive dans les sept prochains jours.',
      v_record.organization_id, 'shop_subscription', v_record.shop_id,
      'renewal-' || v_record.shop_id::text || '-' || v_record.renews_on::text
    ) on conflict (dedupe_key) do nothing;
  end loop;

  -- Retards, délai de grâce puis verrouillage optionnel sans suppression.
  for v_record in
    select i.*, t.grace_days, t.auto_lock from public.platform_invoices i
    left join public.platform_subscription_terms t on t.shop_id = i.shop_id
    where i.status in ('issued', 'overdue') and i.due_on < current_date
  loop
    if v_record.status <> 'overdue' then
      update public.platform_invoices set status = 'overdue' where id = v_record.id;
      v_overdue := v_overdue + 1;
    end if;
    insert into public.platform_notifications (
      kind, severity, title, body, organization_id, resource_type, resource_id, dedupe_key
    ) values (
      'payment', 'critical', 'Facture en retard', v_record.invoice_number || ' est arrivée à échéance.',
      v_record.organization_id, 'platform_invoice', v_record.id,
      'invoice-overdue-' || v_record.id::text
    ) on conflict (dedupe_key) do nothing;
    if coalesce(v_record.auto_lock, false)
       and v_record.due_on + make_interval(days => coalesce(v_record.grace_days, 3)) < current_date then
      update public.organizations set status = 'suspended'
      where id = v_record.organization_id and status = 'active';
      if found then v_locked := v_locked + 1; end if;
    end if;
  end loop;

  insert into public.platform_automation_runs (actor_user_id, summary)
  values (auth.uid(), jsonb_build_object(
    'overdue_invoices', v_overdue, 'renewal_invoices', v_renewed,
    'trials_closed', v_trials, 'campaigns_published', v_campaigns,
    'organizations_locked', v_locked
  ));

  return jsonb_build_object(
    'overdue_invoices', v_overdue, 'renewal_invoices', v_renewed,
    'trials_closed', v_trials, 'campaigns_published', v_campaigns,
    'organizations_locked', v_locked
  );
end;
$$;

revoke all on function public.run_platform_automations() from public, anon, authenticated;
grant execute on function public.run_platform_automations() to service_role;

-- Si pg_cron est déjà installé, un cycle quotidien est enregistré. Sinon le
-- bouton « Exécuter maintenant » et un ordonnanceur externe utilisent la même RPC.
do $$
declare
  v_job_exists boolean;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_namespace where nspname = 'cron') then
    execute $query$select exists (select 1 from cron.job where jobname = 'pressingpro-platform-automations')$query$
      into v_job_exists;
    if not v_job_exists then
      execute $query$select cron.schedule('pressingpro-platform-automations', '17 5 * * *', 'select public.run_platform_automations();')$query$;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Commandes super-admin validées et journalisées
-- ---------------------------------------------------------------------------

create or replace function public.admin_platform_command(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = private, pg_catalog
as $$
declare
  v_invoice public.platform_invoices%rowtype;
  v_ticket public.platform_support_tickets%rowtype;
  v_campaign public.platform_campaigns%rowtype;
  v_shop public.shops%rowtype;
  v_promo public.platform_promo_codes%rowtype;
  v_id uuid;
  v_amount integer;
  v_discount integer;
  v_total_paid bigint;
  v_total_credit bigint;
  v_remaining bigint;
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Accès réservé au super-admin de la plateforme' using errcode = '42501';
  end if;

  case p_action
    when 'plan_offer.update' then
      if p_payload ->> 'plan' not in ('free', 'pro', 'business') then
        raise exception 'Formule inconnue' using errcode = '22023';
      end if;
      update public.platform_plan_offers set
        monthly_price_xof = (p_payload ->> 'monthly_price_xof')::integer,
        max_shops = nullif(p_payload ->> 'max_shops', '')::integer,
        max_users = nullif(p_payload ->> 'max_users', '')::integer,
        max_orders_month = nullif(p_payload ->> 'max_orders_month', '')::integer,
        max_storage = nullif(p_payload ->> 'max_storage', '')::integer,
        modules = array(select jsonb_array_elements_text(coalesce(p_payload -> 'modules', '[]'::jsonb))),
        trial_days = (p_payload ->> 'trial_days')::integer,
        active = coalesce((p_payload ->> 'active')::boolean, true)
      where plan = p_payload ->> 'plan';
      if not found then raise exception 'Formule introuvable' using errcode = 'P0002'; end if;

    when 'promo.save' then
      insert into public.platform_promo_codes (
        code, discount_type, value, active, starts_on, ends_on, max_uses
      ) values (
        upper(btrim(p_payload ->> 'code')), p_payload ->> 'discount_type',
        (p_payload ->> 'value')::integer, coalesce((p_payload ->> 'active')::boolean, true),
        nullif(p_payload ->> 'starts_on', '')::date, nullif(p_payload ->> 'ends_on', '')::date,
        nullif(p_payload ->> 'max_uses', '')::integer
      )
      on conflict (code) do update set
        discount_type = excluded.discount_type, value = excluded.value,
        active = excluded.active, starts_on = excluded.starts_on,
        ends_on = excluded.ends_on, max_uses = excluded.max_uses;

    when 'terms.update' then
      if p_payload ->> 'scheduled_plan' is not null
         and p_payload ->> 'scheduled_plan' not in ('free', 'pro', 'business') then
        raise exception 'Formule programmée inconnue' using errcode = '22023';
      end if;
      insert into public.platform_subscription_terms (
        shop_id, custom_monthly_price_xof, auto_renew, auto_lock, grace_days,
        trial_ends_on, scheduled_plan, scheduled_change_on, cancelled_at
      ) values (
        (p_payload ->> 'shop_id')::uuid,
        nullif(p_payload ->> 'custom_monthly_price_xof', '')::integer,
        coalesce((p_payload ->> 'auto_renew')::boolean, false),
        coalesce((p_payload ->> 'auto_lock')::boolean, false),
        coalesce(nullif(p_payload ->> 'grace_days', '')::integer, 3),
        nullif(p_payload ->> 'trial_ends_on', '')::date,
        nullif(p_payload ->> 'scheduled_plan', ''),
        nullif(p_payload ->> 'scheduled_change_on', '')::date,
        case when coalesce((p_payload ->> 'cancelled')::boolean, false)
          then coalesce(nullif(p_payload ->> 'cancelled_at', '')::timestamptz, now()) else null end
      )
      on conflict (shop_id) do update set
        custom_monthly_price_xof = excluded.custom_monthly_price_xof,
        auto_renew = excluded.auto_renew, auto_lock = excluded.auto_lock,
        grace_days = excluded.grace_days, trial_ends_on = excluded.trial_ends_on,
        scheduled_plan = excluded.scheduled_plan,
        scheduled_change_on = excluded.scheduled_change_on,
        cancelled_at = excluded.cancelled_at;

    when 'invoice.create' then
      select * into v_shop from public.shops
      where id = (p_payload ->> 'shop_id')::uuid
        and organization_id = (p_payload ->> 'organization_id')::uuid;
      if not found then raise exception 'Agence ou organisation introuvable' using errcode = 'P0002'; end if;
      v_amount := (p_payload ->> 'subtotal_xof')::integer;
      v_discount := coalesce(nullif(p_payload ->> 'discount_xof', '')::integer, 0);
      if v_amount <= 0 or v_discount < 0 or v_discount > v_amount then
        raise exception 'Montants de facture invalides' using errcode = '22023';
      end if;
      if nullif(p_payload ->> 'promo_code', '') is not null then
        select * into v_promo from public.platform_promo_codes
        where code = upper(p_payload ->> 'promo_code') and active
          and (starts_on is null or starts_on <= current_date)
          and (ends_on is null or ends_on >= current_date);
        if not found then raise exception 'Code promotionnel invalide ou expiré' using errcode = '22023'; end if;
        if v_promo.max_uses is not null and (
          select count(*) from public.platform_invoices i where i.promo_code = v_promo.code
        ) >= v_promo.max_uses then
          raise exception 'Ce code promotionnel a atteint sa limite d’utilisation' using errcode = '22023';
        end if;
        v_discount := case when v_promo.discount_type = 'percent'
          then least(v_amount, round(v_amount * v_promo.value / 100.0)::integer)
          else least(v_amount, v_promo.value) end;
      end if;
      insert into public.platform_invoices (
        organization_id, shop_id, period_start, period_end, due_on,
        subtotal_xof, discount_xof, promo_code, note, created_by
      ) values (
        v_shop.organization_id, v_shop.id,
        (p_payload ->> 'period_start')::date, (p_payload ->> 'period_end')::date,
        (p_payload ->> 'due_on')::date, v_amount, v_discount,
        nullif(upper(p_payload ->> 'promo_code'), ''), coalesce(p_payload ->> 'note', ''), auth.uid()
      );

    when 'invoice.void' then
      update public.platform_invoices set status = 'void'
      where id = (p_payload ->> 'invoice_id')::uuid and status <> 'paid'
        and not exists (select 1 from public.platform_payments p where p.invoice_id = id and p.status = 'recorded');
      if not found then raise exception 'Facture introuvable ou déjà encaissée' using errcode = '22023'; end if;

    when 'payment.record' then
      select * into v_invoice from public.platform_invoices
      where id = (p_payload ->> 'invoice_id')::uuid for update;
      if not found or v_invoice.status = 'void' then
        raise exception 'Facture introuvable ou annulée' using errcode = 'P0002';
      end if;
      if p_payload ->> 'method' not in ('cash', 'wave', 'orange_money', 'mtn_momo', 'moov_money', 'bank_transfer', 'other')
         or p_payload ->> 'status' not in ('recorded', 'failed', 'refunded') then
        raise exception 'Méthode ou statut de paiement inconnu' using errcode = '22023';
      end if;
      v_amount := (p_payload ->> 'amount_xof')::integer;
      if v_amount <= 0 then raise exception 'Le montant doit être positif' using errcode = '22023'; end if;
      select coalesce(sum(case when p.status = 'recorded' then p.amount_xof when p.status = 'refunded' then -p.amount_xof else 0 end), 0),
             coalesce(sum(case when p.status = 'refunded' then p.amount_xof else 0 end), 0)
        into v_total_paid, v_remaining
      from public.platform_payments p where p.invoice_id = v_invoice.id;
      select coalesce(sum(c.amount_xof), 0) into v_total_credit
      from public.platform_credit_notes c where c.invoice_id = v_invoice.id;
      if p_payload ->> 'status' = 'recorded'
         and v_total_paid + v_total_credit + v_amount > v_invoice.total_xof then
        raise exception 'Le paiement dépasse le solde de la facture' using errcode = '22023';
      end if;
      if p_payload ->> 'status' = 'refunded' and v_amount > v_total_paid then
        raise exception 'Le remboursement dépasse les encaissements nets' using errcode = '22023';
      end if;
      insert into public.platform_payments (
        organization_id, invoice_id, amount_xof, method, status, reference, paid_at, note, created_by
      ) values (
        v_invoice.organization_id, v_invoice.id, v_amount, p_payload ->> 'method',
        p_payload ->> 'status', coalesce(p_payload ->> 'reference', ''),
        coalesce(nullif(p_payload ->> 'paid_at', '')::timestamptz, now()),
        coalesce(p_payload ->> 'note', ''), auth.uid()
      );
      if p_payload ->> 'status' = 'failed' then
        insert into public.platform_notifications (
          kind, severity, title, body, organization_id, resource_type, resource_id, dedupe_key
        ) values (
          'payment', 'critical', 'Paiement Mobile Money ou bancaire en échec',
          v_invoice.invoice_number || ' : ' || coalesce(p_payload ->> 'note', 'Échec enregistré.'),
          v_invoice.organization_id, 'platform_invoice', v_invoice.id,
          'payment-failed-' || v_invoice.id::text || '-' || clock_timestamp()::text
        );
      end if;
      if p_payload ->> 'status' <> 'failed' then
        v_total_paid := v_total_paid + case when p_payload ->> 'status' = 'recorded' then v_amount else -v_amount end;
        update public.platform_invoices set
          status = case when v_total_paid + v_total_credit >= v_invoice.total_xof then 'paid'
                        when v_invoice.due_on < current_date then 'overdue' else 'issued' end
        where id = v_invoice.id;
        if v_total_paid + v_total_credit >= v_invoice.total_xof then
          update public.platform_subscription_terms t
             set cancelled_at = null
           where t.shop_id = v_invoice.shop_id;
          update public.shop_subscriptions s
             set status = 'actif',
                 renews_on = case
                   when coalesce((select t.auto_renew from public.platform_subscription_terms t where t.shop_id = s.shop_id), false)
                   then v_invoice.period_end + 1
                   else s.renews_on end
           where s.shop_id = v_invoice.shop_id;
        end if;
      end if;

    when 'credit_note.create' then
      select * into v_invoice from public.platform_invoices where id = (p_payload ->> 'invoice_id')::uuid for update;
      if not found or v_invoice.status = 'void' then raise exception 'Facture introuvable' using errcode = 'P0002'; end if;
      v_amount := (p_payload ->> 'amount_xof')::integer;
      select coalesce(sum(c.amount_xof), 0) into v_total_credit from public.platform_credit_notes c where c.invoice_id = v_invoice.id;
      if v_amount <= 0 or v_total_credit + v_amount > v_invoice.total_xof then
        raise exception 'Le montant de l’avoir est invalide' using errcode = '22023';
      end if;
      insert into public.platform_credit_notes (organization_id, invoice_id, amount_xof, reason, created_by)
      values (v_invoice.organization_id, v_invoice.id, v_amount, btrim(p_payload ->> 'reason'), auth.uid());
      select coalesce(sum(case when p.status = 'recorded' then p.amount_xof when p.status = 'refunded' then -p.amount_xof else 0 end), 0)
        into v_total_paid from public.platform_payments p where p.invoice_id = v_invoice.id;
      update public.platform_invoices set
        status = case when v_total_paid + v_total_credit + v_amount >= v_invoice.total_xof then 'paid'
                      when due_on < current_date then 'overdue' else 'issued' end
      where id = v_invoice.id;

    when 'ticket.create' then
      select * into v_shop from public.shops
      where id = nullif(p_payload ->> 'shop_id', '')::uuid
        and organization_id = (p_payload ->> 'organization_id')::uuid;
      if nullif(p_payload ->> 'shop_id', '') is not null and not found then
        raise exception 'Agence invalide pour cette organisation' using errcode = '22023';
      end if;
      insert into public.platform_support_tickets (
        organization_id, shop_id, subject, priority
      ) values (
        (p_payload ->> 'organization_id')::uuid, nullif(p_payload ->> 'shop_id', '')::uuid,
        btrim(p_payload ->> 'subject'), coalesce(nullif(p_payload ->> 'priority', ''), 'normal')
      ) returning * into v_ticket;
      if length(btrim(coalesce(p_payload ->> 'body', ''))) > 0 then
        insert into public.platform_support_ticket_messages (
          organization_id, ticket_id, author_user_id, author_type, body, internal, attachments
        ) values (
          v_ticket.organization_id, v_ticket.id, auth.uid(), 'platform',
          btrim(p_payload ->> 'body'), coalesce((p_payload ->> 'internal')::boolean, false),
          coalesce(p_payload -> 'attachments', '[]'::jsonb)
        );
      end if;
      insert into public.platform_notifications (
        kind, severity, title, body, organization_id, resource_type, resource_id, dedupe_key
      ) values (
        'support', 'info', 'Ticket créé', v_ticket.ticket_number || ' · ' || v_ticket.subject,
        v_ticket.organization_id, 'platform_support_ticket', v_ticket.id, 'ticket-created-' || v_ticket.id::text
      );

    when 'ticket.update' then
      update public.platform_support_tickets set
        status = coalesce(nullif(p_payload ->> 'status', ''), status),
        priority = coalesce(nullif(p_payload ->> 'priority', ''), priority),
        resolved_at = case when coalesce(nullif(p_payload ->> 'status', ''), status) in ('resolved', 'closed')
          then coalesce(resolved_at, now()) else null end
      where id = (p_payload ->> 'ticket_id')::uuid;
      if not found then raise exception 'Ticket introuvable' using errcode = 'P0002'; end if;

    when 'ticket.reply' then
      select * into v_ticket from public.platform_support_tickets where id = (p_payload ->> 'ticket_id')::uuid;
      if not found then raise exception 'Ticket introuvable' using errcode = 'P0002'; end if;
      insert into public.platform_support_ticket_messages (
        organization_id, ticket_id, author_user_id, author_type, body, internal, attachments
      ) values (
        v_ticket.organization_id, v_ticket.id, auth.uid(), 'platform', btrim(p_payload ->> 'body'),
        coalesce((p_payload ->> 'internal')::boolean, false), coalesce(p_payload -> 'attachments', '[]'::jsonb)
      );
      update public.platform_support_tickets set
        status = case when coalesce((p_payload ->> 'internal')::boolean, false) then status else 'pending' end
      where id = v_ticket.id;

    when 'campaign.save' then
      v_id := nullif(p_payload ->> 'id', '')::uuid;
      insert into public.platform_campaigns (
        id, title, body, tone, audience_type, audience_value, channels,
        status, starts_at, ends_at, maintenance, created_by
      ) values (
        coalesce(v_id, gen_random_uuid()), btrim(p_payload ->> 'title'), btrim(p_payload ->> 'body'),
        coalesce(nullif(p_payload ->> 'tone', ''), 'info'),
        coalesce(nullif(p_payload ->> 'audience_type', ''), 'all'), nullif(p_payload ->> 'audience_value', ''),
        coalesce(array(select jsonb_array_elements_text(p_payload -> 'channels')), array['in_app']),
        coalesce(nullif(p_payload ->> 'status', ''), 'draft'),
        nullif(p_payload ->> 'starts_at', '')::timestamptz,
        nullif(p_payload ->> 'ends_at', '')::timestamptz,
        coalesce((p_payload ->> 'maintenance')::boolean, false), auth.uid()
      )
      on conflict (id) do update set
        title = excluded.title, body = excluded.body, tone = excluded.tone,
        audience_type = excluded.audience_type, audience_value = excluded.audience_value,
        channels = excluded.channels, status = excluded.status,
        starts_at = excluded.starts_at, ends_at = excluded.ends_at, maintenance = excluded.maintenance
      returning * into v_campaign;
      if v_campaign.status = 'published' then perform private.enqueue_platform_campaign(v_campaign.id); end if;

    when 'campaign.status' then
      update public.platform_campaigns set status = p_payload ->> 'status'
      where id = (p_payload ->> 'id')::uuid returning * into v_campaign;
      if not found then raise exception 'Campagne introuvable' using errcode = 'P0002'; end if;
      if v_campaign.status = 'published' then perform private.enqueue_platform_campaign(v_campaign.id); end if;

    when 'outbound.cancel' then
      update public.platform_outbound_messages set status = 'cancelled'
      where id = (p_payload ->> 'id')::uuid and status = 'queued';

    when 'notifications.read' then
      update public.platform_notifications set read_at = now()
      where read_at is null and (
        coalesce((p_payload ->> 'all')::boolean, false)
        or id in (select value::uuid from jsonb_array_elements_text(coalesce(p_payload -> 'ids', '[]'::jsonb)))
      );

    when 'automation.run' then
      perform public.run_platform_automations();

    when 'health.check' then
      insert into public.platform_health_checks (component, status, details)
      values (
        'supabase_api', 'healthy', jsonb_build_object(
          'checked_by', auth.uid(), 'server_time', now(),
          'failed_outbound', (select count(*) from public.platform_outbound_messages where status = 'failed'),
          'queued_outbound', (select count(*) from public.platform_outbound_messages where status = 'queued')
        )
      );

    else
      raise exception 'Action d’administration inconnue : %', coalesce(p_action, '(vide)') using errcode = '22023';
  end case;

  return public.get_platform_operations_snapshot();
end;
$$;

revoke all on function public.admin_platform_command(text, jsonb) from public, anon;
grant execute on function public.admin_platform_command(text, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. Support côté propriétaire : création et réponses, messages internes exclus
-- ---------------------------------------------------------------------------

create or replace function public.get_my_support_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = private, pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  return jsonb_build_object('tickets', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', t.id, 'organization_id', t.organization_id, 'shop_id', t.shop_id,
        'ticket_number', t.ticket_number, 'subject', t.subject, 'status', t.status,
        'priority', t.priority, 'created_at', t.created_at, 'updated_at', t.updated_at,
        'resolved_at', t.resolved_at,
        'messages', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', m.id, 'author_type', m.author_type, 'body', m.body,
            'attachments', m.attachments, 'created_at', m.created_at
          ) order by m.created_at)
          from public.platform_support_ticket_messages m
          where m.ticket_id = t.id and not m.internal
        ), '[]'::jsonb)
      ) order by t.updated_at desc
    )
    from public.platform_support_tickets t
    where private.has_organization_access(t.organization_id, array['organization_owner'])
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.get_my_support_snapshot() from public, anon;
grant execute on function public.get_my_support_snapshot() to authenticated, service_role;

create or replace function public.tenant_support_command(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = private, pg_catalog
as $$
declare
  v_ticket public.platform_support_tickets%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  case p_action
    when 'create' then
      if not private.has_organization_access((p_payload ->> 'organization_id')::uuid, array['organization_owner']) then
        raise exception 'Seul le propriétaire peut contacter le support pour cette organisation' using errcode = '42501';
      end if;
      if nullif(p_payload ->> 'shop_id', '') is not null and not exists (
        select 1 from public.shops s where s.id = (p_payload ->> 'shop_id')::uuid
          and s.organization_id = (p_payload ->> 'organization_id')::uuid
      ) then
        raise exception 'Agence invalide' using errcode = '22023';
      end if;
      insert into public.platform_support_tickets (
        organization_id, shop_id, requester_user_id, subject, priority
      ) values (
        (p_payload ->> 'organization_id')::uuid, nullif(p_payload ->> 'shop_id', '')::uuid,
        auth.uid(), btrim(p_payload ->> 'subject'), coalesce(nullif(p_payload ->> 'priority', ''), 'normal')
      ) returning * into v_ticket;
      insert into public.platform_support_ticket_messages (
        organization_id, ticket_id, author_user_id, author_type, body, attachments
      ) values (
        v_ticket.organization_id, v_ticket.id, auth.uid(), 'tenant',
        btrim(p_payload ->> 'body'), coalesce(p_payload -> 'attachments', '[]'::jsonb)
      );
      insert into public.platform_notifications (
        kind, severity, title, body, organization_id, resource_type, resource_id, dedupe_key
      ) values (
        'support', 'info', 'Nouveau ticket client', v_ticket.ticket_number || ' · ' || v_ticket.subject,
        v_ticket.organization_id, 'platform_support_ticket', v_ticket.id, 'ticket-created-' || v_ticket.id::text
      );
    when 'reply' then
      select * into v_ticket from public.platform_support_tickets
      where id = (p_payload ->> 'ticket_id')::uuid
        and private.has_organization_access(organization_id, array['organization_owner']);
      if not found then raise exception 'Ticket introuvable ou accès refusé' using errcode = '42501'; end if;
      insert into public.platform_support_ticket_messages (
        organization_id, ticket_id, author_user_id, author_type, body, attachments
      ) values (
        v_ticket.organization_id, v_ticket.id, auth.uid(), 'tenant',
        btrim(p_payload ->> 'body'), coalesce(p_payload -> 'attachments', '[]'::jsonb)
      );
      update public.platform_support_tickets set status = 'open', resolved_at = null where id = v_ticket.id;
      insert into public.platform_notifications (
        kind, severity, title, body, organization_id, resource_type, resource_id, dedupe_key
      ) values (
        'support', 'info', 'Réponse client sur un ticket', v_ticket.ticket_number || ' · ' || v_ticket.subject,
        v_ticket.organization_id, 'platform_support_ticket', v_ticket.id,
        'ticket-reply-' || v_ticket.id::text || '-' || clock_timestamp()::text
      );
    else
      raise exception 'Action support inconnue' using errcode = '22023';
  end case;
  return public.get_my_support_snapshot();
end;
$$;

revoke all on function public.tenant_support_command(text, jsonb) from public, anon;
grant execute on function public.tenant_support_command(text, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. Annonces ciblées et maintenance dans l'ERP
-- ---------------------------------------------------------------------------

create or replace function public.get_platform_public_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = private, pg_catalog
as $$
declare
  v_config public.platform_config%rowtype;
  v_campaign public.platform_campaigns%rowtype;
begin
  select * into v_config from public.platform_config where id = 1;
  select * into v_campaign
  from public.platform_campaigns c
  where c.status = 'published' and 'in_app' = any(c.channels)
    and coalesce(c.starts_at, '-infinity'::timestamptz) <= now()
    and coalesce(c.ends_at, 'infinity'::timestamptz) > now()
    and (
      c.audience_type = 'all'
      or (c.audience_type = 'organization' and exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid() and m.status = 'active'
          and m.organization_id::text = c.audience_value
      ))
      or (c.audience_type = 'plan' and exists (
        select 1 from public.memberships m
        join public.shop_subscriptions s on s.organization_id = m.organization_id
        where m.user_id = auth.uid() and m.status = 'active'
          and s.plan = c.audience_value
      ))
    )
  order by c.maintenance desc, c.created_at desc limit 1;

  return jsonb_build_object(
    'registrations_open', coalesce(v_config.registrations_open, true),
    'support_message', coalesce(v_campaign.body, v_config.support_message, ''),
    'support_message_tone', coalesce(v_campaign.tone, v_config.support_message_tone, 'info'),
    'updated_at', coalesce(v_campaign.updated_at, v_config.updated_at),
    'campaign_id', v_campaign.id,
    'campaign_title', v_campaign.title,
    'maintenance_mode', coalesce(v_campaign.maintenance, false)
  );
end;
$$;

-- Bucket privé facultatif dans les environnements dotés de Supabase Storage.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'platform-support', 'platform-support', false, 5242880,
      array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
    ) on conflict (id) do nothing;

    drop policy if exists platform_support_files_select on storage.objects;
    create policy platform_support_files_select on storage.objects
    for select to authenticated using (
      bucket_id = 'platform-support' and (
        private.is_platform_admin()
        or private.has_organization_access(((storage.foldername(name))[1])::uuid, array['organization_owner'])
      )
    );
    drop policy if exists platform_support_files_insert on storage.objects;
    create policy platform_support_files_insert on storage.objects
    for insert to authenticated with check (
      bucket_id = 'platform-support' and (
        private.is_platform_admin()
        or private.has_organization_access(((storage.foldername(name))[1])::uuid, array['organization_owner'])
      )
    );
  end if;
end;
$$;

-- L'état lu par l'agence suit la durée d'essai administrable et sa date
-- personnalisée, au lieu de conserver une constante de 14 jours dans l'écran.
create or replace function public.get_shop_subscription_state(p_shop_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = private, pg_catalog
as $$
declare
  v_sub public.shop_subscriptions%rowtype;
  v_terms public.platform_subscription_terms%rowtype;
  v_offer public.platform_plan_offers%rowtype;
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
  select * into v_terms from public.platform_subscription_terms where shop_id = p_shop_id;
  select * into v_offer from public.platform_plan_offers where plan = 'free';

  v_effective := private.effective_plan(p_shop_id);
  select * into v_limits from private.plan_limits(v_effective);
  v_trial_end := coalesce(
    v_terms.trial_ends_on::timestamptz + interval '1 day',
    v_sub.trial_started_at + make_interval(days => coalesce(v_offer.trial_days, 14))
  );

  select count(*) into v_members from public.memberships
  where organization_id = v_sub.organization_id and status = 'active';
  select count(*) into v_orders from public.orders
  where shop_id = p_shop_id and received_at >= date_trunc('month', now());
  select count(*) into v_storage from public.storage_locations where shop_id = p_shop_id;

  return jsonb_build_object(
    'plan', v_sub.plan,
    'status', v_sub.status,
    'effective_plan', v_effective,
    'requested_plan', v_sub.requested_plan,
    'requested_at', v_sub.requested_at,
    'renews_on', v_sub.renews_on,
    'trial_started_at', v_sub.trial_started_at,
    'trial_ends_at', v_trial_end,
    'trial_active', v_sub.plan = 'free' and v_sub.status <> 'suspendu' and now() < v_trial_end,
    'trial_days_left', greatest(0, ceil(extract(epoch from (v_trial_end - now())) / 86400.0))::integer,
    'limits', jsonb_build_object(
      'users', v_limits.max_users,
      'orders_per_month', v_limits.max_orders_month,
      'storage_locations', v_limits.max_storage
    ),
    'usage', jsonb_build_object(
      'users', v_members,
      'orders_this_month', v_orders,
      'storage_locations', v_storage
    ),
    'commercial_terms', jsonb_build_object(
      'custom_monthly_price_xof', v_terms.custom_monthly_price_xof,
      'auto_renew', coalesce(v_terms.auto_renew, false),
      'scheduled_plan', v_terms.scheduled_plan,
      'scheduled_change_on', v_terms.scheduled_change_on,
      'cancelled_at', v_terms.cancelled_at
    )
  );
end;
$$;
