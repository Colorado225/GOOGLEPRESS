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
  newOwner: '00000000-0000-4000-8000-000000000411',
  newOwnerBis: '00000000-0000-4000-8000-000000000412',
};

let createdOrderId;
let createdPaymentId;

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
    assert.equal(result.rows[0].total, 38);
    assert.equal(result.rows[0].protected, 38);
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

  await expectFailure('un INSERT PostgREST direct ne peut plus contourner create_order', async () => {
    await queryAs(
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
      `,
      [users.cashierA1]
    );
  }, /permission denied/i);

  await check('create_order recalcule le catalogue, attribue le ticket et journalise la création', async () => {
    const inserted = await queryAs(
      users.cashierA1,
      `
        select
          id,
          ticket_number::text,
          ticket_label,
          subtotal_xof::int,
          discount_xof::int,
          total_xof::int,
          deposit_paid_xof::int,
          lines -> 0 ->> 'unitPrice' as server_unit_price
        from public.create_order(
          '20000000-0000-4000-8000-000000000001'::uuid,
          '40000000-0000-4000-8000-000000000001'::uuid,
          '[{"legacyKey":"chemise","quantity":2,"unitPrice":1,"subtotal":2}]'::jsonb,
          '2026-11-01T10:00:00Z'::timestamptz,
          'phase0-create-order-001'
        )
      `
    );
    assert.equal(inserted.rows[0].ticket_number, '2');
    assert.equal(inserted.rows[0].ticket_label, '#TK-2');
    assert.equal(inserted.rows[0].server_unit_price, '500');
    assert.equal(inserted.rows[0].subtotal_xof, 1000);
    assert.equal(inserted.rows[0].discount_xof, 50);
    assert.equal(inserted.rows[0].total_xof, 950);
    assert.equal(inserted.rows[0].deposit_paid_xof, 0);
    createdOrderId = inserted.rows[0].id;
    const events = await db.query(
      'select count(*)::int as count from public.order_events where order_id = $1',
      [inserted.rows[0].id]
    );
    assert.equal(events.rows[0].count, 1);
  });

  await check('la RPC déplace une étape et journalise acteur, note et visibilité', async () => {
    const transitioned = await queryAs(
      users.workshopA2,
      `
        select status
        from public.transition_order_status(
          $1::uuid,
          'washing',
          'ironing',
          'Retour fictif pour contrôle',
          'internal'
        )
      `,
      ['50000000-0000-4000-8000-000000000002']
    );
    assert.equal(transitioned.rows[0].status, 'washing');

    const latestEvent = await db.query(`
      select from_status, to_status, visibility, actor_type, actor_user_id,
             payload->>'note' as note, payload->>'source' as source
      from public.order_events
      where order_id = '50000000-0000-4000-8000-000000000002'
      order by created_at desc, id desc
      limit 1
    `);
    assert.deepEqual(latestEvent.rows[0], {
      from_status: 'ironing',
      to_status: 'washing',
      visibility: 'internal',
      actor_type: 'staff',
      actor_user_id: users.workshopA2,
      note: 'Retour fictif pour contrôle',
      source: 'production_rpc',
    });

    const customerEvents = await queryAs(
      users.otherCustomer,
      `
        select visibility
        from public.order_events
        where order_id = '50000000-0000-4000-8000-000000000002'
        order by created_at, id
      `
    );
    assert.ok(customerEvents.rows.length > 0);
    assert.ok(customerEvents.rows.every((row) => row.visibility === 'customer'));
  });

  await expectFailure('la RPC refuse une commande d’une autre agence', async () => {
    await queryAs(
      users.cashierA1,
      `
        select status
        from public.transition_order_status(
          '50000000-0000-4000-8000-000000000002'::uuid,
          'ironing',
          'washing'
        )
      `
    );
  }, /introuvable ou inaccessible/i);

  await expectFailure('la RPC refuse un statut déjà modifié sur un autre poste', async () => {
    await queryAs(
      users.workshopA2,
      `
        select status
        from public.transition_order_status(
          '50000000-0000-4000-8000-000000000002'::uuid,
          'ironing',
          'ironing'
        )
      `
    );
  }, /déjà changé/i);

  await expectFailure('la RPC refuse les sauts d’étape', async () => {
    await queryAs(
      users.cashierA1,
      `
        select status
        from public.transition_order_status(
          '50000000-0000-4000-8000-000000000001'::uuid,
          'ready',
          'washing'
        )
      `
    );
  }, /sans saut/i);

  await expectFailure('la RPC refuse la remise générique sans encaissement', async () => {
    await queryAs(
      users.cashierA1,
      `
        select status
        from public.transition_order_status(
          '50000000-0000-4000-8000-000000000001'::uuid,
          'delivered',
          'washing'
        )
      `
    );
  }, /remise finale/i);

  await expectFailure('un UPDATE générique ne peut plus contourner la RPC de statut', async () => {
    await queryAs(
      users.cashierA1,
      `
        update public.orders
        set status = 'ironing'
        where id = '50000000-0000-4000-8000-000000000001'
      `
    );
  }, /permission denied/i);

  await check('une livraison en route bloque la production puis la RPC reprend après retour à programmée', async () => {
    await db.query(`
      update public.logistics_tasks
      set status = 'en_route'
      where id = '70000000-0000-4000-8000-000000000001'
    `);
    try {
      await assert.rejects(
        queryAs(
          users.cashierA1,
          `
            select status
            from public.transition_order_status(
              '50000000-0000-4000-8000-000000000001'::uuid,
              'ironing',
              'washing'
            )
          `
        ),
        /déjà en livraison/i
      );
    } finally {
      await db.query(`
        update public.logistics_tasks
        set status = 'scheduled'
        where id = '70000000-0000-4000-8000-000000000001'
      `);
    }

    const transitioned = await queryAs(
      users.cashierA1,
      `
        select status
        from public.transition_order_status(
          '50000000-0000-4000-8000-000000000001'::uuid,
          'ironing',
          'washing',
          'Passage fictif au repassage',
          'customer'
        )
      `
    );
    assert.equal(transitioned.rows[0].status, 'ironing');
  });

  await check('le rangement obligatoire bloque le passage générique en prêt', async () => {
    const backToIroning = await queryAs(
      users.workshopA2,
      `
        select status
        from public.transition_order_status(
          '50000000-0000-4000-8000-000000000002'::uuid,
          'ironing',
          'washing'
        )
      `
    );
    assert.equal(backToIroning.rows[0].status, 'ironing');

    await db.query(`
      update public.shop_settings
      set storage_assignment_required = true
      where shop_id = '20000000-0000-4000-8000-000000000002'
    `);
    try {
      await assert.rejects(
        queryAs(
          users.workshopA2,
          `
            select status
            from public.transition_order_status(
              '50000000-0000-4000-8000-000000000002'::uuid,
              'ready',
              'ironing'
            )
          `
        ),
        /emplacement de rangement/i
      );
    } finally {
      await db.query(`
        update public.shop_settings
        set storage_assignment_required = false
        where shop_id = '20000000-0000-4000-8000-000000000002'
      `);
    }
  });

  await expectFailure('anon ne peut pas exécuter la RPC de transition', async () => {
    await asRole('anon', null, () =>
      db.query(`
        select status
        from public.transition_order_status(
          '50000000-0000-4000-8000-000000000001'::uuid,
          'washing',
          'ironing'
        )
      `)
    );
  }, /permission denied/i);

  await check('create_order est idempotent pour une même clé et un même contenu', async () => {
    const repeated = await queryAs(
      users.cashierA1,
      `
        select id
        from public.create_order(
          '20000000-0000-4000-8000-000000000001'::uuid,
          '40000000-0000-4000-8000-000000000001'::uuid,
          '[{"legacyKey":"chemise","quantity":2,"unitPrice":1,"subtotal":2}]'::jsonb,
          '2026-11-01T10:00:00Z'::timestamptz,
          'phase0-create-order-001'
        )
      `
    );
    const count = await db.query(
      "select count(*)::int as count from public.orders where idempotency_key = 'phase0-create-order-001'"
    );
    assert.equal(repeated.rows[0].id, createdOrderId);
    assert.equal(count.rows[0].count, 1);
  });

  await expectFailure('create_order refuse de réutiliser une clé pour un contenu différent', async () => {
    await queryAs(
      users.cashierA1,
      `
        select id
        from public.create_order(
          '20000000-0000-4000-8000-000000000001'::uuid,
          '40000000-0000-4000-8000-000000000001'::uuid,
          '[{"legacyKey":"chemise","quantity":3}]'::jsonb,
          '2026-11-01T10:00:00Z'::timestamptz,
          'phase0-create-order-001'
        )
      `
    );
  }, /autre commande/i);

  await expectFailure('create_order rejette une remise explicite supérieure à 100 pour cent', async () => {
    await queryAs(
      users.cashierA1,
      `
        select id
        from public.create_order(
          '20000000-0000-4000-8000-000000000001'::uuid,
          '40000000-0000-4000-8000-000000000001'::uuid,
          '[{"legacyKey":"chemise","quantity":1}]'::jsonb,
          '2026-11-01T10:00:00Z'::timestamptz,
          'phase0-create-order-invalid-discount',
          'pressing',
          'standard',
          101
        )
      `
    );
  }, /remise doit être comprise/i);

  await expectFailure('create_order exige les informations complètes d’un ramassage à domicile', async () => {
    await queryAs(
      users.cashierA1,
      `
        select id
        from public.create_order(
          '20000000-0000-4000-8000-000000000001'::uuid,
          '40000000-0000-4000-8000-000000000001'::uuid,
          '[{"legacyKey":"chemise","quantity":1}]'::jsonb,
          '2026-11-01T10:00:00Z'::timestamptz,
          'phase0-create-order-home-pickup-invalid',
          'pressing',
          'standard',
          null,
          null,
          null,
          null,
          'home_pickup'
        )
      `
    );
  }, /ramassage sont requis/i);

  await expectFailure('create_order rejette deux références catalogue incohérentes', async () => {
    const catalog = await db.query(
      "select id from public.service_catalog_items where shop_id = '20000000-0000-4000-8000-000000000001' and legacy_key = 'chemise'"
    );
    await queryAs(
      users.cashierA1,
      `
        select id
        from public.create_order(
          '20000000-0000-4000-8000-000000000001'::uuid,
          '40000000-0000-4000-8000-000000000001'::uuid,
          '[{"catalogItemId":"${catalog.rows[0].id}","legacyKey":"autre-prestation","quantity":1}]'::jsonb,
          '2026-11-01T10:00:00Z'::timestamptz,
          'phase0-create-order-catalog-mismatch'
        )
      `
    );
  }, /références catalogue.*incohérentes/i);

  await expectFailure('un agent atelier ne peut pas créer une commande au comptoir', async () => {
    await queryAs(
      users.workshopA2,
      `
        select id
        from public.create_order(
          '20000000-0000-4000-8000-000000000002'::uuid,
          '40000000-0000-4000-8000-000000000003'::uuid,
          '[{"legacyKey":"chemise","quantity":1}]'::jsonb,
          '2026-11-01T10:00:00Z'::timestamptz,
          'phase0-create-order-workshop-denied'
        )
      `
    );
  }, /agence introuvable ou inaccessible/i);

  await expectFailure('create_order refuse une cliente d’une autre organisation', async () => {
    await queryAs(
      users.cashierA1,
      `
        select id
        from public.create_order(
          '20000000-0000-4000-8000-000000000001'::uuid,
          '40000000-0000-4000-8000-000000000002'::uuid,
          '[{"legacyKey":"chemise","quantity":1}]'::jsonb,
          '2026-11-01T10:00:00Z'::timestamptz,
          'phase0-create-order-wrong-customer'
        )
      `
    );
  }, /cliente introuvable/i);

  await expectFailure('anon ne peut pas exécuter create_order', async () => {
    await asRole('anon', null, () =>
      db.query(`
        select id
        from public.create_order(
          '20000000-0000-4000-8000-000000000001'::uuid,
          '40000000-0000-4000-8000-000000000001'::uuid,
          '[{"legacyKey":"chemise","quantity":1}]'::jsonb,
          '2026-11-01T10:00:00Z'::timestamptz,
          'phase0-create-order-anon-denied'
        )
      `)
    );
  }, /permission denied/i);

  await check('record_order_payment écrit le journal et recalcule commande et cliente', async () => {
    const payment = await queryAs(
      users.cashierA1,
      `
        select id, amount_xof::int, method, provider, status
        from public.record_order_payment(
          $1::uuid,
          400,
          'mobile_money',
          'wave',
          'phase0-payment-001',
          'WAVE-TEST-001'
        )
      `,
      [createdOrderId]
    );
    createdPaymentId = payment.rows[0].id;
    assert.deepEqual(payment.rows[0], {
      id: createdPaymentId,
      amount_xof: 400,
      method: 'mobile_money',
      provider: 'wave',
      status: 'confirmed',
    });

    const order = await db.query(
      'select deposit_paid_xof::int, remaining_balance_xof::int from public.orders where id = $1',
      [createdOrderId]
    );
    assert.deepEqual(order.rows[0], {
      deposit_paid_xof: 400,
      remaining_balance_xof: 550,
    });

    const customer = await db.query(
      "select deposits_count, balance_xof::int from public.customers where id = '40000000-0000-4000-8000-000000000001'"
    );
    assert.deepEqual(customer.rows[0], {
      deposits_count: 2,
      balance_xof: 2050,
    });
  });

  await check('record_order_payment est idempotent et ne double pas l’encaissement', async () => {
    const repeated = await queryAs(
      users.cashierA1,
      `
        select id
        from public.record_order_payment(
          $1::uuid,
          400,
          'mobile_money',
          'wave',
          'phase0-payment-001',
          'WAVE-TEST-001'
        )
      `,
      [createdOrderId]
    );
    const count = await db.query(
      "select count(*)::int as count from public.payments where idempotency_key = 'phase0-payment-001'"
    );
    const order = await db.query(
      'select deposit_paid_xof::int from public.orders where id = $1',
      [createdOrderId]
    );
    assert.equal(repeated.rows[0].id, createdPaymentId);
    assert.equal(count.rows[0].count, 1);
    assert.equal(order.rows[0].deposit_paid_xof, 400);
  });

  await expectFailure('record_order_payment refuse un encaissement supérieur au total', async () => {
    await queryAs(
      users.cashierA1,
      `
        select id
        from public.record_order_payment(
          $1::uuid,
          551,
          'cash',
          'cash',
          'phase0-payment-overpay'
        )
      `,
      [createdOrderId]
    );
  }, /dépasserait le total/i);

  await expectFailure('record_order_payment rejette des métadonnées arbitraires du navigateur', async () => {
    await queryAs(
      users.cashierA1,
      `
        select id
        from public.record_order_payment(
          $1::uuid,
          1,
          'cash',
          'cash',
          'phase0-payment-metadata-denied',
          null,
          '{"secret":"ne-pas-stocker"}'::jsonb
        )
      `,
      [createdOrderId]
    );
  }, /métadonnées de paiement non autorisées/i);

  await expectFailure('un agent atelier ne peut pas enregistrer un paiement', async () => {
    await queryAs(
      users.workshopA2,
      `
        select id
        from public.record_order_payment(
          '50000000-0000-4000-8000-000000000002'::uuid,
          100,
          'cash',
          'cash',
          'phase0-payment-workshop-denied'
        )
      `
    );
  }, /commande introuvable ou inaccessible/i);

  await expectFailure('le journal de paiements refuse un INSERT direct', async () => {
    await queryAs(
      users.cashierA1,
      `
        insert into public.payments (
          organization_id, shop_id, order_id, amount_xof,
          method, provider, idempotency_key, confirmed_at
        ) values (
          '10000000-0000-4000-8000-000000000001',
          '20000000-0000-4000-8000-000000000001',
          $1,
          100,
          'cash',
          'cash',
          'phase0-payment-direct-insert',
          now()
        )
      `,
      [createdOrderId]
    );
  }, /permission denied/i);

  await expectFailure('un UPDATE direct ne peut plus modifier l’acompte d’une commande', async () => {
    await queryAs(
      users.cashierA1,
      'update public.orders set deposit_paid_xof = 950 where id = $1',
      [createdOrderId]
    );
  }, /permission denied/i);

  await check('les clientes ne voient que les paiements de leurs commandes liées', async () => {
    const own = await queryAs(
      users.sharedCustomer,
      'select id from public.payments where id = $1',
      [createdPaymentId]
    );
    const other = await queryAs(
      users.otherCustomer,
      'select id from public.payments where id = $1',
      [createdPaymentId]
    );
    assert.equal(own.rows.length, 1);
    assert.equal(other.rows.length, 0);
  });

  await expectFailure('un caissier ne peut pas rembourser sans rôle de responsable', async () => {
    await queryAs(
      users.cashierA1,
      `
        select id
        from public.refund_order_payment(
          $1::uuid,
          100,
          'phase0-refund-cashier-denied',
          'Remboursement fictif refusé',
          'WAVE-REF-DENIED'
        )
      `,
      [createdPaymentId]
    );
  }, /remboursement non autorisé/i);

  await check('refund_order_payment crée une contre-écriture et recalcule les soldes', async () => {
    const refund = await queryAs(
      users.ownerA,
      `
        select id, amount_xof::int, kind, reverses_payment_id
        from public.refund_order_payment(
          $1::uuid,
          100,
          'phase0-refund-001',
          'Remboursement fictif partiel',
          'WAVE-REF-001'
        )
      `,
      [createdPaymentId]
    );
    assert.equal(refund.rows[0].amount_xof, 100);
    assert.equal(refund.rows[0].kind, 'refund');
    assert.equal(refund.rows[0].reverses_payment_id, createdPaymentId);

    const order = await db.query(
      'select deposit_paid_xof::int, remaining_balance_xof::int from public.orders where id = $1',
      [createdOrderId]
    );
    assert.deepEqual(order.rows[0], {
      deposit_paid_xof: 300,
      remaining_balance_xof: 650,
    });

    const customer = await db.query(
      "select balance_xof::int from public.customers where id = '40000000-0000-4000-8000-000000000001'"
    );
    assert.equal(customer.rows[0].balance_xof, 2150);
  });

  await expectFailure('refund_order_payment refuse un remboursement supérieur au paiement initial', async () => {
    await queryAs(
      users.ownerA,
      `
        select id
        from public.refund_order_payment(
          $1::uuid,
          301,
          'phase0-refund-too-much',
          'Remboursement fictif excessif',
          'WAVE-REF-TOO-MUCH'
        )
      `,
      [createdPaymentId]
    );
  }, /dépasserait le montant du paiement initial/i);

  await check('les totaux de caisse distinguent brut, remboursements et net par fournisseur', async () => {
    const result = await queryAs(
      users.cashierA1,
      `
        select public.get_payment_totals(
          '20000000-0000-4000-8000-000000000001'::uuid,
          (now() at time zone 'Africa/Abidjan')::date
        ) as totals
      `
    );
    const rawTotals = result.rows[0].totals;
    const totals = typeof rawTotals === 'string' ? JSON.parse(rawTotals) : rawTotals;
    const wave = totals.rows.find((row) => row.provider === 'wave');
    assert.equal(totals.gross_xof, 400);
    assert.equal(totals.refunds_xof, 100);
    assert.equal(totals.net_xof, 300);
    assert.deepEqual(wave, {
      method: 'mobile_money',
      provider: 'wave',
      gross_xof: 400,
      refunds_xof: 100,
      net_xof: 300,
    });
  });

  await check('l’inscription e-mail conserve le nom et le téléphone déclaré dans le profil', async () => {
    await db.query(`
      insert into auth.users (id, email, phone, raw_user_meta_data)
      values (
        '00000000-0000-4000-8000-000000000401',
        'nouvelle.cliente@example.invalid',
        null,
        '{"full_name":"Nouvelle Cliente","phone_e164":"+2250700000401","account_type":"customer"}'::jsonb
      )
    `);

    const profile = await db.query(`
      select display_name, phone_e164
      from public.profiles
      where user_id = '00000000-0000-4000-8000-000000000401'
    `);
    assert.deepEqual(profile.rows[0], {
      display_name: 'Nouvelle Cliente',
      phone_e164: '+2250700000401',
    });
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

  let onboardedShopId;
  await check('create_my_organization crée organisation, agence, propriétaire, paramètres, compteur et catalogue', async () => {
    const created = await queryAs(
      users.newOwner,
      `
        select
          x.result ->> 'organization_id' as organization_id,
          x.result ->> 'organization_slug' as organization_slug,
          x.result ->> 'shop_id' as shop_id,
          (x.result ->> 'catalog_seeded_items')::int as seeded
        from (
          select public.create_my_organization(
            'Pressing Gamma Fictif',
            'Gamma Treichville',
            'Abidjan',
            'Rue fictive 40',
            '+225 07 00 00 04 01',
            null,
            'Propre et rapide',
            1500,
            2000,
            true
          ) as result
        ) x
      `
    );
    assert.equal(created.rows[0].organization_slug, 'pressing-gamma-fictif');
    assert.equal(created.rows[0].seeded, 32);
    onboardedShopId = created.rows[0].shop_id;

    const membership = await db.query(
      'select role, status, shop_id from public.memberships where user_id = $1',
      [users.newOwner]
    );
    assert.deepEqual(membership.rows, [
      { role: 'organization_owner', status: 'active', shop_id: null },
    ]);

    const settings = await db.query(
      'select pickup_fee_xof::int, delivery_fee_xof::int, tagline from public.shop_settings where shop_id = $1',
      [onboardedShopId]
    );
    assert.deepEqual(settings.rows[0], {
      pickup_fee_xof: 1500,
      delivery_fee_xof: 2000,
      tagline: 'Propre et rapide',
    });

    const counter = await db.query(
      'select next_number::int from public.ticket_counters where shop_id = $1',
      [onboardedShopId]
    );
    assert.equal(counter.rows[0].next_number, 1);

    const catalog = await db.query(
      'select count(*)::int as count from public.service_catalog_items where shop_id = $1',
      [onboardedShopId]
    );
    assert.equal(catalog.rows[0].count, 32);

    const visibleShops = await queryAs(
      users.newOwner,
      'select id from public.shops order by id'
    );
    assert.equal(visibleShops.rows.length, 1);
    assert.equal(visibleShops.rows[0].id, onboardedShopId);
  });

  await expectFailure('create_my_organization refuse un second rattachement du même compte', async () => {
    await queryAs(
      users.newOwner,
      "select public.create_my_organization('Seconde Organisation Fictive', 'Agence Bis')"
    );
  }, /déjà rattaché/i);

  await check('create_my_organization déduplique les slugs et peut démarrer sans catalogue', async () => {
    const created = await queryAs(
      users.newOwnerBis,
      `
        select
          x.result ->> 'organization_slug' as organization_slug,
          x.result ->> 'shop_id' as shop_id,
          (x.result ->> 'catalog_seeded_items')::int as seeded
        from (
          select public.create_my_organization(
            'Pressing Gamma Fictif', 'Gamma Cocody', null, null, null, null, '', 1000, 1000, false
          ) as result
        ) x
      `
    );
    assert.equal(created.rows[0].organization_slug, 'pressing-gamma-fictif-2');
    assert.equal(created.rows[0].seeded, 0);

    const catalog = await db.query(
      'select count(*)::int as count from public.service_catalog_items where shop_id = $1',
      [created.rows[0].shop_id]
    );
    assert.equal(catalog.rows[0].count, 0);
  });

  await expectFailure('un membre actif existant ne peut pas utiliser l’onboarding', async () => {
    await queryAs(
      users.ownerA,
      "select public.create_my_organization('Organisation Concurrente Fictive', 'Agence Concurrente')"
    );
  }, /déjà rattaché/i);

  await expectFailure('create_my_organization valide le nom de l’organisation', async () => {
    await queryAs(
      users.sharedCustomer,
      "select public.create_my_organization('X', 'Agence Fictive')"
    );
  }, /nom de l’organisation/i);

  await expectFailure('anon ne peut pas exécuter create_my_organization', async () => {
    await asRole('anon', null, () =>
      db.query("select public.create_my_organization('Anon Fictif', 'Anon Agence')")
    );
  }, /permission denied/i);

  await check('le propriétaire enregistre l’instantané des paramètres et l’horodatage serveur est posé', async () => {
    const before = await db.query(
      `select settings, settings_updated_at
         from public.shop_settings
        where shop_id = '20000000-0000-4000-8000-000000000001'`
    );
    assert.deepEqual(before.rows[0].settings, {});

    const updated = await queryAs(
      users.ownerA,
      `update public.shop_settings
          set settings = '{"name":"Alpha Cocody","pickupFee":1500}'::jsonb,
              pickup_fee_xof = 1500
        where shop_id = '20000000-0000-4000-8000-000000000001'
        returning settings, pickup_fee_xof::int as pickup_fee, settings_updated_at`
    );
    assert.equal(updated.rows.length, 1);
    assert.equal(updated.rows[0].settings.name, 'Alpha Cocody');
    assert.equal(updated.rows[0].pickup_fee, 1500);
    assert.ok(
      new Date(updated.rows[0].settings_updated_at).getTime() >=
        new Date(before.rows[0].settings_updated_at).getTime()
    );
  });

  await check('un caissier ne peut pas enregistrer les paramètres de l’agence', async () => {
    const attempted = await queryAs(
      users.cashierA1,
      `update public.shop_settings
          set settings = '{"name":"Caisse pirate"}'::jsonb
        where shop_id = '20000000-0000-4000-8000-000000000001'
        returning shop_id`
    );
    assert.equal(attempted.rows.length, 0);

    const unchanged = await db.query(
      `select settings from public.shop_settings
        where shop_id = '20000000-0000-4000-8000-000000000001'`
    );
    assert.equal(unchanged.rows[0].settings.name, 'Alpha Cocody');
  });

  await check('le propriétaire crée un casier, toute l’agence le lit', async () => {
    const inserted = await queryAs(
      users.ownerA,
      `insert into public.storage_locations
         (organization_id, shop_id, legacy_id, code, label, zone, capacity_packages, is_active)
       values
         ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
          'loc-c01', 'C-01', 'Portant C-01', 'hanging', 20, true)
       returning id, code, label`
    );
    assert.equal(inserted.rows.length, 1);
    assert.equal(inserted.rows[0].code, 'C-01');

    const readByCashier = await queryAs(
      users.cashierA1,
      `select code from public.storage_locations
        where shop_id = '20000000-0000-4000-8000-000000000001'`
    );
    // A-01 vient des fixtures : le caissier voit tout le plan de l’agence.
    assert.deepEqual(idsOf(readByCashier.rows, 'code'), ['A-01', 'C-01']);
  });

  await check('un caissier ne peut pas modifier un casier', async () => {
    const attempted = await queryAs(
      users.cashierA1,
      `update public.storage_locations
          set label = 'Caisse pirate'
        where code = 'C-01'
          and shop_id = '20000000-0000-4000-8000-000000000001'
        returning id`
    );
    assert.equal(attempted.rows.length, 0);

    const unchanged = await db.query(
      `select label from public.storage_locations
        where code = 'C-01'
          and shop_id = '20000000-0000-4000-8000-000000000001'`
    );
    assert.equal(unchanged.rows[0].label, 'Portant C-01');
  });

  await expectFailure('un caissier ne peut pas créer de casier', async () => {
    await queryAs(
      users.cashierA1,
      `insert into public.storage_locations
         (organization_id, shop_id, code, label, zone, capacity_packages)
       values
         ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
          'B-99', 'Casier pirate', 'other', 5)`
    );
  }, /row-level security|politique/i);

  await check('les casiers d’une autre agence restent invisibles', async () => {
    const otherShop = await queryAs(
      users.ownerB,
      `select id from public.storage_locations
        where shop_id = '20000000-0000-4000-8000-000000000001'`
    );
    assert.equal(otherShop.rows.length, 0);
  });

  await expectFailure('un casier ne peut pas être supprimé, seulement désactivé', async () => {
    await queryAs(
      users.ownerA,
      `delete from public.storage_locations
        where shop_id = '20000000-0000-4000-8000-000000000001'`
    );
  }, /permission denied|row-level security|politique/i);

  await check('le propriétaire désactive un casier sans perdre l’historique', async () => {
    const deactivated = await queryAs(
      users.ownerA,
      `update public.storage_locations
          set is_active = false
        where code = 'C-01'
          and shop_id = '20000000-0000-4000-8000-000000000001'
        returning is_active`
    );
    assert.equal(deactivated.rows.length, 1);
    assert.equal(deactivated.rows[0].is_active, false);
  });

  console.log(`\nPhase 0 PGlite : ${passed} vérifications réussies.`);
} catch (error) {
  console.error(`\nÉchec Phase 0 PGlite : ${error?.message ?? error}`);
  if (error?.detail) console.error(`Détail PostgreSQL : ${error.detail}`);
  if (error?.hint) console.error(`Indice PostgreSQL : ${error.hint}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
