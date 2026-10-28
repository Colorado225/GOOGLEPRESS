-- PressingPro CI — Phase 0, messagerie, notifications et garde-fous (Option B)
-- Ne pas appliquer à Pressing_Pro sans environnement de validation distinct.

-- Les clés composites définies avec les commandes et tournées rattachent
-- chaque conversation au bon client, et pas seulement à la bonne agence.

-- ---------------------------------------------------------------------------
-- Conversations intégrées client ↔ pressing
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  customer_id uuid not null,
  order_id uuid,
  logistics_task_id uuid,
  conversation_type text not null default 'general'
    check (conversation_type in ('general', 'order', 'logistics', 'support')),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'archived')),
  assigned_to uuid references public.profiles(user_id) on delete set null,
  last_message_id uuid,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  foreign key (organization_id, customer_id)
    references public.customers(organization_id, id) on delete restrict,
  foreign key (organization_id, shop_id, customer_id, order_id)
    references public.orders(organization_id, shop_id, customer_id, id) on delete restrict,
  foreign key (organization_id, shop_id, customer_id, logistics_task_id)
    references public.logistics_tasks(organization_id, shop_id, customer_id, id) on delete restrict,
  unique (organization_id, shop_id, customer_id, id),
  check (conversation_type <> 'order' or order_id is not null),
  check (conversation_type <> 'logistics' or logistics_task_id is not null)
);

create unique index conversations_one_open_general_uq
  on public.conversations (shop_id, customer_id)
  where conversation_type = 'general' and status = 'open';
create index conversations_shop_status_activity_idx
  on public.conversations (shop_id, status, last_message_at desc nulls last);
create index conversations_customer_activity_idx
  on public.conversations (customer_id, last_message_at desc nulls last);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  customer_id uuid not null,
  conversation_id uuid not null,
  sender_type text not null check (sender_type in ('customer', 'staff', 'system')),
  sender_user_id uuid references public.profiles(user_id) on delete set null,
  message_kind text not null default 'text'
    check (message_kind in ('text', 'status_event', 'quick_action', 'media', 'system_card')),
  body text not null check (length(btrim(body)) between 1 and 8000),
  event_key text,
  metadata jsonb not null default '{}'::jsonb,
  client_idempotency_key text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, shop_id, customer_id, conversation_id)
    references public.conversations(organization_id, shop_id, customer_id, id) on delete restrict,
  unique (organization_id, shop_id, customer_id, conversation_id, id),
  unique (conversation_id, id),
  check (sender_type = 'system' or sender_user_id is not null)
);

create unique index messages_idempotency_uq
  on public.messages (conversation_id, client_idempotency_key)
  where client_idempotency_key is not null;
create unique index messages_event_key_uq
  on public.messages (conversation_id, event_key)
  where event_key is not null;
create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at, id);

alter table public.conversations
  add constraint conversations_last_message_fk
  foreign key (organization_id, shop_id, customer_id, id, last_message_id)
  references public.messages(organization_id, shop_id, customer_id, conversation_id, id)
  on delete set null (last_message_id);

create table public.conversation_reads (
  conversation_id uuid not null,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  last_read_message_id uuid,
  last_read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id),
  foreign key (conversation_id) references public.conversations(id) on delete cascade,
  foreign key (conversation_id, last_read_message_id)
    references public.messages(conversation_id, id)
    on delete set null (last_read_message_id)
);

create table public.conversation_internal_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  customer_id uuid not null,
  conversation_id uuid not null,
  author_user_id uuid not null references public.profiles(user_id) on delete restrict,
  body text not null check (length(btrim(body)) between 1 and 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id, customer_id, conversation_id)
    references public.conversations(organization_id, shop_id, customer_id, id) on delete restrict
);

