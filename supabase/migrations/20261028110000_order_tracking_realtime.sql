-- PressingPro CI — suivi de commandes synchronisé (premier lot)
--
-- Objectifs :
-- 1. rendre les transitions de production atomiques et contrôlées par RPC ;
-- 2. conserver l'historique order_events dans la même transaction ;
-- 3. publier les commandes, leurs événements et les tournées dans
--    Supabase Realtime sans exposer de nouvel accès anonyme.
--
-- La remise finale (« delivered ») reste volontairement hors de cette RPC :
-- elle devra passer par les fonctions d'encaissement comptoir/livraison.

create index if not exists orders_shop_updated_idx
  on public.orders (shop_id, updated_at desc);

create index if not exists order_events_shop_created_idx
  on public.order_events (shop_id, created_at desc);

create index if not exists logistics_tasks_shop_updated_idx
  on public.logistics_tasks (shop_id, updated_at desc);

-- Les abonnements filtrent par shop_id : conserver l'ancienne ligne complète
-- permet à Realtime d'évaluer correctement les mises à jour et suppressions
-- sous RLS. Les événements sont en insertion seule et n'en ont pas besoin.
alter table public.orders replica identity full;
alter table public.logistics_tasks replica identity full;

-- Le déclencheur existant journalisait déjà les changements dans la même
-- transaction. Il accepte désormais la note, la source et la visibilité
-- positionnées localement par la RPC de transition, sans colonne duplicative.
create or replace function private.log_order_status_event()
returns trigger
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_note text := nullif(
    btrim(coalesce(current_setting('pressingpro.order_transition_note', true), '')),
    ''
  );
  v_source text := nullif(
    btrim(coalesce(current_setting('pressingpro.order_transition_source', true), '')),
    ''
  );
  v_visibility text := coalesce(
    nullif(btrim(coalesce(current_setting('pressingpro.order_transition_visibility', true), '')), ''),
    'customer'
  );
  v_payload jsonb := jsonb_build_object('ticket_label', new.ticket_label);
begin
  if v_visibility not in ('customer', 'internal') then
    v_visibility := 'customer';
  end if;

  if v_note is not null then
    v_payload := v_payload || jsonb_build_object('note', left(v_note, 500));
  end if;

  if v_source is not null then
    v_payload := v_payload || jsonb_build_object('source', left(v_source, 80));
  end if;

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
      case when tg_op = 'INSERT' then 'customer' else v_visibility end,
      case when auth.uid() is null then 'system' else 'staff' end,
      auth.uid(),
      v_payload
    );
  end if;

  return new;
end;
$$;

