-- PressingPro CI — Phase 0, opérations métier (Option B)
-- Ne pas appliquer à Pressing_Pro sans environnement de validation distinct.

-- ---------------------------------------------------------------------------
-- Rangement et compteur de tickets
-- ---------------------------------------------------------------------------

create table public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  legacy_id text,
  code text not null check (
    code = upper(code)
    and code ~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$'
    and length(code) <= 16
  ),
  label text not null check (length(btrim(label)) between 1 and 160),
  zone text not null check (
    zone in ('hanging', 'folded', 'delivery', 'bulky', 'hold', 'other')
  ),
  capacity_packages integer not null check (capacity_packages between 1 and 999),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  unique (shop_id, code),
  unique (shop_id, id)
);

create unique index storage_locations_legacy_id_uq
  on public.storage_locations (shop_id, legacy_id)
  where legacy_id is not null;
create index storage_locations_shop_active_idx
  on public.storage_locations (shop_id, is_active, code);

create table public.ticket_counters (
  shop_id uuid primary key,
  organization_id uuid not null,
  prefix text not null default '#TK-' check (length(prefix) between 1 and 16),
  next_number bigint not null default 1 check (next_number >= 1),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Commandes et historique d'événements
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  customer_id uuid not null,
  legacy_id text,
  ticket_number bigint not null check (ticket_number > 0),
  ticket_label text generated always as ('#TK-' || ticket_number::text) stored,
  service_category text not null default 'pressing'
    check (service_category in ('pressing', 'blanchisserie')),
  customer_name_snapshot text not null,
  customer_phone_snapshot text not null,
  customer_address_snapshot text,
  lines jsonb not null check (
    jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) > 0
  ),
  subtotal_xof bigint not null check (subtotal_xof >= 0),
  service_fees_xof bigint not null default 0 check (service_fees_xof >= 0),
  collection_fee_xof bigint not null default 0 check (collection_fee_xof >= 0),
  delivery_fee_xof bigint not null default 0 check (delivery_fee_xof >= 0),
  discount_xof bigint not null default 0 check (discount_xof >= 0),
  total_xof bigint not null check (total_xof >= 0),
  deposit_paid_xof bigint not null default 0 check (deposit_paid_xof >= 0),
  remaining_balance_xof bigint generated always as (total_xof - deposit_paid_xof) stored,
  payment_method text not null
    check (payment_method in ('especes', 'wave', 'momo', 'om')),
  status text not null default 'received'
    check (status in ('received', 'washing', 'ironing', 'ready', 'delivered')),
  received_at timestamptz not null default now(),
  promised_at timestamptz not null,
  ready_at timestamptz,
  delivered_at timestamptz,
  notes text,
  is_late boolean not null default false,
  is_urgent boolean not null default false,
  rack_location_snapshot text,
  storage_location_id uuid,
  storage_location_code_snapshot text,
  storage_location_label_snapshot text,
  storage_package_count integer check (
    storage_package_count is null or storage_package_count between 1 and 999
  ),
  storage_notes text,
  stored_at timestamptz,
  machine_assigned text,
  assignee_name_snapshot text,
  progress_percent integer check (
    progress_percent is null or progress_percent between 0 and 100
  ),
  legacy_sms_sent boolean not null default false,
  origin text not null default 'counter'
    check (origin in ('counter', 'home_pickup')),
  fulfillment_method text not null default 'counter_pickup'
    check (fulfillment_method in ('counter_pickup', 'home_delivery')),
  collection_address_snapshot text,
  collection_address_details_snapshot text,
  collection_date date,
  collection_time_slot text check (
    collection_time_slot is null or collection_time_slot in
      ('08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00', '18:00-20:00')
  ),
  delivery_address_snapshot text,
  delivery_address_details_snapshot text,
  delivery_date date,
  delivery_time_slot text check (
    delivery_time_slot is null or delivery_time_slot in
      ('08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00', '18:00-20:00')
  ),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  foreign key (organization_id, customer_id)
    references public.customers(organization_id, id) on delete restrict,
  foreign key (shop_id, storage_location_id)
    references public.storage_locations(shop_id, id)
    on delete set null (storage_location_id),
  unique (organization_id, shop_id, id),
  unique (organization_id, shop_id, customer_id, id),
  unique (shop_id, ticket_number),
  check (deposit_paid_xof <= total_xof),
  check (
    storage_location_id is null
    or storage_package_count is not null
  ),
  check (status <> 'ready' or ready_at is not null),
  check (status <> 'delivered' or delivered_at is not null)
);