create index conversation_internal_notes_conversation_idx
  on public.conversation_internal_notes (conversation_id, created_at);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  event_key text not null check (length(btrim(event_key)) between 1 and 100),
  channel text not null check (channel in ('in_app', 'push', 'whatsapp', 'sms', 'email')),
  locale text not null default 'fr-CI',
  subject text,
  body text not null check (length(btrim(body)) >= 1),
  allowed_variables jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  provider_status text,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  unique (shop_id, event_key, channel, locale, version),
  check (jsonb_typeof(allowed_variables) = 'array')
);

create unique index message_templates_one_active_uq
  on public.message_templates (shop_id, event_key, channel, locale)
  where status = 'active';

create table public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  title text not null check (length(btrim(title)) between 1 and 120),
  body text not null check (length(btrim(body)) between 1 and 4000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  unique (shop_id, title)
);

-- ---------------------------------------------------------------------------
-- Notifications transactionnelles et préférences
-- ---------------------------------------------------------------------------

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  shop_id uuid,
  customer_id uuid,
  recipient_user_id uuid references public.profiles(user_id) on delete cascade,
  event_key text not null check (length(btrim(event_key)) between 1 and 150),
  aggregate_type text,
  aggregate_id uuid,
  conversation_id uuid references public.conversations(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  requested_channels jsonb not null default '["in_app"]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  scheduled_for timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  foreign key (organization_id, customer_id)
    references public.customers(organization_id, id) on delete restrict,
  check (jsonb_typeof(requested_channels) = 'array')
);

create unique index notification_outbox_event_key_uq
  on public.notification_outbox (event_key);
create index notification_outbox_due_idx
  on public.notification_outbox (status, scheduled_for, created_at);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.notification_outbox(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'push', 'whatsapp', 'sms', 'email')),
  provider text,
  provider_message_id text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
  attempt_number integer not null default 1 check (attempt_number >= 1),
  error_code text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outbox_id, channel, attempt_number)
);

create index notification_deliveries_status_idx
  on public.notification_deliveries (status, channel, created_at);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  endpoint text not null unique,
  subscription_keys jsonb not null,
  user_agent text,
  device_label text,
  is_revoked boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(subscription_keys) = 'object')
);

create index push_subscriptions_user_idx
  on public.push_subscriptions (user_id, is_revoked);

create table public.communication_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  customer_id uuid not null,
  user_id uuid references public.profiles(user_id) on delete set null,
  transactional_in_app boolean not null default true,
  transactional_push boolean not null default true,
  transactional_whatsapp boolean not null default false,
  transactional_whatsapp_consented_at timestamptz,
  transactional_sms boolean not null default false,
  transactional_sms_consented_at timestamptz,
  transactional_email boolean not null default false,
  marketing_opt_in boolean not null default false,
  marketing_consented_at timestamptz,
  consent_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, customer_id)
    references public.customers(organization_id, id) on delete restrict,
  unique (customer_id),
  check (not transactional_whatsapp or transactional_whatsapp_consented_at is not null),
  check (not transactional_sms or transactional_sms_consented_at is not null),
  check (not marketing_opt_in or marketing_consented_at is not null)
);

create table public.messaging_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  channel text not null check (channel in ('whatsapp', 'sms', 'email')),
  provider text not null,
  sender_identifier text not null,
  credential_secret_ref text,
  status text not null default 'draft'
    check (status in ('draft', 'pending_validation', 'active', 'suspended')),
  daily_limit integer check (daily_limit is null or daily_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  unique (shop_id, channel, provider, sender_identifier)
);

create table public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  shop_id uuid,
  provider text not null,
  external_event_id text not null,
  event_type text,
  signature_valid boolean,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  received_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  unique (provider, external_event_id)
);

create table public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  shop_id uuid,
  metric text not null check (length(btrim(metric)) between 1 and 100),
  period_start date not null,
  quantity bigint not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict
);

create unique index usage_counters_scope_uq
  on public.usage_counters (
    organization_id,
    coalesce(shop_id, '00000000-0000-0000-0000-000000000000'::uuid),
    metric,
    period_start
  );

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  shop_id uuid,
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  actor_type text not null check (actor_type in ('platform', 'staff', 'customer', 'system')),
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict
);

