-- PressingPro CI — Phase 0, RLS et privilèges API (Option B)
-- Ne pas appliquer à Pressing_Pro sans environnement de validation distinct.

-- Toutes les tables publiques sont protégées, y compris celles intentionnellement
-- sans politique API (outbox, webhooks, compteur de tickets).
do $$
declare
  v_table text;
begin
  for v_table in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
  end loop;
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Le rôle service_role reste réservé aux serveurs/Edge Functions de confiance.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Privilèges de tables/colonnes pour le rôle authenticated
-- ---------------------------------------------------------------------------

grant select on public.platform_admins to authenticated;
grant select, insert on public.profiles to authenticated;
grant update (display_name, phone_e164, locale, time_zone) on public.profiles to authenticated;

grant select, insert on public.organizations to authenticated;
grant update (name, slug, country_code, default_currency)
  on public.organizations to authenticated;
grant select, insert on public.shops to authenticated;
grant update (name, slug, public_slug, address, city, country_code,
  phone_display, email, opening_hours, time_zone)
  on public.shops to authenticated;
grant select, insert on public.memberships to authenticated;
grant update (shop_id, employee_id, role, status) on public.memberships to authenticated;
grant select, insert on public.invitations to authenticated;
grant update (expires_at, accepted_at, revoked_at) on public.invitations to authenticated;

grant select, insert on public.employees to authenticated;
grant update (full_name, phone_display, position, status, hired_on, notes)
  on public.employees to authenticated;
grant select, insert on public.attendance_records to authenticated;
grant update (status, arrival_time, reason, notes, recorded_by)
  on public.attendance_records to authenticated;

grant select, insert on public.shop_settings to authenticated;
grant update (tagline, currency, enable_sms, enable_thermal_printer,
  pickup_fee_xof, delivery_fee_xof, storage_assignment_required,
  storage_allow_capacity_overflow, storage_suggestions_enabled,
  storage_default_capacity_packages, messaging_business_hours,
  messaging_out_of_hours_message, show_storage_code_to_customers)
  on public.shop_settings to authenticated;
grant select, insert on public.service_catalog_items to authenticated;
grant update (name, audience_category, service_category, pricing_type,
  unit_price_xof, unit_label, icon_emoji, image_url, description, is_active, sort_order)
  on public.service_catalog_items to authenticated;

grant select, insert on public.customers to authenticated;
-- phone_e164 est volontairement absent : un changement de numéro de
-- confiance devra passer par une vérification serveur en phase 1.
grant update (full_name, phone_display, address)
  on public.customers to authenticated;
grant select on public.customer_account_links to authenticated;

grant select, insert on public.storage_locations to authenticated;
grant update (code, label, zone, capacity_packages, description, is_active)
  on public.storage_locations to authenticated;
grant select, insert on public.orders to authenticated;
grant update (deposit_paid_xof, payment_method, status, promised_at, ready_at,
  delivered_at, notes, is_late, is_urgent, rack_location_snapshot,
  storage_location_id, storage_location_code_snapshot,
  storage_location_label_snapshot, storage_package_count, storage_notes,
  stored_at, machine_assigned, assignee_name_snapshot, progress_percent,
  legacy_sms_sent)
  on public.orders to authenticated;
grant select on public.order_events to authenticated;

grant select, insert on public.logistics_tasks to authenticated;
grant update (status, address, address_details, scheduled_date, time_slot,
  assigned_employee_id, assigned_employee_name_snapshot, estimated_bags,
  collected_bags, instructions, issue_reason, issue_notes, started_at,
  completed_at, collected_amount_xof, collected_payment_method)
  on public.logistics_tasks to authenticated;
grant select, insert on public.pickup_requests to authenticated;
grant update (customer_id, address, address_details, requested_date,
  requested_time_slot, estimated_bags, instructions, status, staff_notes,
  converted_task_id)
  on public.pickup_requests to authenticated;

grant select, insert on public.cash_register_days to authenticated;
grant update (cash_amount_xof, wave_amount_xof, mobile_money_amount_xof,
  float_amount_xof, monthly_target_xof, month_achieved_xof, status,
  closed_at, closed_by)
  on public.cash_register_days to authenticated;