create unique index orders_legacy_id_uq
  on public.orders (shop_id, legacy_id)
  where legacy_id is not null;
create index orders_shop_status_promised_idx
  on public.orders (shop_id, status, promised_at);
create index orders_customer_created_idx
  on public.orders (customer_id, created_at desc);
create index orders_storage_location_idx
  on public.orders (shop_id, storage_location_id, status)
  where storage_location_id is not null;

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  order_id uuid not null,
  event_type text not null check (length(btrim(event_type)) between 1 and 100),
  from_status text check (
    from_status is null or from_status in ('received', 'washing', 'ironing', 'ready', 'delivered')
  ),
  to_status text check (
    to_status is null or to_status in ('received', 'washing', 'ironing', 'ready', 'delivered')
  ),
  visibility text not null default 'customer'
    check (visibility in ('customer', 'internal')),
  actor_type text not null default 'system'
    check (actor_type in ('staff', 'customer', 'system')),
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, shop_id, order_id)
    references public.orders(organization_id, shop_id, id) on delete restrict
);

create index order_events_order_created_idx
  on public.order_events (order_id, created_at, id);

-- ---------------------------------------------------------------------------
-- Tournées ramassage/livraison et demandes client
-- ---------------------------------------------------------------------------

create table public.logistics_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  legacy_id text,
  kind text not null check (kind in ('pickup', 'delivery')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'en_route', 'completed', 'failed', 'cancelled')),
  customer_id uuid not null,
  customer_name_snapshot text not null,
  customer_phone_snapshot text not null,
  address text not null,
  address_details text,
  scheduled_date date not null,
  time_slot text not null check (
    time_slot in ('08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00', '18:00-20:00')
  ),
  assigned_employee_id uuid,
  assigned_employee_name_snapshot text,
  order_id uuid,
  order_ticket_label_snapshot text,
  fee_xof bigint not null default 0 check (fee_xof >= 0),
  estimated_bags integer check (estimated_bags is null or estimated_bags between 1 and 999),
  collected_bags integer check (collected_bags is null or collected_bags between 0 and 999),
  instructions text,
  issue_reason text check (
    issue_reason is null or issue_reason in (
      'customer_absent', 'customer_unreachable', 'address_issue',
      'payment_unavailable', 'customer_request', 'other'
    )
  ),
  issue_notes text,
  started_at timestamptz,
  completed_at timestamptz,
  collected_amount_xof bigint check (collected_amount_xof is null or collected_amount_xof >= 0),
  collected_payment_method text check (
    collected_payment_method is null
    or collected_payment_method in ('especes', 'wave', 'momo', 'om')
  ),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  foreign key (organization_id, customer_id)
    references public.customers(organization_id, id) on delete restrict,
  foreign key (organization_id, shop_id, assigned_employee_id)
    references public.employees(organization_id, shop_id, id)
    on delete set null (assigned_employee_id),
  foreign key (organization_id, shop_id, customer_id, order_id)
    references public.orders(organization_id, shop_id, customer_id, id)
    on delete restrict,
  unique (organization_id, shop_id, id),
  unique (organization_id, shop_id, customer_id, id),
  check (kind <> 'delivery' or order_id is not null),
  check (status <> 'completed' or completed_at is not null)
);

create unique index logistics_tasks_legacy_id_uq
  on public.logistics_tasks (shop_id, legacy_id)
  where legacy_id is not null;
create index logistics_tasks_shop_schedule_idx
  on public.logistics_tasks (shop_id, scheduled_date, time_slot, status);
create index logistics_tasks_customer_idx
  on public.logistics_tasks (customer_id, created_at desc);
create index logistics_tasks_order_idx
  on public.logistics_tasks (order_id, kind)
  where order_id is not null;

create table public.pickup_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  customer_id uuid,
  requester_user_id uuid references public.profiles(user_id) on delete set null,
  contact_name text not null,
  contact_phone_display text not null,
  contact_phone_e164 text check (
    contact_phone_e164 is null or contact_phone_e164 ~ '^\+[1-9][0-9]{6,14}$'
  ),
  address text not null,
  address_details text,
  requested_date date not null,
  requested_time_slot text not null check (
    requested_time_slot in ('08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00', '18:00-20:00')
  ),
  estimated_bags integer check (estimated_bags is null or estimated_bags between 1 and 999),
  instructions text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'converted', 'cancelled', 'rejected')),
  staff_notes text,
  converted_task_id uuid,
  source text not null default 'customer_portal'
    check (source in ('customer_portal', 'public_page', 'staff')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  foreign key (organization_id, customer_id)
    references public.customers(organization_id, id) on delete restrict,
  foreign key (organization_id, shop_id, customer_id, converted_task_id)
    references public.logistics_tasks(organization_id, shop_id, customer_id, id)
    on delete set null (converted_task_id)
);

