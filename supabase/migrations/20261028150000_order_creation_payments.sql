-- PressingPro CI — création de commande atomique et journal de paiements
--
-- Objectifs :
-- 1. empêcher le navigateur d'imposer les tarifs et totaux d'une commande ;
-- 2. rendre la création idempotente et conserver la numérotation existante ;
-- 3. remplacer les montants encaissés mutables par un journal `payments` ;
-- 4. recalculer l'acompte d'une commande depuis les écritures confirmées ;
-- 5. empêcher les écritures PostgREST directes sur les champs sensibles.
--
-- Cette migration est additive pour les données existantes. Les acomptes
-- déjà présents dans `orders.deposit_paid_xof` sont recopiés une fois comme
-- paiements historiques confirmés, avec `legacy_backfill=true`.

alter table public.orders
  add column if not exists idempotency_key text,
  alter column payment_method drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_idempotency_key_format'
  ) then
    alter table public.orders
      add constraint orders_idempotency_key_format
      check (
        idempotency_key is null
        or length(btrim(idempotency_key)) between 8 and 120
      );
  end if;
end;
$$;

create unique index if not exists orders_shop_idempotency_uq
  on public.orders (shop_id, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- Journal de paiements
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  order_id uuid not null,
  kind text not null check (kind in ('payment', 'refund', 'reversal')),
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'failed', 'cancelled')),
  amount_xof bigint not null check (amount_xof > 0),
  currency text not null default 'XOF' check (currency = 'XOF'),
  method text not null
    check (method in ('cash', 'mobile_money', 'transfer', 'card', 'other')),
  provider text not null
    check (
      provider in (
        'cash', 'wave', 'orange_money', 'mtn_momo',
        'bank_transfer', 'bank_card', 'other'
      )
    ),
  external_reference text check (
    external_reference is null
    or length(btrim(external_reference)) between 1 and 160
  ),
  idempotency_key text not null
    check (length(btrim(idempotency_key)) between 8 and 120),
  reverses_payment_id uuid,
  recorded_by uuid references public.profiles(user_id) on delete set null,
  confirmed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, shop_id, order_id)
    references public.orders(organization_id, shop_id, id) on delete restrict,
  foreign key (organization_id, shop_id, order_id, reverses_payment_id)
    references public.payments(organization_id, shop_id, order_id, id)
    on delete restrict,
  unique (organization_id, shop_id, order_id, id),
  check (
    (method = 'cash' and provider = 'cash')
    or (method = 'mobile_money' and provider in ('wave', 'orange_money', 'mtn_momo'))
    or (method = 'transfer' and provider in ('bank_transfer', 'other'))
    or (method = 'card' and provider = 'bank_card')
    or (method = 'other' and provider = 'other')
  ),
  check (status <> 'confirmed' or confirmed_at is not null),
  check (kind = 'payment' or reverses_payment_id is not null),
  check (kind <> 'payment' or reverses_payment_id is null)
);

create unique index if not exists payments_shop_idempotency_uq
  on public.payments (shop_id, idempotency_key);
create index if not exists payments_order_created_idx
  on public.payments (order_id, created_at, id);
create index if not exists payments_shop_confirmed_idx
  on public.payments (shop_id, status, confirmed_at desc)
  where status = 'confirmed';
create index if not exists payments_reverses_idx
  on public.payments (reverses_payment_id)
  where reverses_payment_id is not null;
create index if not exists payments_recorded_by_idx
  on public.payments (recorded_by)
  where recorded_by is not null;

alter table public.payments replica identity full;

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function private.set_updated_at();

-- Recopie unique des acomptes historiques. Le champ `orders.payment_method`
-- historique fusionnait déjà certaines informations ; le mapping ci-dessous
-- conserve l'interprétation existante : `momo` = MTN MoMo, `om` = Orange
-- Money. Les nouvelles écritures distinguent systématiquement le fournisseur.
insert into public.payments (
  organization_id,
  shop_id,
  order_id,
  kind,
  status,
  amount_xof,
  method,
  provider,
  idempotency_key,
  recorded_by,
  confirmed_at,
  metadata,
  created_at,
  updated_at
)
select
  o.organization_id,
  o.shop_id,
  o.id,
  'payment',
  'confirmed',
  o.deposit_paid_xof,
  case o.payment_method when 'especes' then 'cash' else 'mobile_money' end,
  case o.payment_method
    when 'especes' then 'cash'
    when 'wave' then 'wave'
    when 'momo' then 'mtn_momo'
    when 'om' then 'orange_money'
  end,
  'legacy-order-' || o.id::text,
  o.created_by,
  o.created_at,
  jsonb_build_object('legacy_backfill', true, 'legacy_method', o.payment_method),
  o.created_at,
  o.updated_at
from public.orders o
where o.deposit_paid_xof > 0
  and o.payment_method in ('especes', 'wave', 'momo', 'om')
