import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const migrationsDir = join(repoRoot, 'supabase', 'migrations');
const fixturesPath = join(here, 'fixtures.sql');

const users = {
  platform: '00000000-0000-4000-8000-000000000001',
  ownerA: '00000000-0000-4000-8000-000000000101',
  cashierA1: '00000000-0000-4000-8000-000000000102',
  workshopA2: '00000000-0000-4000-8000-000000000103',
  courierA1: '00000000-0000-4000-8000-000000000104',
  ownerB: '00000000-0000-4000-8000-000000000201',
  sharedCustomer: '00000000-0000-4000-8000-000000000301',
  otherCustomer: '00000000-0000-4000-8000-000000000302',
};

const idsOf = (rows, key = 'id') => rows.map((row) => row[key]).sort();

let passed = 0;
const check = async (label, fn) => {
  await fn();
  passed += 1;
  console.log(`✓ ${label}`);
};

const expectFailure = async (label, fn, pattern) => {
  try {
    await fn();
  } catch (error) {
    if (pattern) assert.match(String(error?.message ?? error), pattern);
    passed += 1;
    console.log(`✓ ${label}`);
    return;
  }
  assert.fail(`${label} : l’opération aurait dû échouer`);
};

const db = new PGlite();
await db.waitReady;

const asRole = async (role, userId, fn) => {
  await db.exec(`
    reset role;
    set role ${role};
    select set_config('test.user_id', '${userId ?? ''}', false);
  `);
  try {
    return await fn();
  } finally {
    await db.exec(`
      reset role;
      select set_config('test.user_id', '', false);
    `);
  }
};

const queryAs = (userId, sql, params = []) =>
  asRole('authenticated', userId, () => db.query(sql, params));