create unique index pickup_requests_idempotency_uq
  on public.pickup_requests (shop_id, idempotency_key)
  where idempotency_key is not null;
create index pickup_requests_shop_status_idx
  on public.pickup_requests (shop_id, status, requested_date);

-- ---------------------------------------------------------------------------
-- Caisse, stock et dépenses
-- ---------------------------------------------------------------------------

create table public.cash_register_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  business_date date not null,
  cash_amount_xof bigint not null default 0 check (cash_amount_xof >= 0),
  wave_amount_xof bigint not null default 0 check (wave_amount_xof >= 0),
  mobile_money_amount_xof bigint not null default 0 check (mobile_money_amount_xof >= 0),
  total_amount_xof bigint generated always as (
    cash_amount_xof + wave_amount_xof + mobile_money_amount_xof
  ) stored,
  float_amount_xof bigint not null default 0 check (float_amount_xof >= 0),
  monthly_target_xof bigint not null default 0 check (monthly_target_xof >= 0),
  month_achieved_xof bigint not null default 0 check (month_achieved_xof >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  closed_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  unique (shop_id, business_date),
  check (status <> 'closed' or closed_at is not null)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  legacy_id text,
  name text not null check (length(btrim(name)) between 1 and 160),
  reference text not null check (length(btrim(reference)) between 1 and 100),
  category text not null check (length(btrim(category)) between 1 and 120),
  unit text not null check (length(btrim(unit)) between 1 and 40),
  current_quantity numeric(14,3) not null default 0 check (current_quantity >= 0),
  alert_threshold numeric(14,3) not null default 0 check (alert_threshold >= 0),
  unit_cost_xof bigint check (unit_cost_xof is null or unit_cost_xof >= 0),
  supplier text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  unique (shop_id, reference),
  unique (organization_id, shop_id, id)
);

create unique index products_legacy_id_uq
  on public.products (shop_id, legacy_id)
  where legacy_id is not null;
create index products_shop_active_idx
  on public.products (shop_id, is_active, name);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  product_id uuid not null,
  legacy_id text,
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment')),
  quantity_input numeric(14,3) not null check (quantity_input >= 0),
  quantity_delta numeric(14,3),
  quantity_before numeric(14,3),
  quantity_after numeric(14,3),
  business_date date not null,
  reason text not null check (length(btrim(reason)) >= 1),
  unit_cost_xof bigint check (unit_cost_xof is null or unit_cost_xof >= 0),
  note text,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, shop_id, product_id)
    references public.products(organization_id, shop_id, id) on delete restrict
);

create unique index stock_movements_legacy_id_uq
  on public.stock_movements (shop_id, legacy_id)
  where legacy_id is not null;
create index stock_movements_product_date_idx
  on public.stock_movements (product_id, business_date, created_at);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  legacy_id text,
  label text not null check (length(btrim(label)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, label),
  unique (organization_id, id)
);

create unique index expense_categories_legacy_id_uq
  on public.expense_categories (organization_id, legacy_id)
  where legacy_id is not null;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  category_id uuid not null,
  legacy_id text,
  label text not null check (length(btrim(label)) between 1 and 200),
  amount_xof bigint not null check (amount_xof > 0),
  business_date date not null,
  payment_method text not null check (
    payment_method in ('cash', 'wave', 'orange_money', 'mtn_momo', 'transfer', 'other')
  ),
  supplier text,
  reference text,
  description text,
  status text not null default 'recorded' check (status in ('recorded', 'cancelled')),
  cancellation_reason text,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id)
    references public.shops(organization_id, id) on delete restrict,
  foreign key (organization_id, category_id)
    references public.expense_categories(organization_id, id) on delete restrict,
  check (status <> 'cancelled' or cancellation_reason is not null)
);

create unique index expenses_legacy_id_uq
  on public.expenses (shop_id, legacy_id)
  where legacy_id is not null;
create index expenses_shop_date_idx
  on public.expenses (shop_id, business_date, status);