revoke all on function private.log_order_status_event() from public, anon;
grant execute on function private.log_order_status_event()
  to authenticated, service_role;

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_target_status text,
  p_expected_status text default null,
  p_note text default null,
  p_visibility text default 'customer'
)
returns public.orders
language plpgsql
security definer
set search_path = private, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_updated public.orders%rowtype;
  v_current_rank integer;
  v_target_rank integer;
  v_storage_required boolean := false;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_actor is null then
    raise exception 'Session authentifiée requise pour changer un statut'
      using errcode = '42501';
  end if;

  if p_target_status is null or p_target_status not in (
    'received', 'washing', 'ironing', 'ready', 'delivered'
  ) then
    raise exception 'Statut de commande invalide'
      using errcode = '22023';
  end if;

  if p_expected_status is not null and p_expected_status not in (
    'received', 'washing', 'ironing', 'ready', 'delivered'
  ) then
    raise exception 'Statut actuel attendu invalide'
      using errcode = '22023';
  end if;

  if coalesce(p_visibility, 'customer') not in ('customer', 'internal') then
    raise exception 'Visibilité d’événement invalide'
      using errcode = '22023';
  end if;

  if v_note is not null and length(v_note) > 500 then
    raise exception 'La note de suivi ne peut pas dépasser 500 caractères'
      using errcode = '22023';
  end if;

  if p_target_status = 'delivered' then
    raise exception 'La remise finale doit passer par l’encaissement comptoir ou la confirmation de livraison'
      using errcode = '23514';
  end if;

  select *
    into v_order
  from public.orders
  where id = p_order_id
  for update;

  -- Même message si la commande n'existe pas ou appartient à un autre
  -- périmètre : la RPC ne doit pas révéler l'existence d'une commande.
  if not found or not private.has_shop_access(
    v_order.shop_id,
    array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  ) then
    raise exception 'Commande introuvable ou inaccessible'
      using errcode = '42501';
  end if;

  if p_expected_status is not null and v_order.status <> p_expected_status then
    raise exception 'Le statut a déjà changé sur un autre poste ; rechargez la commande avant de réessayer'
      using errcode = '40001';
  end if;

  -- Appel idempotent : aucun événement trompeur n'est ajouté si un double
  -- clic ou une resynchronisation redemande le statut déjà courant.
  if v_order.status = p_target_status then
    return v_order;
  end if;

  if v_order.status = 'delivered' then
    raise exception 'Une commande déjà remise ne peut plus retourner en production'
      using errcode = '23514';
  end if;

  v_current_rank := case v_order.status
    when 'received' then 1
    when 'washing' then 2
    when 'ironing' then 3
    when 'ready' then 4
    when 'delivered' then 5
  end;
  v_target_rank := case p_target_status
    when 'received' then 1
    when 'washing' then 2
    when 'ironing' then 3
    when 'ready' then 4
    when 'delivered' then 5
  end;

  if abs(v_target_rank - v_current_rank) <> 1 then
    raise exception 'Les étapes de production doivent être franchies dans l’ordre, sans saut'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.logistics_tasks lt
    where lt.order_id = v_order.id
      and lt.kind = 'delivery'
      and lt.status = 'en_route'
  ) then
    raise exception 'Cette commande est déjà en livraison ; terminez ou signalez la tournée avant tout retour en production'
      using errcode = '23514';
  end if;

  if p_target_status = 'ready' then
    select coalesce(storage_assignment_required, false)
      into v_storage_required
    from public.shop_settings
    where shop_id = v_order.shop_id;

    if coalesce(v_storage_required, false) then
      raise exception 'Un emplacement de rangement est requis avant de marquer cette commande prête'
        using errcode = '23514';
    end if;
  end if;

  perform set_config('pressingpro.order_transition_note', coalesce(v_note, ''), true);
  perform set_config('pressingpro.order_transition_source', 'production_rpc', true);
  perform set_config(
    'pressingpro.order_transition_visibility',
    coalesce(p_visibility, 'customer'),
    true
  );

  update public.orders
  set
    status = p_target_status,
    ready_at = case
      when p_target_status = 'ready' then now()
      when v_order.status = 'ready' then null
      else ready_at
    end,
    legacy_sms_sent = case
      when p_target_status = 'ready' then false
      else legacy_sms_sent
    end,
    rack_location_snapshot = case
      when v_order.status = 'ready' or p_target_status = 'ready' then null
      else rack_location_snapshot
    end,
    storage_location_id = case
      when v_order.status = 'ready' or p_target_status = 'ready' then null
      else storage_location_id
    end,
    storage_location_code_snapshot = case
      when v_order.status = 'ready' or p_target_status = 'ready' then null
      else storage_location_code_snapshot
    end,
    storage_location_label_snapshot = case
      when v_order.status = 'ready' or p_target_status = 'ready' then null
      else storage_location_label_snapshot
    end,
    storage_package_count = case
      when v_order.status = 'ready' or p_target_status = 'ready' then null
      else storage_package_count
    end,
    storage_notes = case
      when v_order.status = 'ready' or p_target_status = 'ready' then null
      else storage_notes
    end,
    stored_at = case
      when v_order.status = 'ready' or p_target_status = 'ready' then null
      else stored_at
    end
  where id = v_order.id
  returning * into v_updated;

  return v_updated;
end;
$$;

revoke all on function public.transition_order_status(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.transition_order_status(uuid, text, text, text, text)
  to authenticated;

-- Le statut et ses horodatages ne sont plus modifiables par un UPDATE
-- PostgREST générique. Les futures fonctions de rangement et de remise
-- devront elles aussi être des RPC métier explicites.
revoke update (status, ready_at, delivered_at)
  on public.orders from authenticated;

-- Publication Realtime hébergée par Supabase. En PGlite local, la
-- publication n'existe pas : ce bloc reste alors sans effet et les tests
-- SQL/RLS continuent de porter sur les tables et la RPC.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'orders'
    ) then
      execute 'alter publication supabase_realtime add table public.orders';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'order_events'
    ) then
      execute 'alter publication supabase_realtime add table public.order_events';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'logistics_tasks'
    ) then
      execute 'alter publication supabase_realtime add table public.logistics_tasks';
    end if;
  end if;
end;
$$;
