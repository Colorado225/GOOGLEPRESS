-- PressingPro CI — durcissement des opérations plateforme.
-- Migration additive : aucune table ni donnée existante n'est supprimée.

-- Une offre inactive ne doit plus être proposée, mais les abonnés existants
-- conservent leurs quotas. « active » ne signifie donc jamais « illimité ».
create or replace function private.plan_limits(p_plan text)
returns table (max_users integer, max_orders_month integer, max_storage integer)
language sql
stable
security definer
set search_path = private, pg_catalog
as $$
  select po.max_users, po.max_orders_month, po.max_storage
  from public.platform_plan_offers po
  where po.plan = p_plan;
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
  where plan = v_plan;
  if v_limit is null then return new; end if;
  select count(*) into v_count from public.shops where organization_id = new.organization_id;
  if v_count >= v_limit then
    raise exception 'Formule % : % agence(s) au maximum.', v_plan, v_limit
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Les demandes directes comme celles de la RPC ne peuvent pas viser une offre
-- retirée du catalogue. Les changements déjà appliqués ne sont pas touchés.
create or replace function private.validate_requested_plan_offer()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  if new.requested_plan is not null and not exists (
    select 1 from public.platform_plan_offers po
    where po.plan = new.requested_plan and po.active
  ) then
    raise exception 'Cette formule n’est plus proposée' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_requested_plan_offer on public.shop_subscriptions;
create trigger validate_requested_plan_offer
before insert or update of requested_plan on public.shop_subscriptions
for each row execute function private.validate_requested_plan_offer();

-- Les avoirs sont limités au solde réel, après paiements et remboursements.
-- Le verrou de facture sérialise également cette validation avec un paiement.
create or replace function private.validate_platform_credit_note()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_invoice public.platform_invoices%rowtype;
  v_paid bigint;
  v_credits bigint;
begin
  select * into v_invoice from public.platform_invoices
  where id = new.invoice_id for update;
  if not found or v_invoice.status = 'void' then
    raise exception 'Facture introuvable ou annulée' using errcode = 'P0002';
  end if;
  if v_invoice.organization_id <> new.organization_id then
    raise exception 'Organisation de l’avoir incohérente' using errcode = '22023';
  end if;
  select coalesce(sum(case
    when p.status = 'recorded' then p.amount_xof
    when p.status = 'refunded' then -p.amount_xof
    else 0 end), 0)
  into v_paid from public.platform_payments p where p.invoice_id = new.invoice_id;
  select coalesce(sum(c.amount_xof), 0)
  into v_credits from public.platform_credit_notes c where c.invoice_id = new.invoice_id;
  if v_paid + v_credits + new.amount_xof > v_invoice.total_xof then
    raise exception 'L’avoir dépasse le solde restant de la facture' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_platform_credit_note on public.platform_credit_notes;
create trigger validate_platform_credit_note
before insert on public.platform_credit_notes
for each row execute function private.validate_platform_credit_note();

-- Une confirmation ou un remboursement Mobile Money doit rester traçable.
create or replace function private.validate_platform_payment_reference()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  if new.status in ('recorded', 'refunded')
     and new.method in ('wave', 'orange_money', 'mtn_momo', 'moov_money')
     and length(btrim(new.reference)) < 2 then
    raise exception 'La référence opérateur est obligatoire pour cette transaction Mobile Money'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_platform_payment_reference on public.platform_payments;
create trigger validate_platform_payment_reference
before insert on public.platform_payments
for each row execute function private.validate_platform_payment_reference();

-- Verrouille le code promo pendant le comptage pour empêcher deux factures
-- concurrentes de dépasser max_uses.
create or replace function private.validate_platform_invoice_promo()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_promo public.platform_promo_codes%rowtype;
begin
  if new.promo_code is null then return new; end if;
  select * into v_promo from public.platform_promo_codes
  where code = new.promo_code for update;
  if not found or not v_promo.active
     or (v_promo.starts_on is not null and v_promo.starts_on > current_date)
     or (v_promo.ends_on is not null and v_promo.ends_on < current_date) then
    raise exception 'Code promotionnel invalide ou expiré' using errcode = '22023';
  end if;
  if v_promo.max_uses is not null and (
    select count(*) from public.platform_invoices i where i.promo_code = new.promo_code
  ) >= v_promo.max_uses then
    raise exception 'Ce code promotionnel a atteint sa limite d’utilisation' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_platform_invoice_promo on public.platform_invoices;
create trigger validate_platform_invoice_promo
before insert or update of promo_code on public.platform_invoices
for each row execute function private.validate_platform_invoice_promo();

-- Chaque canal reçoit le bon identifiant : jamais un e-mail dans la file
-- WhatsApp ni un téléphone dans la file e-mail.
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
           nullif(u.email, '') as email,
           nullif(u.phone, '') as phone
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
    select v_campaign.id, r.organization_id,
           case c.channel when 'email' then r.email else r.phone end,
           c.channel, v_campaign.title, v_campaign.body, coalesce(v_campaign.starts_at, now())
    from recipients r
    cross join lateral unnest(v_campaign.channels) as c(channel)
    where (c.channel = 'email' and r.email is not null)
       or (c.channel = 'whatsapp' and r.phone is not null)
    on conflict (campaign_id, organization_id, channel) do nothing
    returning id
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;

-- Une campagne expirée/archivée ne peut pas laisser ses anciens messages
-- externes être envoyés tardivement par un futur worker.
create or replace function private.cancel_archived_campaign_messages()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
begin
  if new.status = 'archived' and old.status is distinct from new.status then
    update public.platform_outbound_messages
       set status = 'cancelled'
     where campaign_id = new.id and status = 'queued';
  end if;
  return new;
end;
$$;

drop trigger if exists cancel_archived_campaign_messages on public.platform_campaigns;
create trigger cancel_archived_campaign_messages
after update of status on public.platform_campaigns
for each row execute function private.cancel_archived_campaign_messages();

-- Expose les modules de la formule effective (essai Pro inclus). Le frontend
-- utilise cette liste dès qu'elle est disponible, avec repli historique sinon.
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
  v_modules text[];
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
  select po.modules into v_modules from public.platform_plan_offers po where po.plan = v_effective;
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
    'modules', coalesce(v_modules, '{}'::text[]),
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

revoke all on function private.validate_requested_plan_offer() from public, anon, authenticated;
revoke all on function private.validate_platform_credit_note() from public, anon, authenticated;
revoke all on function private.validate_platform_payment_reference() from public, anon, authenticated;
revoke all on function private.validate_platform_invoice_promo() from public, anon, authenticated;
revoke all on function private.cancel_archived_campaign_messages() from public, anon, authenticated;