grant select, insert on public.products to authenticated;
grant update (name, reference, category, unit, alert_threshold, unit_cost_xof,
  supplier, description, is_active)
  on public.products to authenticated;
grant select, insert on public.stock_movements to authenticated;
grant select, insert on public.expense_categories to authenticated;
grant update (label, is_active) on public.expense_categories to authenticated;
grant select, insert on public.expenses to authenticated;
grant update (label, category_id, amount_xof, business_date, payment_method,
  supplier, reference, description, status, cancellation_reason)
  on public.expenses to authenticated;

grant select, insert on public.conversations to authenticated;
grant update (status, assigned_to) on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert on public.conversation_reads to authenticated;
grant update (last_read_message_id, last_read_at)
  on public.conversation_reads to authenticated;
grant select, insert on public.conversation_internal_notes to authenticated;
grant update (body) on public.conversation_internal_notes to authenticated;
grant select, insert on public.message_templates to authenticated;
grant update (subject, body, allowed_variables, status, provider_status, version)
  on public.message_templates to authenticated;
grant select, insert on public.quick_replies to authenticated;
grant update (title, body, is_active, sort_order)
  on public.quick_replies to authenticated;

grant select, insert, delete on public.push_subscriptions to authenticated;
grant update (subscription_keys, user_agent, device_label, is_revoked, last_seen_at)
  on public.push_subscriptions to authenticated;
grant select, insert on public.communication_preferences to authenticated;
grant update (user_id, transactional_in_app, transactional_push,
  transactional_whatsapp, transactional_whatsapp_consented_at,
  transactional_sms, transactional_sms_consented_at, transactional_email,
  marketing_opt_in, marketing_consented_at, consent_source)
  on public.communication_preferences to authenticated;
grant select, insert on public.messaging_channels to authenticated;
grant update (provider, sender_identifier, credential_secret_ref, status, daily_limit)
  on public.messaging_channels to authenticated;
grant select on public.usage_counters to authenticated;
grant select on public.audit_log to authenticated;

-- Aucun privilège authenticated/anon sur ticket_counters, notification_outbox,
-- notification_deliveries et provider_webhook_events : service serveur uniquement.

-- ---------------------------------------------------------------------------
-- Identité, organisations et agences
-- ---------------------------------------------------------------------------

create policy platform_admins_select_self on public.platform_admins
for select to authenticated
using (user_id = auth.uid() and is_active);

create policy profiles_select_self_or_shared_org on public.profiles
for select to authenticated
using (
  user_id = auth.uid()
  or private.is_platform_admin()
  or private.shares_organization_with(user_id)
);
create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (user_id = auth.uid());
create policy profiles_update_self on public.profiles
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy organizations_select on public.organizations
for select to authenticated
using (
  private.is_platform_admin()
  or private.has_organization_access(id)
  or private.is_organization_customer(id)
);
create policy organizations_insert_platform on public.organizations
for insert to authenticated
with check (
  private.is_platform_admin()
  and (created_by is null or created_by = auth.uid())
);
create policy organizations_update on public.organizations
for update to authenticated
using (
  private.is_platform_admin()
  or private.has_organization_access(id, array['organization_owner'])
)
with check (
  private.is_platform_admin()
  or private.has_organization_access(id, array['organization_owner'])
);

create policy shops_select on public.shops
for select to authenticated
using (
  private.is_platform_admin()
  or private.has_shop_access(id)
  or private.is_organization_customer(organization_id)
);
create policy shops_insert on public.shops
for insert to authenticated
with check (
  private.is_platform_admin()
  or private.has_organization_access(organization_id, array['organization_owner'])
);
create policy shops_update on public.shops
for update to authenticated
using (
  private.is_platform_admin()
  or private.has_shop_access(id, array['organization_owner', 'shop_manager'])
)
with check (
  private.is_platform_admin()
  or private.has_shop_access(id, array['organization_owner', 'shop_manager'])
);

