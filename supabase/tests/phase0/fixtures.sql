-- Fixtures Phase 0 — tenants ENTIEREMENT fictifs.
-- À exécuter uniquement en local ou sur un projet Supabase de validation jetable.
-- Ne jamais exécuter sur une base contenant de vrais pressings/clients.

begin;

insert into auth.users (id, email, phone, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'plateforme@example.test', null, '{"full_name":"Admin Plateforme Fictif"}'::jsonb),
  ('00000000-0000-4000-8000-000000000101', 'proprietaire-a@example.test', '+2250700000101', '{"full_name":"Propriétaire A"}'::jsonb),
  ('00000000-0000-4000-8000-000000000102', 'caisse-a1@example.test', '+2250700000102', '{"full_name":"Caisse A1"}'::jsonb),
  ('00000000-0000-4000-8000-000000000103', 'atelier-a2@example.test', '+2250700000103', '{"full_name":"Atelier A2"}'::jsonb),
  ('00000000-0000-4000-8000-000000000104', 'coursier-a1@example.test', '+2250700000104', '{"full_name":"Coursier A1"}'::jsonb),
  ('00000000-0000-4000-8000-000000000201', 'proprietaire-b@example.test', '+2250700000201', '{"full_name":"Propriétaire B"}'::jsonb),
  ('00000000-0000-4000-8000-000000000301', 'cliente-partagee@example.test', '+2250700000301', '{"full_name":"Cliente Partagée"}'::jsonb),
  ('00000000-0000-4000-8000-000000000302', 'autre-cliente@example.test', '+2250700000302', '{"full_name":"Autre Cliente"}'::jsonb);

insert into public.platform_admins (user_id, note)
values ('00000000-0000-4000-8000-000000000001', 'Fixture locale uniquement');

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-4000-8000-000000000001', 'Pressing Alpha Fictif', 'alpha-fictif', '00000000-0000-4000-8000-000000000101'),
  ('10000000-0000-4000-8000-000000000002', 'Pressing Bravo Fictif', 'bravo-fictif', '00000000-0000-4000-8000-000000000201');

insert into public.shops (
  id, organization_id, name, slug, public_slug, address, city, phone_display
) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Alpha Cocody', 'cocody', 'alpha-cocody-fictif', 'Rue fictive 1', 'Abidjan', '+225 07 00 00 01 01'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Alpha Plateau', 'plateau', 'alpha-plateau-fictif', 'Rue fictive 2', 'Abidjan', '+225 07 00 00 01 02'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Bravo Marcory', 'marcory', 'bravo-marcory-fictif', 'Rue fictive 3', 'Abidjan', '+225 07 00 00 02 01');

insert into public.shop_settings (shop_id, organization_id, tagline) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Alpha propre et rapide'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Alpha propre et rapide'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Bravo soin textile');

insert into public.employees (
  id, organization_id, shop_id, full_name, phone_display, position, hired_on
) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Coursier A1', '+2250700000104', 'Livraison', date '2026-01-05'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'Atelier A2', '+2250700000103', 'Repassage', date '2026-01-05');

insert into public.memberships (organization_id, shop_id, user_id, employee_id, role) values
  ('10000000-0000-4000-8000-000000000001', null, '00000000-0000-4000-8000-000000000101', null, 'organization_owner'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', null, 'cashier'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', '30000000-0000-4000-8000-000000000002', 'workshop'),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000104', '30000000-0000-4000-8000-000000000001', 'courier'),
  ('10000000-0000-4000-8000-000000000002', null, '00000000-0000-4000-8000-000000000201', null, 'organization_owner');

-- Même personne et même numéro, mais fiches CRM séparées par organisation.
insert into public.customers (
  id, organization_id, full_name, phone_display, phone_e164, address, loyalty_discount_percent
) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Cliente Partagée', '07 00 00 03 01', '+2250700000301', 'Adresse fictive Alpha', 5),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Cliente Partagée', '07 00 00 03 01', '+2250700000301', 'Adresse fictive Bravo', 0),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Autre Cliente', '07 00 00 03 02', '+2250700000302', 'Autre adresse fictive', 0);

insert into public.customer_account_links (
  organization_id, customer_id, user_id, verified_phone_e164
) values
  ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301', '+2250700000301'),
  ('10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000301', '+2250700000301'),
  ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000302', '+2250700000302');

insert into public.service_catalog_items (
  id, organization_id, shop_id, legacy_key, name, service_category, pricing_type, unit_price_xof
) values
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'chemise', 'Chemise', 'pressing', 'unit', 500),
  ('b0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'chemise', 'Chemise', 'pressing', 'unit', 700);

insert into public.storage_locations (
  id, organization_id, shop_id, code, label, zone, capacity_packages
) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'A-01', 'Portant Alpha', 'hanging', 20),
  ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'A-01', 'Portant Bravo', 'hanging', 20);