try {
  // Émulation minimale de Supabase Auth pour PostgreSQL local.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role supabase_auth_admin nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      phone text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);

  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    await db.exec(await readFile(join(migrationsDir, file), 'utf8'));
  }
  await db.exec(await readFile(fixturesPath, 'utf8'));

  await check('toutes les tables publiques ont RLS activée et forcée', async () => {
    const result = await db.query(`
      select count(*)::int as total,
             count(*) filter (where relrowsecurity and relforcerowsecurity)::int as protected
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    `);
    assert.equal(result.rows[0].total, 37);
    assert.equal(result.rows[0].protected, 37);
  });

  await check('chaque propriétaire ne voit que ses agences', async () => {
    const a = await queryAs(users.ownerA, 'select id from public.shops order by id');
    const b = await queryAs(users.ownerB, 'select id from public.shops order by id');
    assert.deepEqual(idsOf(a.rows), [
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
    ]);
    assert.deepEqual(idsOf(b.rows), ['20000000-0000-4000-8000-000000000003']);
  });

  await check('les employés restent limités à leur agence', async () => {
    const cashierOrders = await queryAs(
      users.cashierA1,
      'select id from public.orders order by id'
    );
    const workshopOrders = await queryAs(
      users.workshopA2,
      'select id from public.orders order by id'
    );
    assert.deepEqual(idsOf(cashierOrders.rows), [
      '50000000-0000-4000-8000-000000000001',
    ]);
    assert.deepEqual(idsOf(workshopOrders.rows), [
      '50000000-0000-4000-8000-000000000002',
    ]);
  });

  await check('une même cliente voit ses commandes des deux pressings, sans celles des autres', async () => {
    const shared = await queryAs(
      users.sharedCustomer,
      'select id from public.orders order by id'
    );
    const other = await queryAs(
      users.otherCustomer,
      'select id from public.orders order by id'
    );
    assert.deepEqual(idsOf(shared.rows), [
      '50000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000003',
    ]);
    assert.deepEqual(idsOf(other.rows), [
      '50000000-0000-4000-8000-000000000002',
    ]);
  });

  await check('le super-admin voit les organisations mais pas les commandes métier', async () => {
    const organizations = await queryAs(
      users.platform,
      'select id from public.organizations order by id'
    );
    const orders = await queryAs(users.platform, 'select id from public.orders');
    assert.equal(organizations.rows.length, 2);
    assert.equal(orders.rows.length, 0);
  });

  await check('le coursier ne voit que sa tournée et la commande liée', async () => {
    const tasks = await queryAs(
      users.courierA1,
      'select id from public.logistics_tasks order by id'
    );
    const orders = await queryAs(
      users.courierA1,
      'select id from public.orders order by id'
    );
    const customers = await queryAs(users.courierA1, 'select id from public.customers');
    assert.deepEqual(idsOf(tasks.rows), [
      '70000000-0000-4000-8000-000000000001',
    ]);
    assert.deepEqual(idsOf(orders.rows), [
      '50000000-0000-4000-8000-000000000001',
    ]);
    assert.equal(customers.rows.length, 0);
  });

  await check('les conversations sont cloisonnées et les notes internes invisibles au client', async () => {
    const customerConversations = await queryAs(
      users.sharedCustomer,
      'select id from public.conversations order by id'
    );
    const cashierConversations = await queryAs(
      users.cashierA1,
      'select id from public.conversations order by id'
    );
    const customerNotes = await queryAs(
      users.sharedCustomer,
      'select id from public.conversation_internal_notes'
    );
    const cashierNotes = await queryAs(
      users.cashierA1,
      'select id from public.conversation_internal_notes'
    );
    assert.equal(customerConversations.rows.length, 2);
    assert.deepEqual(idsOf(cashierConversations.rows), [
      '80000000-0000-4000-8000-000000000001',
    ]);
    assert.equal(customerNotes.rows.length, 0);
    assert.equal(cashierNotes.rows.length, 1);
  });

  await check('la cliente peut écrire dans sa conversation', async () => {
    const inserted = await queryAs(
      users.sharedCustomer,
      `
        insert into public.messages (
          organization_id, shop_id, customer_id, conversation_id,
          sender_type, sender_user_id, body, client_idempotency_key
        ) values (
          '10000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000001',
          '40000000-0000-4000-8000-000000000001',
          '80000000-0000-4000-8000-000000000001',
          'customer', $1, 'Je passerai après 17 h.', 'phase0-message-1'
        )
        returning id
      `,
      [users.sharedCustomer]
    );
    assert.equal(inserted.rows.length, 1);
  });

  await expectFailure('une cliente ne peut pas écrire dans la conversation d’un autre tenant', async () => {
    await queryAs(
      users.otherCustomer,
      `
        insert into public.messages (
          organization_id, shop_id, customer_id, conversation_id,
          sender_type, sender_user_id, body
        ) values (
          '10000000-0000-4000-8000-000000000002',
          '20000000-0000-4000-8000-000000000003',
          '40000000-0000-4000-8000-000000000002',
          '80000000-0000-4000-8000-000000000003',
          'customer', $1, 'Message interdit'
        )
      `,
      [users.otherCustomer]
    );
  });

  await expectFailure('une cliente ne peut pas fabriquer un message de statut', async () => {
    await queryAs(
      users.sharedCustomer,
      `
        insert into public.messages (
          organization_id, shop_id, customer_id, conversation_id,
          sender_type, sender_user_id, message_kind, body
        ) values (
          '10000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000001',
          '40000000-0000-4000-8000-000000000001',
          '80000000-0000-4000-8000-000000000001',
          'customer', $1, 'status_event', 'Commande prétendument prête'
        )
      `,
      [users.sharedCustomer]
    );
  }, /réservé au serveur/i);

  await expectFailure('une commande ne peut pas relier une agence A à un client B', async () => {
    await db.query(`
      insert into public.orders (
        organization_id, shop_id, customer_id,
        customer_name_snapshot, customer_phone_snapshot, lines,
        subtotal_xof, total_xof, payment_method, promised_at
      ) values (
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '40000000-0000-4000-8000-000000000002',
        'Cliente Partagée', '07 00 00 03 01',
        '[{"name":"Chemise","quantity":1}]'::jsonb,
        500, 500, 'especes', now() + interval '1 day'
      )
    `);
  });

  await expectFailure('une tournée ne peut pas relier un client à la commande d’un autre client', async () => {
    await db.query(`
      insert into public.logistics_tasks (
        organization_id, shop_id, kind, customer_id,
        customer_name_snapshot, customer_phone_snapshot, address,
        scheduled_date, time_slot, order_id
      ) values (
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        'delivery',
        '40000000-0000-4000-8000-000000000003',
        'Autre Cliente', '07 00 00 03 02', 'Autre adresse fictive',
        current_date + 1, '10:00-12:00',
        '50000000-0000-4000-8000-000000000001'
      )
    `);
  });

  await check('le compteur attribue un ticket unique par agence et journalise l’événement', async () => {
    const inserted = await queryAs(
      users.cashierA1,
      `
        insert into public.orders (
          organization_id, shop_id, customer_id, ticket_number,
          customer_name_snapshot, customer_phone_snapshot, lines,
          subtotal_xof, total_xof, payment_method, promised_at, created_by
        ) values (
          '10000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000001',
          '40000000-0000-4000-8000-000000000001', 999,
          'Cliente Partagée', '07 00 00 03 01',
          '[{"name":"Chemise","quantity":1,"unitPrice":500,"subtotal":500}]'::jsonb,
          500, 500, 'wave', now() + interval '2 days', $1
        )
        returning id, ticket_number::text, ticket_label
      `,
      [users.cashierA1]
    );
    assert.equal(inserted.rows[0].ticket_number, '2');
    assert.equal(inserted.rows[0].ticket_label, '#TK-2');
    const events = await db.query(
      'select count(*)::int as count from public.order_events where order_id = $1',
      [inserted.rows[0].id]
    );
    assert.equal(events.rows[0].count, 1);
  });

  await check('la cliente peut créer une demande d’enlèvement en attente', async () => {
    const inserted = await queryAs(
      users.sharedCustomer,
      `
        insert into public.pickup_requests (
          organization_id, shop_id, customer_id, requester_user_id,
          contact_name, contact_phone_display, contact_phone_e164,
          address, requested_date, requested_time_slot, estimated_bags,
          status, source, idempotency_key
        ) values (
          '10000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000001',
          '40000000-0000-4000-8000-000000000001', $1,
          'Cliente Partagée', '07 00 00 03 01', '+2250700000301',
          'Adresse fictive Alpha', current_date + 1, '10:00-12:00', 2,
          'pending', 'customer_portal', 'phase0-pickup-1'
        )
        returning id, status
      `,
      [users.sharedCustomer]
    );
    assert.equal(inserted.rows[0].status, 'pending');
  });

  await expectFailure('la cliente ne peut pas confirmer elle-même son enlèvement', async () => {
    await queryAs(
      users.sharedCustomer,
      `
        insert into public.pickup_requests (
          organization_id, shop_id, customer_id, requester_user_id,
          contact_name, contact_phone_display, address,
          requested_date, requested_time_slot, status, source
        ) values (
          '10000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000001',
          '40000000-0000-4000-8000-000000000001', $1,
          'Cliente Partagée', '07 00 00 03 01', 'Adresse fictive Alpha',
          current_date + 1, '10:00-12:00', 'confirmed', 'customer_portal'
        )
      `,
      [users.sharedCustomer]
    );
  });

  await check('un mouvement sortant met le stock à jour', async () => {
    await queryAs(
      users.ownerA,
      `
        insert into public.stock_movements (
          organization_id, shop_id, product_id, movement_type,
          quantity_input, business_date, reason, created_by
        ) values (
          '10000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000001',
          'a0000000-0000-4000-8000-000000000001',
          'out', 3, current_date, 'Consommation fictive', $1
        )
      `,
      [users.ownerA]
    );
    const product = await db.query(`
      select current_quantity::text
      from public.products
      where id = 'a0000000-0000-4000-8000-000000000001'
    `);
    assert.equal(product.rows[0].current_quantity, '7.000');
  });

  await expectFailure('le stock ne peut pas devenir négatif', async () => {
    await queryAs(
      users.ownerA,
      `
        insert into public.stock_movements (
          organization_id, shop_id, product_id, movement_type,
          quantity_input, business_date, reason, created_by
        ) values (
          '10000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000001',
          'a0000000-0000-4000-8000-000000000001',
          'out', 99, current_date, 'Sortie impossible', $1
        )
      `,
      [users.ownerA]
    );
  });

  await expectFailure('anon ne peut pas lire les commandes', async () => {
    await asRole('anon', null, () => db.query('select id from public.orders'));
  }, /permission denied/i);

  await expectFailure('authenticated ne peut pas lire l’outbox serveur', async () => {
    await queryAs(users.ownerA, 'select id from public.notification_outbox');
  }, /permission denied/i);

  console.log(`\nPhase 0 PGlite : ${passed} vérifications réussies.`);
} catch (error) {
  console.error(`\nÉchec Phase 0 PGlite : ${error?.message ?? error}`);
  if (error?.detail) console.error(`Détail PostgreSQL : ${error.detail}`);
  if (error?.hint) console.error(`Indice PostgreSQL : ${error.hint}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