on conflict (shop_id, idempotency_key) do nothing;

-- ---------------------------------------------------------------------------
-- RLS et privilèges du journal
-- ---------------------------------------------------------------------------

alter table public.payments enable row level security;
alter table public.payments force row level security;

revoke all on table public.payments from public, anon, authenticated;
grant select on table public.payments to authenticated;
grant select, insert, update, delete on table public.payments to service_role;

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
for select to authenticated
using (
  private.has_shop_access(
    shop_id,
    array['organization_owner', 'shop_manager', 'cashier']
  )
  or exists (
    select 1
    from public.orders o
    where o.id = payments.order_id
      and private.is_customer_linked(o.customer_id)
  )
);

-- Aucune policy ni aucun grant d'écriture pour authenticated : seules les RPC
-- métier ci-dessous peuvent créer des écritures. Une correction passe par un
-- remboursement/contre-écriture, jamais par UPDATE/DELETE du journal.

revoke insert on table public.orders from authenticated;
revoke update (deposit_paid_xof, payment_method)
  on table public.orders from authenticated;

-- ---------------------------------------------------------------------------
-- Recalculs dénormalisés depuis les sources persistées
-- ---------------------------------------------------------------------------

create or replace function private.recalculate_customer_order_aggregates(
  target_customer_id uuid
)
returns void
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  update public.customers c
  set
    deposits_count = coalesce(stats.order_count, 0),
    balance_xof = coalesce(stats.remaining_xof, 0),
    updated_at = now()
  from (
    select
      count(*)::int as order_count,
      coalesce(sum(greatest(o.remaining_balance_xof, 0)), 0)::bigint as remaining_xof
    from public.orders o
    where o.customer_id = target_customer_id
  ) stats
  where c.id = target_customer_id;
end;
$$;