create policy memberships_select on public.memberships
for select to authenticated
using (
  user_id = auth.uid()
  or private.is_platform_admin()
  or private.has_organization_access(
    organization_id, array['organization_owner', 'shop_manager']
  )
);
create policy memberships_insert on public.memberships
for insert to authenticated
with check (
  private.is_platform_admin()
  or private.has_organization_access(organization_id, array['organization_owner'])
);
create policy memberships_update on public.memberships
for update to authenticated
using (
  private.is_platform_admin()
  or private.has_organization_access(organization_id, array['organization_owner'])
)
with check (
  private.is_platform_admin()
  or private.has_organization_access(organization_id, array['organization_owner'])
);

create policy invitations_select on public.invitations
for select to authenticated
using (
  private.is_platform_admin()
  or private.has_organization_access(organization_id, array['organization_owner'])
);
create policy invitations_insert on public.invitations
for insert to authenticated
with check (
  (invited_by is null or invited_by = auth.uid())
  and (
    private.is_platform_admin()
    or private.has_organization_access(organization_id, array['organization_owner'])
  )
);
create policy invitations_update on public.invitations
for update to authenticated
using (
  private.is_platform_admin()
  or private.has_organization_access(organization_id, array['organization_owner'])
)
with check (
  private.is_platform_admin()
  or private.has_organization_access(organization_id, array['organization_owner'])
);

-- ---------------------------------------------------------------------------
-- Personnel, paramètres, catalogue et clients
-- ---------------------------------------------------------------------------

create policy employees_select on public.employees
for select to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
  or private.is_assigned_employee(id)
);
create policy employees_insert on public.employees
for insert to authenticated
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);
create policy employees_update on public.employees
for update to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
)
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);

create policy attendance_select on public.attendance_records
for select to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
  or private.is_assigned_employee(employee_id)
);
create policy attendance_insert on public.attendance_records
for insert to authenticated
with check (
  (recorded_by is null or recorded_by = auth.uid())
  and private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);
create policy attendance_update on public.attendance_records
for update to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
)
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);

create policy shop_settings_select on public.shop_settings
for select to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
);
create policy shop_settings_insert on public.shop_settings
for insert to authenticated
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);
create policy shop_settings_update on public.shop_settings
for update to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
)
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);

create policy catalog_select on public.service_catalog_items
for select to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
  or (is_active and private.is_organization_customer(organization_id))
);
create policy catalog_insert on public.service_catalog_items
for insert to authenticated
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);
create policy catalog_update on public.service_catalog_items
for update to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
)
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);

create policy customers_select on public.customers
for select to authenticated
using (
  private.has_organization_access(
    organization_id,
    array['organization_owner', 'shop_manager', 'cashier']
  )
  or private.is_customer_linked(id)
);
create policy customers_insert on public.customers
for insert to authenticated
with check (
  private.has_organization_access(
    organization_id, array['organization_owner', 'shop_manager', 'cashier']
  )
);
create policy customers_update on public.customers
for update to authenticated
using (
  private.has_organization_access(
    organization_id, array['organization_owner', 'shop_manager', 'cashier']
  )
  or private.is_customer_linked(id)
)
with check (
  private.has_organization_access(
    organization_id, array['organization_owner', 'shop_manager', 'cashier']
  )
  or private.is_customer_linked(id)
);

create policy customer_links_select on public.customer_account_links
for select to authenticated
using (
  user_id = auth.uid()
  or private.has_organization_access(
    organization_id, array['organization_owner', 'shop_manager', 'cashier']
  )
);

-- ---------------------------------------------------------------------------
-- Commandes, rangement, tournées et caisse
-- ---------------------------------------------------------------------------

create policy storage_locations_select on public.storage_locations
for select to authenticated
using (private.has_shop_access(shop_id));
create policy storage_locations_insert on public.storage_locations
for insert to authenticated
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);
create policy storage_locations_update on public.storage_locations
for update to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
)
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);

create policy orders_select on public.orders
for select to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
  or (
    private.has_shop_access(shop_id, array['courier'])
    and exists (
      select 1
      from public.logistics_tasks lt
      where lt.order_id = orders.id
        and private.is_assigned_employee(lt.assigned_employee_id)
    )
  )
  or private.is_customer_linked(customer_id)
);
create policy orders_insert on public.orders
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier']
  )
);
-- La séparation par colonne limite la casse, mais les transitions sensibles
-- devront passer par des RPC dédiées en phase 1.
create policy orders_update_staff on public.orders
for update to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
)
with check (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
);