create index audit_log_scope_created_idx
  on public.audit_log (organization_id, shop_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Fonctions privées d'appartenance utilisées par RLS
-- ---------------------------------------------------------------------------

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.is_active
  );
$$;

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
    from public.memberships m
    where m.user_id = auth.uid()
      and m.organization_id = target_organization_id
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
    join public.memberships m
      on m.organization_id = s.organization_id
     and (m.shop_id is null or m.shop_id = s.id)
    where s.id = target_shop_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;

create or replace function private.is_organization_customer(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select exists (
    select 1
    from public.customer_account_links l
    where l.user_id = auth.uid()
      and l.organization_id = target_organization_id
      and l.status = 'active'
  );
$$;

create or replace function private.is_customer_linked(target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select exists (
    select 1
    from public.customer_account_links l
    where l.user_id = auth.uid()
      and l.customer_id = target_customer_id
      and l.status = 'active'
  );
$$;

create or replace function private.shares_organization_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and theirs.user_id = target_user_id
      and mine.status = 'active'
      and theirs.status = 'active'
  );
$$;

create or replace function private.is_assigned_employee(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.employee_id = target_employee_id
      and m.status = 'active'
  );
$$;

create or replace function private.can_access_conversation(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = target_conversation_id
      and (
        private.has_shop_access(
          c.shop_id,
          array['organization_owner', 'shop_manager', 'cashier', 'workshop']
        )
        or (
          c.logistics_task_id is not null
          and private.has_shop_access(c.shop_id, array['courier'])
          and exists (
            select 1
            from public.logistics_tasks t
            where t.id = c.logistics_task_id
              and private.is_assigned_employee(t.assigned_employee_id)
          )
        )
        or private.is_customer_linked(c.customer_id)
      )
  );
$$;

revoke all on function private.is_platform_admin() from public, anon;
revoke all on function private.has_organization_access(uuid, text[]) from public, anon;
revoke all on function private.has_shop_access(uuid, text[]) from public, anon;
revoke all on function private.is_organization_customer(uuid) from public, anon;
revoke all on function private.is_customer_linked(uuid) from public, anon;
revoke all on function private.shares_organization_with(uuid) from public, anon;
revoke all on function private.is_assigned_employee(uuid) from public, anon;
revoke all on function private.can_access_conversation(uuid) from public, anon;

grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.has_organization_access(uuid, text[]) to authenticated;
grant execute on function private.has_shop_access(uuid, text[]) to authenticated;
grant execute on function private.is_organization_customer(uuid) to authenticated;
grant execute on function private.is_customer_linked(uuid) to authenticated;
grant execute on function private.shares_organization_with(uuid) to authenticated;
grant execute on function private.is_assigned_employee(uuid) to authenticated;
grant execute on function private.can_access_conversation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Déclencheurs métier atomiques
-- ---------------------------------------------------------------------------

create or replace function private.assign_ticket_number()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_next_after bigint;
begin
  -- Un utilisateur API ne choisit jamais son numéro : seuls les imports
  -- serveur contrôlés peuvent fournir un numéro historique explicite.
  if auth.uid() is not null then
    new.ticket_number = null;
  end if;

  if new.ticket_number is not null then
    insert into public.ticket_counters (shop_id, organization_id, next_number)
    values (new.shop_id, new.organization_id, new.ticket_number + 1)
    on conflict (shop_id) do update
      set next_number = greatest(public.ticket_counters.next_number, excluded.next_number),
          updated_at = now();
    return new;
  end if;

  insert into public.ticket_counters (shop_id, organization_id, next_number)
  values (new.shop_id, new.organization_id, 2)
  on conflict (shop_id) do update
    set next_number = public.ticket_counters.next_number + 1,
        updated_at = now()
  returning next_number into v_next_after;

  new.ticket_number = v_next_after - 1;
  return new;
end;
$$;

create or replace function private.log_order_status_event()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.order_events (
      organization_id, shop_id, order_id, event_type,
      from_status, to_status, visibility, actor_type, actor_user_id, payload
    ) values (
      new.organization_id,
      new.shop_id,
      new.id,
      case
        when tg_op = 'INSERT' then 'order.created'
        else 'order.status_changed'
      end,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      'customer',
      case when auth.uid() is null then 'system' else 'staff' end,
      auth.uid(),
      jsonb_build_object('ticket_label', new.ticket_label)
    );
  end if;
  return new;
end;
$$;

create or replace function private.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_before numeric(14,3);
  v_after numeric(14,3);
begin
  select current_quantity
    into v_before
  from public.products
  where id = new.product_id
    and organization_id = new.organization_id
    and shop_id = new.shop_id
  for update;

  if not found then
    raise exception 'Produit absent du périmètre agence' using errcode = '23503';
  end if;

  v_after = case new.movement_type
    when 'in' then v_before + new.quantity_input
    when 'out' then v_before - new.quantity_input
    when 'adjustment' then new.quantity_input
  end;

  if v_after < 0 then
    raise exception 'Le stock ne peut pas devenir négatif' using errcode = '23514';
  end if;

  new.quantity_before = v_before;
  new.quantity_after = v_after;
  new.quantity_delta = v_after - v_before;

  update public.products
  set current_quantity = v_after,
      unit_cost_xof = coalesce(new.unit_cost_xof, unit_cost_xof),
      updated_at = now()
  where id = new.product_id;

  return new;
end;
$$;

create or replace function private.prepare_message_sender()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  if auth.uid() is not null then
    -- Les cartes de statut et clés d'événement sont produites côté serveur.
    if new.sender_type = 'system'
       or new.message_kind in ('status_event', 'system_card') then
      raise exception 'Message automatique réservé au serveur' using errcode = '42501';
    end if;
    new.event_key = null;
    new.created_at = now();
  end if;

  if new.sender_type in ('customer', 'staff') and auth.uid() is not null then
    if new.sender_user_id is null then
      new.sender_user_id = auth.uid();
    elsif new.sender_user_id <> auth.uid() then
      raise exception 'Expéditeur différent de l’utilisateur connecté' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.touch_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  update public.conversations
  set last_message_id = new.id,
      last_message_at = new.created_at,
      last_message_preview = left(new.body, 140),
      updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function private.assign_ticket_number() from public, anon;
revoke all on function private.log_order_status_event() from public, anon;
revoke all on function private.apply_stock_movement() from public, anon;
revoke all on function private.prepare_message_sender() from public, anon;
revoke all on function private.touch_conversation_after_message() from public, anon;

grant execute on function private.assign_ticket_number() to authenticated, service_role;
grant execute on function private.log_order_status_event() to authenticated, service_role;
grant execute on function private.apply_stock_movement() to authenticated, service_role;
grant execute on function private.prepare_message_sender() to authenticated, service_role;
grant execute on function private.touch_conversation_after_message() to authenticated, service_role;

drop trigger if exists orders_assign_ticket_number on public.orders;
create trigger orders_assign_ticket_number
before insert on public.orders
for each row execute function private.assign_ticket_number();

drop trigger if exists orders_log_status_event on public.orders;
create trigger orders_log_status_event
after insert or update of status on public.orders
for each row execute function private.log_order_status_event();

drop trigger if exists stock_movements_apply on public.stock_movements;
create trigger stock_movements_apply
before insert on public.stock_movements
for each row execute function private.apply_stock_movement();

drop trigger if exists messages_prepare_sender on public.messages;
create trigger messages_prepare_sender
before insert on public.messages
for each row execute function private.prepare_message_sender();

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
after insert on public.messages
for each row execute function private.touch_conversation_after_message();

-- updated_at sur toutes les tables publiques qui portent cette colonne.
do $$
declare
  v_table text;
begin
  for v_table in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
  loop
    execute format('drop trigger if exists %I on public.%I', 'set_updated_at_' || v_table, v_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      'set_updated_at_' || v_table,
      v_table
    );
  end loop;
end;
$$;