create or replace function private.recalculate_order_payment_total(
  target_order_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_order public.orders%rowtype;
  v_paid_xof bigint := 0;
begin
  select *
    into v_order
  from public.orders
  where id = target_order_id;

  if not found then
    raise exception 'Commande introuvable pour recalcul du paiement'
      using errcode = 'P0002';
  end if;

  select coalesce(
    sum(
      case
        when kind = 'payment' then amount_xof
        else -amount_xof
      end
    ),
    0
  )::bigint
    into v_paid_xof
  from public.payments
  where order_id = target_order_id
    and status = 'confirmed';

  v_paid_xof := least(greatest(coalesce(v_paid_xof, 0), 0), v_order.total_xof);

  update public.orders
  set deposit_paid_xof = v_paid_xof,
      updated_at = now()
  where id = target_order_id;

  perform private.recalculate_customer_order_aggregates(v_order.customer_id);
  return v_paid_xof;
end;
$$;

revoke all on function private.recalculate_customer_order_aggregates(uuid)
  from public, anon, authenticated;
revoke all on function private.recalculate_order_payment_total(uuid)
  from public, anon, authenticated;
grant execute on function private.recalculate_customer_order_aggregates(uuid)
  to service_role;
grant execute on function private.recalculate_order_payment_total(uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Création de commande atomique et idempotente
-- ---------------------------------------------------------------------------

create or replace function public.create_order(
  p_shop_id uuid,
  p_customer_id uuid,
  p_lines jsonb,
  p_promised_at timestamptz,
  p_idempotency_key text,
  p_service_category text default 'pressing',
  p_pickup_option text default 'standard',
  p_discount_percent numeric default null,
  p_collection_fee_xof bigint default null,
  p_delivery_fee_xof bigint default null,
  p_notes text default null,
  p_origin text default 'counter',
  p_fulfillment_method text default 'counter_pickup',
  p_collection_address text default null,
  p_collection_address_details text default null,
  p_collection_date date default null,
  p_collection_time_slot text default null,
  p_delivery_address text default null,
  p_delivery_address_details text default null,
  p_delivery_date date default null,
  p_delivery_time_slot text default null
)
returns public.orders
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_idempotency_key text := btrim(coalesce(p_idempotency_key, ''));
  v_shop public.shops%rowtype;
  v_organization public.organizations%rowtype;
  v_customer public.customers%rowtype;
  v_settings public.shop_settings%rowtype;
  v_existing public.orders%rowtype;
  v_created public.orders%rowtype;
  v_line jsonb;
  v_catalog public.service_catalog_items%rowtype;
  v_catalog_ref text;
  v_legacy_key text;
  v_quantity numeric;
  v_line_subtotal bigint;
  v_canonical_lines jsonb := '[]'::jsonb;
  v_subtotal_xof bigint := 0;
  v_discount_percent numeric;
  v_discount_xof bigint := 0;
  v_express_fee_xof bigint := 0;
  v_collection_fee_xof bigint := 0;
  v_delivery_fee_xof bigint := 0;
  v_total_xof bigint := 0;
  v_color text;
  v_service_type text;
begin
  if v_actor is null then
    raise exception 'Session authentifiée requise pour créer une commande'
      using errcode = '42501';
  end if;

  if length(v_idempotency_key) not between 8 and 120 then
    raise exception 'La clé d’idempotence doit contenir entre 8 et 120 caractères'
      using errcode = '22023';
  end if;

  if p_promised_at is null then
    raise exception 'La date promise est requise'
      using errcode = '22023';
  end if;

  if coalesce(p_service_category, '') not in ('pressing', 'blanchisserie') then
    raise exception 'Catégorie de service invalide'
      using errcode = '22023';
  end if;

  if coalesce(p_pickup_option, '') not in ('standard', 'express', 'delayed') then
    raise exception 'Option de délai invalide'
      using errcode = '22023';
  end if;

  if coalesce(p_origin, '') not in ('counter', 'home_pickup') then
    raise exception 'Origine de commande invalide'
      using errcode = '22023';
  end if;

  if coalesce(p_fulfillment_method, '') not in ('counter_pickup', 'home_delivery') then
    raise exception 'Mode de restitution invalide'
      using errcode = '22023';
  end if;

  if length(coalesce(p_notes, '')) > 2000
     or length(coalesce(p_collection_address, '')) > 500
     or length(coalesce(p_collection_address_details, '')) > 500
     or length(coalesce(p_delivery_address, '')) > 500
     or length(coalesce(p_delivery_address_details, '')) > 500 then
    raise exception 'Un champ texte de la commande dépasse la longueur autorisée'
      using errcode = '22023';
  end if;

  if p_origin = 'home_pickup' and (
    nullif(btrim(coalesce(p_collection_address, '')), '') is null
    or p_collection_date is null
    or p_collection_time_slot is null
  ) then
    raise exception 'Adresse, date et créneau de ramassage sont requis'
      using errcode = '22023';
  end if;

  if p_origin = 'counter' and (
    nullif(btrim(coalesce(p_collection_address, '')), '') is not null
    or nullif(btrim(coalesce(p_collection_address_details, '')), '') is not null
    or p_collection_date is not null
    or p_collection_time_slot is not null
  ) then
    raise exception 'Les informations de ramassage sont incompatibles avec un dépôt au comptoir'
      using errcode = '22023';
  end if;

  if p_fulfillment_method = 'home_delivery' and (
    nullif(btrim(coalesce(p_delivery_address, '')), '') is null
    or p_delivery_date is null
    or p_delivery_time_slot is null
  ) then
    raise exception 'Adresse, date et créneau de livraison sont requis'
      using errcode = '22023';
  end if;

  if p_fulfillment_method = 'counter_pickup' and (
    nullif(btrim(coalesce(p_delivery_address, '')), '') is not null
    or nullif(btrim(coalesce(p_delivery_address_details, '')), '') is not null
    or p_delivery_date is not null
    or p_delivery_time_slot is not null
  ) then
    raise exception 'Les informations de livraison sont incompatibles avec un retrait au comptoir'
      using errcode = '22023';
  end if;

  if p_lines is null
     or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) not between 1 and 200 then
    raise exception 'La commande doit contenir entre 1 et 200 lignes'
      using errcode = '22023';
  end if;

  if p_collection_fee_xof is not null and p_collection_fee_xof < 0 then
    raise exception 'Les frais de ramassage ne peuvent pas être négatifs'
      using errcode = '22023';
  end if;

  if p_delivery_fee_xof is not null and p_delivery_fee_xof < 0 then
    raise exception 'Les frais de livraison ne peuvent pas être négatifs'
      using errcode = '22023';
  end if;

  if p_discount_percent is not null
     and (
       p_discount_percent::text = 'NaN'
       or p_discount_percent < 0
       or p_discount_percent > 100
     ) then
    raise exception 'La remise doit être comprise entre 0 et 100 pour cent'
      using errcode = '22023';
  end if;

  select *
    into v_shop
  from public.shops
  where id = p_shop_id;

  if not found
     or not private.has_shop_access(
       p_shop_id,
       array['organization_owner', 'shop_manager', 'cashier']
     ) then
    raise exception 'Agence introuvable ou inaccessible'
      using errcode = '42501';
  end if;

  select *
    into v_organization
  from public.organizations
  where id = v_shop.organization_id;

  if v_shop.status <> 'active' or v_organization.status <> 'active' then
    raise exception 'Cette agence ne peut pas recevoir de nouvelle commande'
      using errcode = '23514';
  end if;

  -- Sérialise uniquement les tentatives portant la même clé dans cette
  -- agence. La contrainte unique reste la garantie finale en base.
  perform pg_advisory_xact_lock(
    hashtext('pressingpro:create_order:' || p_shop_id::text || ':' || v_idempotency_key)
  );

  select *
    into v_customer
  from public.customers
  where id = p_customer_id
    and organization_id = v_shop.organization_id;

  if not found then
    raise exception 'Cliente introuvable dans cette organisation'
      using errcode = '23503';
  end if;

  select *
    into v_settings
  from public.shop_settings
  where shop_id = p_shop_id;

  for v_line in
    select value from jsonb_array_elements(p_lines) as item(value)
  loop
    if jsonb_typeof(v_line) <> 'object' then
      raise exception 'Chaque ligne de commande doit être un objet'
        using errcode = '22023';
    end if;

    v_catalog_ref := nullif(btrim(coalesce(
      v_line ->> 'catalog_item_id',
      v_line ->> 'catalogItemId',
      ''
    )), '');
    v_legacy_key := nullif(btrim(coalesce(
      v_line ->> 'legacy_key',
      v_line ->> 'legacyKey',
      v_line ->> 'clothingItemId',
      v_line ->> 'itemId',
      ''
    )), '');

    if jsonb_typeof(v_line -> 'quantity') is distinct from 'number' then
      raise exception 'Chaque ligne doit contenir une quantité numérique'
        using errcode = '22023';
    end if;

    v_quantity := (v_line ->> 'quantity')::numeric;
    if v_quantity::text = 'NaN' or v_quantity <= 0 or v_quantity > 10000 then
      raise exception 'Quantité de commande invalide'
        using errcode = '22023';
    end if;

    if v_catalog_ref is not null then
      if v_catalog_ref !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
        raise exception 'Référence catalogue invalide'
          using errcode = '22023';
      end if;

      select *
        into v_catalog
      from public.service_catalog_items
      where shop_id = p_shop_id
        and is_active
        and id = v_catalog_ref::uuid;

      if found
         and v_legacy_key is not null
         and v_catalog.legacy_key is distinct from v_legacy_key then
        raise exception 'Les références catalogue d’une ligne sont incohérentes'
          using errcode = '22023';
      end if;
    elsif v_legacy_key is not null then
      select *
        into v_catalog
      from public.service_catalog_items
      where shop_id = p_shop_id
        and is_active
        and legacy_key = v_legacy_key;
    else
      raise exception 'Chaque ligne doit référencer une prestation du catalogue'
        using errcode = '22023';
    end if;

    if not found then
      raise exception 'Prestation absente ou inactive dans le catalogue de cette agence'
        using errcode = '23503';
    end if;

    if v_catalog.service_category not in (p_service_category, 'both') then
      raise exception 'Une prestation ne correspond pas à la catégorie de la commande'
        using errcode = '22023';
    end if;

    if v_catalog.pricing_type = 'unit' and v_quantity <> trunc(v_quantity) then
      raise exception 'Une prestation à la pièce exige une quantité entière'
        using errcode = '22023';
    end if;

    v_color := nullif(btrim(coalesce(v_line ->> 'color', '')), '');
    v_service_type := nullif(btrim(coalesce(
      v_line ->> 'service_type',
      v_line ->> 'serviceType',
      ''
    )), '');
    if length(coalesce(v_color, '')) > 80 or length(coalesce(v_service_type, '')) > 80 then
      raise exception 'Une précision de ligne dépasse 80 caractères'
        using errcode = '22023';
    end if;

    v_line_subtotal := round(v_catalog.unit_price_xof * v_quantity)::bigint;
    v_subtotal_xof := v_subtotal_xof + v_line_subtotal;
    v_canonical_lines := v_canonical_lines || jsonb_build_array(
      jsonb_build_object(
        'catalogItemId', v_catalog.id,
        'legacyKey', v_catalog.legacy_key,
        'name', v_catalog.name,
        'quantity', v_quantity,
        'unitPrice', v_catalog.unit_price_xof,
        'subtotal', v_line_subtotal,
        'pricingType', v_catalog.pricing_type,
        'color', v_color,
        'serviceType', v_service_type
      )
    );
  end loop;

  v_express_fee_xof := case
    when p_pickup_option = 'express' then round(v_subtotal_xof * 0.5)::bigint
    else 0
  end;
  v_discount_percent := coalesce(p_discount_percent, v_customer.loyalty_discount_percent, 0);
  if v_discount_percent::text = 'NaN'
     or v_discount_percent < 0
     or v_discount_percent > 100 then
    raise exception 'La remise fidélité enregistrée est invalide'
      using errcode = '22023';
  end if;
  v_discount_xof := least(
    v_subtotal_xof,
    round(v_subtotal_xof * v_discount_percent / 100)::bigint
  );

  v_collection_fee_xof := coalesce(
    p_collection_fee_xof,
    case when p_origin = 'home_pickup' then coalesce(v_settings.pickup_fee_xof, 0) else 0 end
  );
  v_delivery_fee_xof := coalesce(
    p_delivery_fee_xof,
    case
      when p_fulfillment_method = 'home_delivery'
        then coalesce(v_settings.delivery_fee_xof, 0)
      else 0
    end
  );
  v_total_xof := greatest(
    0,
    v_subtotal_xof
      + v_express_fee_xof
      + v_collection_fee_xof
      + v_delivery_fee_xof
      - v_discount_xof
  );

  select *
    into v_existing
  from public.orders
  where shop_id = p_shop_id
    and idempotency_key = v_idempotency_key;

  if found then
    if v_existing.customer_id <> p_customer_id
       or v_existing.lines <> v_canonical_lines
       or v_existing.subtotal_xof <> v_subtotal_xof
       or v_existing.service_fees_xof <> v_express_fee_xof
       or v_existing.collection_fee_xof <> v_collection_fee_xof
       or v_existing.delivery_fee_xof <> v_delivery_fee_xof
       or v_existing.discount_xof <> v_discount_xof
       or v_existing.total_xof <> v_total_xof
       or v_existing.promised_at <> p_promised_at
       or v_existing.service_category <> p_service_category
       or v_existing.origin <> p_origin
       or v_existing.fulfillment_method <> p_fulfillment_method
       or v_existing.is_urgent <> (p_pickup_option = 'express')
       or v_existing.notes is distinct from nullif(btrim(coalesce(p_notes, '')), '')
       or v_existing.collection_address_snapshot is distinct from nullif(btrim(coalesce(p_collection_address, '')), '')
       or v_existing.collection_address_details_snapshot is distinct from nullif(btrim(coalesce(p_collection_address_details, '')), '')
       or v_existing.collection_date is distinct from p_collection_date
       or v_existing.collection_time_slot is distinct from p_collection_time_slot
       or v_existing.delivery_address_snapshot is distinct from nullif(btrim(coalesce(p_delivery_address, '')), '')
       or v_existing.delivery_address_details_snapshot is distinct from nullif(btrim(coalesce(p_delivery_address_details, '')), '')
       or v_existing.delivery_date is distinct from p_delivery_date
       or v_existing.delivery_time_slot is distinct from p_delivery_time_slot then
      raise exception 'Cette clé d’idempotence correspond déjà à une autre commande'
        using errcode = '23505';
    end if;
    return v_existing;
  end if;

  insert into public.orders (
    organization_id,
    shop_id,
    customer_id,
    idempotency_key,
    service_category,
    customer_name_snapshot,
    customer_phone_snapshot,
    customer_address_snapshot,
    lines,
    subtotal_xof,
    service_fees_xof,
    collection_fee_xof,
    delivery_fee_xof,
    discount_xof,
    total_xof,
    deposit_paid_xof,
    payment_method,
    promised_at,
    notes,
    is_urgent,
    origin,
    fulfillment_method,
    collection_address_snapshot,
    collection_address_details_snapshot,
    collection_date,
    collection_time_slot,
    delivery_address_snapshot,
    delivery_address_details_snapshot,
    delivery_date,
    delivery_time_slot,
    created_by
  ) values (
    v_shop.organization_id,
    p_shop_id,
    p_customer_id,
    v_idempotency_key,
    p_service_category,
    v_customer.full_name,
    v_customer.phone_display,
    v_customer.address,
    v_canonical_lines,
    v_subtotal_xof,
    v_express_fee_xof,
    v_collection_fee_xof,
    v_delivery_fee_xof,
    v_discount_xof,
    v_total_xof,
    0,
    null,
    p_promised_at,
    nullif(btrim(coalesce(p_notes, '')), ''),
    p_pickup_option = 'express',
    p_origin,
    p_fulfillment_method,
    nullif(btrim(coalesce(p_collection_address, '')), ''),
    nullif(btrim(coalesce(p_collection_address_details, '')), ''),
    p_collection_date,
    p_collection_time_slot,
    nullif(btrim(coalesce(p_delivery_address, '')), ''),
    nullif(btrim(coalesce(p_delivery_address_details, '')), ''),
    p_delivery_date,
    p_delivery_time_slot,
    v_actor
  )
  returning * into v_created;

  perform private.recalculate_customer_order_aggregates(p_customer_id);

  insert into public.audit_log (
    organization_id, shop_id, actor_user_id, actor_type,
    action, resource_type, resource_id, metadata
  ) values (
    v_created.organization_id,
    v_created.shop_id,
    v_actor,
    'staff',
    'order.created',
    'order',
    v_created.id,
    jsonb_build_object(
      'ticket_label', v_created.ticket_label,
      'total_xof', v_created.total_xof,
      'discount_percent', v_discount_percent,
      'idempotency_key', v_idempotency_key
    )
  );

  return v_created;
end;
$$;

revoke all on function public.create_order(
  uuid, uuid, jsonb, timestamptz, text, text, text, numeric, bigint, bigint,
  text, text, text, text, text, date, text, text, text, date, text
) from public, anon;
grant execute on function public.create_order(
  uuid, uuid, jsonb, timestamptz, text, text, text, numeric, bigint, bigint,
  text, text, text, text, text, date, text, text, text, date, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Enregistrement manuel d'un paiement confirmé au comptoir
-- ---------------------------------------------------------------------------

create or replace function public.record_order_payment(
  p_order_id uuid,
  p_amount_xof bigint,
  p_method text,
  p_provider text,
  p_idempotency_key text,
  p_external_reference text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.payments
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_idempotency_key text := btrim(coalesce(p_idempotency_key, ''));
  v_external_reference text := nullif(btrim(coalesce(p_external_reference, '')), '');
  v_order public.orders%rowtype;
  v_existing public.payments%rowtype;
  v_payment public.payments%rowtype;
  v_net_paid_xof bigint := 0;
begin
  if v_actor is null then
    raise exception 'Session authentifiée requise pour enregistrer un paiement'
      using errcode = '42501';
  end if;

  if coalesce(p_amount_xof, 0) <= 0 then
    raise exception 'Le montant du paiement doit être strictement positif'
      using errcode = '22023';
  end if;

  if length(v_idempotency_key) not between 8 and 120 then
    raise exception 'La clé d’idempotence doit contenir entre 8 et 120 caractères'
      using errcode = '22023';
  end if;

  if not (
    (p_method = 'cash' and p_provider = 'cash')
    or (p_method = 'mobile_money' and p_provider in ('wave', 'orange_money', 'mtn_momo'))
    or (p_method = 'transfer' and p_provider in ('bank_transfer', 'other'))
    or (p_method = 'card' and p_provider = 'bank_card')
    or (p_method = 'other' and p_provider = 'other')
  ) then
    raise exception 'Moyen ou fournisseur de paiement invalide'
      using errcode = '22023';
  end if;

  if p_method <> 'cash' and v_external_reference is null then
    raise exception 'Une référence fournisseur est requise pour un paiement non espèces confirmé manuellement'
      using errcode = '22023';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Les métadonnées de paiement doivent être un objet JSON'
      using errcode = '22023';
  end if;

  -- Le navigateur ne peut pas verser un JSON arbitraire (potentiellement
  -- volumineux ou sensible) dans le journal financier. Les webhooks
  -- fournisseurs auront leurs propres écritures serveur contrôlées.
  if pg_column_size(p_metadata) > 2048
     or exists (
       select 1
       from jsonb_object_keys(p_metadata) as metadata_key
       where metadata_key not in (
         'note', 'receipt_reference', 'terminal_reference',
         'cash_register_reference'
       )
     )
     or exists (
       select 1
       from jsonb_each(p_metadata) as metadata_entry(key, value)
       where jsonb_typeof(metadata_entry.value) not in (
         'string', 'number', 'boolean', 'null'
       )
         or length(metadata_entry.value::text) > 240
     ) then
    raise exception 'Métadonnées de paiement non autorisées'
      using errcode = '22023';
  end if;

  select *
    into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found
     or not private.has_shop_access(
       v_order.shop_id,
       array['organization_owner', 'shop_manager', 'cashier']
     ) then
    raise exception 'Commande introuvable ou inaccessible'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('pressingpro:payment:' || v_order.shop_id::text || ':' || v_idempotency_key)
  );

  select *
    into v_existing
  from public.payments
  where shop_id = v_order.shop_id
    and idempotency_key = v_idempotency_key;

  if found then
    if v_existing.order_id <> p_order_id
       or v_existing.kind <> 'payment'
       or v_existing.amount_xof <> p_amount_xof
       or v_existing.method <> p_method
       or v_existing.provider <> p_provider
       or coalesce(v_existing.external_reference, '') <> coalesce(v_external_reference, '') then
      raise exception 'Cette clé d’idempotence correspond déjà à un autre paiement'
        using errcode = '23505';
    end if;
    return v_existing;
  end if;

  select coalesce(
    sum(case when kind = 'payment' then amount_xof else -amount_xof end),
    0
  )::bigint
    into v_net_paid_xof
  from public.payments
  where order_id = p_order_id
    and status = 'confirmed';

  if greatest(coalesce(v_net_paid_xof, 0), 0) + p_amount_xof > v_order.total_xof then
    raise exception 'Le paiement dépasserait le total de la commande'
      using errcode = '23514';
  end if;

  insert into public.payments (
    organization_id, shop_id, order_id, kind, status,
    amount_xof, method, provider, external_reference,
    idempotency_key, recorded_by, confirmed_at, metadata
  ) values (
    v_order.organization_id,
    v_order.shop_id,
    p_order_id,
    'payment',
    'confirmed',
    p_amount_xof,
    p_method,
    p_provider,
    v_external_reference,
    v_idempotency_key,
    v_actor,
    now(),
    p_metadata || jsonb_build_object('confirmation_source', 'manual_counter')
  )
  returning * into v_payment;

  perform private.recalculate_order_payment_total(p_order_id);

  insert into public.order_events (
    organization_id, shop_id, order_id, event_type,
    from_status, to_status, visibility, actor_type, actor_user_id, payload
  ) values (
    v_order.organization_id,
    v_order.shop_id,
    p_order_id,
    'payment.recorded',
    v_order.status,
    v_order.status,
    'customer',
    'staff',
    v_actor,
    jsonb_build_object(
      'payment_id', v_payment.id,
      'amount_xof', v_payment.amount_xof,
      'method', v_payment.method,
      'provider', v_payment.provider
    )
  );

  insert into public.audit_log (
    organization_id, shop_id, actor_user_id, actor_type,
    action, resource_type, resource_id, metadata
  ) values (
    v_order.organization_id,
    v_order.shop_id,
    v_actor,
    'staff',
    'payment.recorded',
    'payment',
    v_payment.id,
    jsonb_build_object(
      'order_id', p_order_id,
      'amount_xof', v_payment.amount_xof,
      'method', v_payment.method,
      'provider', v_payment.provider,
      'external_reference', v_payment.external_reference,
      'idempotency_key', v_idempotency_key
    )
  );

  return v_payment;
end;
$$;

revoke all on function public.record_order_payment(uuid, bigint, text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.record_order_payment(uuid, bigint, text, text, text, text, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Remboursement par contre-écriture
-- ---------------------------------------------------------------------------

create or replace function public.refund_order_payment(
  p_payment_id uuid,
  p_amount_xof bigint,
  p_idempotency_key text,
  p_reason text default null,
  p_external_reference text default null
)
returns public.payments
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_idempotency_key text := btrim(coalesce(p_idempotency_key, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_external_reference text := nullif(btrim(coalesce(p_external_reference, '')), '');
  v_original public.payments%rowtype;
  v_order public.orders%rowtype;
  v_existing public.payments%rowtype;
  v_refund public.payments%rowtype;
  v_already_refunded_xof bigint := 0;
begin
  if v_actor is null then
    raise exception 'Session authentifiée requise pour enregistrer un remboursement'
      using errcode = '42501';
  end if;

  if coalesce(p_amount_xof, 0) <= 0 then
    raise exception 'Le montant du remboursement doit être strictement positif'
      using errcode = '22023';
  end if;

  if length(v_idempotency_key) not between 8 and 120 then
    raise exception 'La clé d’idempotence doit contenir entre 8 et 120 caractères'
      using errcode = '22023';
  end if;

  if length(coalesce(v_reason, '')) > 500 then
    raise exception 'Le motif du remboursement dépasse 500 caractères'
      using errcode = '22023';
  end if;

  select *
    into v_original
  from public.payments
  where id = p_payment_id
  for update;

  if not found
     or not private.has_shop_access(
       v_original.shop_id,
       array['organization_owner', 'shop_manager']
     ) then
    raise exception 'Paiement introuvable ou remboursement non autorisé'
      using errcode = '42501';
  end if;

  if v_original.kind <> 'payment' or v_original.status <> 'confirmed' then
    raise exception 'Seul un paiement confirmé peut être remboursé'
      using errcode = '23514';
  end if;

  if v_original.method <> 'cash' and v_external_reference is null then
    raise exception 'Une référence fournisseur est requise pour un remboursement non espèces'
      using errcode = '22023';
  end if;

  select *
    into v_order
  from public.orders
  where id = v_original.order_id
  for update;

  perform pg_advisory_xact_lock(
    hashtext('pressingpro:payment:' || v_original.shop_id::text || ':' || v_idempotency_key)
  );

  select *
    into v_existing
  from public.payments
  where shop_id = v_original.shop_id
    and idempotency_key = v_idempotency_key;

  if found then
    if v_existing.kind <> 'refund'
       or v_existing.reverses_payment_id <> p_payment_id
       or v_existing.amount_xof <> p_amount_xof
       or coalesce(v_existing.external_reference, '') <> coalesce(v_external_reference, '')
       or coalesce(v_existing.metadata ->> 'reason', '') <> coalesce(v_reason, '') then
      raise exception 'Cette clé d’idempotence correspond déjà à une autre opération'
        using errcode = '23505';
    end if;
    return v_existing;
  end if;

  select coalesce(sum(amount_xof), 0)::bigint
    into v_already_refunded_xof
  from public.payments
  where reverses_payment_id = p_payment_id
    and kind in ('refund', 'reversal')
    and status = 'confirmed';

  if coalesce(v_already_refunded_xof, 0) + p_amount_xof > v_original.amount_xof then
    raise exception 'Le remboursement dépasserait le montant du paiement initial'
      using errcode = '23514';
  end if;

  insert into public.payments (
    organization_id, shop_id, order_id, kind, status,
    amount_xof, method, provider, external_reference,
    idempotency_key, reverses_payment_id, recorded_by,
    confirmed_at, metadata
  ) values (
    v_original.organization_id,
    v_original.shop_id,
    v_original.order_id,
    'refund',
    'confirmed',
    p_amount_xof,
    v_original.method,
    v_original.provider,
    v_external_reference,
    v_idempotency_key,
    p_payment_id,
    v_actor,
    now(),
    jsonb_build_object(
      'confirmation_source', 'manual_counter',
      'reason', v_reason
    )
  )
  returning * into v_refund;

  perform private.recalculate_order_payment_total(v_original.order_id);

  insert into public.order_events (
    organization_id, shop_id, order_id, event_type,
    from_status, to_status, visibility, actor_type, actor_user_id, payload
  ) values (
    v_order.organization_id,
    v_order.shop_id,
    v_original.order_id,
    'payment.refunded',
    v_order.status,
    v_order.status,
    'customer',
    'staff',
    v_actor,
    jsonb_build_object(
      'payment_id', v_refund.id,
      'original_payment_id', p_payment_id,
      'amount_xof', v_refund.amount_xof,
      'method', v_refund.method,
      'provider', v_refund.provider
    )
  );

  insert into public.audit_log (
    organization_id, shop_id, actor_user_id, actor_type,
    action, resource_type, resource_id, metadata
  ) values (
    v_order.organization_id,
    v_order.shop_id,
    v_actor,
    'staff',
    'payment.refunded',
    'payment',
    v_refund.id,
    jsonb_build_object(
      'order_id', v_original.order_id,
      'original_payment_id', p_payment_id,
      'amount_xof', v_refund.amount_xof,
      'method', v_refund.method,
      'provider', v_refund.provider,
      'external_reference', v_refund.external_reference,
      'reason', v_reason,
      'idempotency_key', v_idempotency_key
    )
  );

  return v_refund;
end;
$$;

revoke all on function public.refund_order_payment(uuid, bigint, text, text, text)
  from public, anon;
grant execute on function public.refund_order_payment(uuid, bigint, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Totaux de caisse recalculés depuis le journal
-- ---------------------------------------------------------------------------

create or replace function public.get_payment_totals(
  p_shop_id uuid,
  p_business_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = private, pg_catalog
as $$
declare
  v_shop public.shops%rowtype;
  v_rows jsonb := '[]'::jsonb;
  v_gross_xof bigint := 0;
  v_refunds_xof bigint := 0;
begin
  if auth.uid() is null then
    raise exception 'Session authentifiée requise pour consulter les totaux de caisse'
      using errcode = '42501';
  end if;

  select *
    into v_shop
  from public.shops
  where id = p_shop_id;

  if not found
     or not private.has_shop_access(
       p_shop_id,
       array['organization_owner', 'shop_manager', 'cashier']
     ) then
    raise exception 'Agence introuvable ou inaccessible'
      using errcode = '42501';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'method', grouped.method,
          'provider', grouped.provider,
          'gross_xof', grouped.gross_xof,
          'refunds_xof', grouped.refunds_xof,
          'net_xof', grouped.gross_xof - grouped.refunds_xof
        )
        order by grouped.method, grouped.provider
      ),
      '[]'::jsonb
    ),
    coalesce(sum(grouped.gross_xof), 0)::bigint,
    coalesce(sum(grouped.refunds_xof), 0)::bigint
  into v_rows, v_gross_xof, v_refunds_xof
  from (
    select
      method,
      provider,
      coalesce(sum(amount_xof) filter (where kind = 'payment'), 0)::bigint as gross_xof,
      coalesce(
        sum(amount_xof) filter (where kind in ('refund', 'reversal')),
        0
      )::bigint as refunds_xof
    from public.payments
    where shop_id = p_shop_id
      and status = 'confirmed'
      and (confirmed_at at time zone v_shop.time_zone)::date = p_business_date
    group by method, provider
  ) grouped;

  return jsonb_build_object(
    'shop_id', p_shop_id,
    'business_date', p_business_date,
    'currency', 'XOF',
    'rows', v_rows,
    'gross_xof', coalesce(v_gross_xof, 0),
    'refunds_xof', coalesce(v_refunds_xof, 0),
    'net_xof', coalesce(v_gross_xof, 0) - coalesce(v_refunds_xof, 0)
  );
end;
$$;

revoke all on function public.get_payment_totals(uuid, date)
  from public, anon;
grant execute on function public.get_payment_totals(uuid, date)
  to authenticated;

-- Publication Realtime du journal, uniquement lorsque la publication
-- Supabase existe (absente du harnais PGlite local).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'payments'
     ) then
    execute 'alter publication supabase_realtime add table public.payments';
  end if;
end;
$$;