insert into public.orders (
  id, organization_id, shop_id, customer_id,
  customer_name_snapshot, customer_phone_snapshot, customer_address_snapshot,
  lines, subtotal_xof, total_xof, deposit_paid_xof, payment_method,
  status, promised_at, ready_at, fulfillment_method, delivery_address_snapshot,
  delivery_date, delivery_time_slot, created_by
) values
  (
    '50000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'Cliente Partagée', '07 00 00 03 01', 'Adresse fictive Alpha',
    '[{"name":"Chemise","quantity":2,"unitPrice":500,"subtotal":1000}]'::jsonb,
    1000, 2000, 500, 'wave', 'washing', now() + interval '2 days', null,
    'home_delivery', 'Adresse fictive Alpha', current_date + 2, '16:00-18:00',
    '00000000-0000-4000-8000-000000000102'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003',
    'Autre Cliente', '07 00 00 03 02', 'Autre adresse fictive',
    '[{"name":"Robe","quantity":1,"unitPrice":2000,"subtotal":2000}]'::jsonb,
    2000, 2000, 2000, 'especes', 'ironing', now() + interval '1 day', null,
    'counter_pickup', null, null, null,
    '00000000-0000-4000-8000-000000000101'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000002',
    'Cliente Partagée', '07 00 00 03 01', 'Adresse fictive Bravo',
    '[{"name":"Chemise","quantity":1,"unitPrice":700,"subtotal":700}]'::jsonb,
    700, 700, 0, 'especes', 'ready', now() + interval '1 day', now(),
    'counter_pickup', null, null, null,
    '00000000-0000-4000-8000-000000000201'
  );

update public.orders
set ready_at = now(),
    storage_location_id = '60000000-0000-4000-8000-000000000003',
    storage_location_code_snapshot = 'A-01',
    storage_location_label_snapshot = 'Portant Bravo',
    storage_package_count = 1,
    rack_location_snapshot = 'A-01 · Portant Bravo',
    stored_at = now()
where id = '50000000-0000-4000-8000-000000000003';

insert into public.logistics_tasks (
  id, organization_id, shop_id, kind, status, customer_id,
  customer_name_snapshot, customer_phone_snapshot, address,
  scheduled_date, time_slot, assigned_employee_id,
  assigned_employee_name_snapshot, order_id, order_ticket_label_snapshot,
  fee_xof, created_by
) values
  (
    '70000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'delivery', 'scheduled',
    '40000000-0000-4000-8000-000000000001',
    'Cliente Partagée', '07 00 00 03 01', 'Adresse fictive Alpha',
    current_date + 2, '16:00-18:00',
    '30000000-0000-4000-8000-000000000001', 'Coursier A1',
    '50000000-0000-4000-8000-000000000001', '#TK-1', 1000,
    '00000000-0000-4000-8000-000000000102'
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    'pickup', 'scheduled',
    '40000000-0000-4000-8000-000000000002',
    'Cliente Partagée', '07 00 00 03 01', 'Adresse fictive Bravo',
    current_date + 1, '10:00-12:00', null, null, null, null, 1000,
    '00000000-0000-4000-8000-000000000201'
  );

insert into public.conversations (
  id, organization_id, shop_id, customer_id, order_id, logistics_task_id, conversation_type
) values
  ('80000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'order'),
  ('80000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003', null, 'order');

insert into public.messages (
  id, organization_id, shop_id, customer_id, conversation_id,
  sender_type, sender_user_id, body
) values
  ('90000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'customer', '00000000-0000-4000-8000-000000000301', 'Bonjour, merci de sonner à la grille.'),
  ('90000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000003', 'staff', '00000000-0000-4000-8000-000000000201', 'Votre commande est prête.');

insert into public.conversation_internal_notes (
  organization_id, shop_id, customer_id, conversation_id, author_user_id, body
) values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000102',
  'Note interne fictive : vérifier le col avant départ.'
);

insert into public.products (
  id, organization_id, shop_id, name, reference, category, unit,
  current_quantity, alert_threshold, unit_cost_xof
) values (
  'a0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Lessive fictive', 'LESSIVE-TEST', 'Détergents et lessives', 'L', 10, 2, 3000
);

insert into public.notification_outbox (
  organization_id, shop_id, customer_id, recipient_user_id,
  event_key, aggregate_type, aggregate_id, conversation_id, payload
) values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000301',
  'fixture-order-status-50000000-0000-4000-8000-000000000001',
  'order',
  '50000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001',
  '{"fixture":true}'::jsonb
);

commit;
