-- PressingPro CI — alignement de la majoration express côté serveur
--
-- Contexte : le comptoir (EXPRESS_SURCHARGE_RATE = 1) et
-- docs/PRESTATIONS-PRESSING.md facturent l'Express 24h au double
-- (majoration de 100 %), mais la RPC create_order appliquait encore +50 %.
-- Le POS n'écrivant pas encore dans Supabase, aucun ticket réel n'est
-- concerné ; cette migration réaligne le serveur avant le branchement,
-- pour que le jour venu les deux calculs coïncident :
--   total express = 2 × sous-total + frais − remise (sur les prestations).
--
-- Additive et sans danger : reprise à l'identique du corps de create_order,
-- seule la formule de v_express_fee_xof change. Les droits existants
-- (revoke public/anon, grant authenticated) survivent au CREATE OR REPLACE.

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

  -- Express 24h = exactement le double : la majoration égale le sous-total
  -- des prestations (aligné sur le front, anciennement +50 %).
  v_express_fee_xof := case
    when p_pickup_option = 'express' then v_subtotal_xof
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