create policy order_events_select on public.order_events
for select to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
  or (
    private.has_shop_access(shop_id, array['courier'])
    and exists (
      select 1
      from public.logistics_tasks lt
      where lt.order_id = order_events.order_id
        and private.is_assigned_employee(lt.assigned_employee_id)
    )
  )
  or (
    visibility = 'customer'
    and exists (
      select 1 from public.orders o
      where o.id = order_events.order_id
        and private.is_customer_linked(o.customer_id)
    )
  )
);

create policy logistics_select on public.logistics_tasks
for select to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
  or (
    private.has_shop_access(shop_id, array['courier'])
    and private.is_assigned_employee(assigned_employee_id)
  )
  or private.is_customer_linked(customer_id)
);
create policy logistics_insert on public.logistics_tasks
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier']
  )
);
create policy logistics_update on public.logistics_tasks
for update to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier']
  )
  or (
    private.has_shop_access(shop_id, array['courier'])
    and private.is_assigned_employee(assigned_employee_id)
  )
)
with check (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier']
  )
  or (
    private.has_shop_access(shop_id, array['courier'])
    and private.is_assigned_employee(assigned_employee_id)
  )
);

create policy pickup_requests_select on public.pickup_requests
for select to authenticated
using (
  private.has_shop_access(shop_id)
  or (customer_id is not null and private.is_customer_linked(customer_id))
);
create policy pickup_requests_insert on public.pickup_requests
for insert to authenticated
with check (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier']
  )
  or (
    requester_user_id = auth.uid()
    and customer_id is not null
    and private.is_customer_linked(customer_id)
    and status = 'pending'
    and source = 'customer_portal'
    and staff_notes is null
    and converted_task_id is null
  )
);
create policy pickup_requests_update_staff on public.pickup_requests
for update to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier']
  )
)
with check (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier']
  )
);

create policy cash_register_select on public.cash_register_days
for select to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier']
  )
);
create policy cash_register_insert on public.cash_register_days
for insert to authenticated
with check (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier']
  )
);
create policy cash_register_update on public.cash_register_days
for update to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier']
  )
)
with check (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier']
  )
);

create policy products_select on public.products
for select to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
);
create policy products_insert on public.products
for insert to authenticated
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);
create policy products_update on public.products
for update to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
)
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);

create policy stock_movements_select on public.stock_movements
for select to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
);
create policy stock_movements_insert on public.stock_movements
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'workshop']
  )
);

create policy expense_categories_select on public.expense_categories
for select to authenticated
using (
  private.has_organization_access(
    organization_id, array['organization_owner', 'shop_manager']
  )
);
create policy expense_categories_insert on public.expense_categories
for insert to authenticated
with check (
  private.has_organization_access(
    organization_id, array['organization_owner', 'shop_manager']
  )
);
create policy expense_categories_update on public.expense_categories
for update to authenticated
using (
  private.has_organization_access(
    organization_id, array['organization_owner', 'shop_manager']
  )
)
with check (
  private.has_organization_access(
    organization_id, array['organization_owner', 'shop_manager']
  )
);

create policy expenses_select on public.expenses
for select to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);
create policy expenses_insert on public.expenses
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);
create policy expenses_update on public.expenses
for update to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
)
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);

-- ---------------------------------------------------------------------------
-- Messagerie, préférences et administration des canaux
-- ---------------------------------------------------------------------------

create policy conversations_select on public.conversations
for select to authenticated
using (private.can_access_conversation(id));
create policy conversations_insert on public.conversations
for insert to authenticated
with check (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
  or (
    private.is_customer_linked(customer_id)
    and status = 'open'
    and assigned_to is null
    and last_message_id is null
    and last_message_at is null
    and last_message_preview is null
  )
);
create policy conversations_update_staff on public.conversations
for update to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
)
with check (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
);

create policy messages_select on public.messages
for select to authenticated
using (private.can_access_conversation(conversation_id));
create policy messages_insert_customer on public.messages
for insert to authenticated
with check (
  sender_type = 'customer'
  and message_kind in ('text', 'quick_action', 'media')
  and sender_user_id = auth.uid()
  and private.is_customer_linked(customer_id)
  and private.can_access_conversation(conversation_id)
);
create policy messages_insert_staff on public.messages
for insert to authenticated
with check (
  sender_type = 'staff'
  and message_kind in ('text', 'quick_action', 'media')
  and sender_user_id = auth.uid()
  and private.has_shop_access(
    shop_id,
    array['organization_owner', 'shop_manager', 'cashier', 'workshop', 'courier']
  )
  and private.can_access_conversation(conversation_id)
);

create policy conversation_reads_select on public.conversation_reads
for select to authenticated
using (user_id = auth.uid() and private.can_access_conversation(conversation_id));
create policy conversation_reads_insert on public.conversation_reads
for insert to authenticated
with check (user_id = auth.uid() and private.can_access_conversation(conversation_id));
create policy conversation_reads_update on public.conversation_reads
for update to authenticated
using (user_id = auth.uid() and private.can_access_conversation(conversation_id))
with check (user_id = auth.uid() and private.can_access_conversation(conversation_id));

create policy internal_notes_select on public.conversation_internal_notes
for select to authenticated
using (
  private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
);
create policy internal_notes_insert on public.conversation_internal_notes
for insert to authenticated
with check (
  author_user_id = auth.uid()
  and private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
);
create policy internal_notes_update_author on public.conversation_internal_notes
for update to authenticated
using (
  author_user_id = auth.uid()
  and private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
)
with check (
  author_user_id = auth.uid()
  and private.has_shop_access(
    shop_id, array['organization_owner', 'shop_manager', 'cashier', 'workshop']
  )
);

create policy message_templates_select on public.message_templates
for select to authenticated
using (private.has_shop_access(shop_id));
create policy message_templates_insert on public.message_templates
for insert to authenticated
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);
create policy message_templates_update on public.message_templates
for update to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
)
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);

create policy quick_replies_select on public.quick_replies
for select to authenticated
using (private.has_shop_access(shop_id));
create policy quick_replies_insert on public.quick_replies
for insert to authenticated
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);
create policy quick_replies_update on public.quick_replies
for update to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
)
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);

create policy push_subscriptions_select on public.push_subscriptions
for select to authenticated
using (user_id = auth.uid());
create policy push_subscriptions_insert on public.push_subscriptions
for insert to authenticated
with check (user_id = auth.uid());
create policy push_subscriptions_update on public.push_subscriptions
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions
for delete to authenticated
using (user_id = auth.uid());

create policy communication_preferences_select on public.communication_preferences
for select to authenticated
using (
  private.is_customer_linked(customer_id)
  or private.has_organization_access(
    organization_id, array['organization_owner', 'shop_manager', 'cashier']
  )
);
create policy communication_preferences_insert on public.communication_preferences
for insert to authenticated
with check (
  private.is_customer_linked(customer_id)
  and (user_id is null or user_id = auth.uid())
);
create policy communication_preferences_update on public.communication_preferences
for update to authenticated
using (private.is_customer_linked(customer_id))
with check (
  private.is_customer_linked(customer_id)
  and (user_id is null or user_id = auth.uid())
);

create policy messaging_channels_select on public.messaging_channels
for select to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);
create policy messaging_channels_insert on public.messaging_channels
for insert to authenticated
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);
create policy messaging_channels_update on public.messaging_channels
for update to authenticated
using (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
)
with check (
  private.has_shop_access(shop_id, array['organization_owner', 'shop_manager'])
);

create policy usage_counters_select on public.usage_counters
for select to authenticated
using (
  private.is_platform_admin()
  or private.has_organization_access(organization_id, array['organization_owner'])
  or (
    shop_id is not null
    and private.has_shop_access(shop_id, array['shop_manager'])
  )
);

create policy audit_log_select on public.audit_log
for select to authenticated
using (
  private.is_platform_admin()
  or (
    organization_id is not null
    and private.has_organization_access(organization_id, array['organization_owner'])
  )
);
