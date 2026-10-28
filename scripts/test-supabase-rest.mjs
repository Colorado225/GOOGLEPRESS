import { createClient } from '@supabase/supabase-js';

/**
 * Test Auth/PostgREST réel contre un projet Supabase hébergé.
 *
 * Variables requises :
 * - SUPABASE_URL ou VITE_SUPABASE_URL
 * - SUPABASE_ANON_KEY ou VITE_SUPABASE_ANON_KEY (clé publique uniquement)
 *
 * Comptes de validation optionnels mais recommandés :
 * - TEST_OWNER_A_EMAIL / TEST_OWNER_A_PASSWORD
 * - TEST_OWNER_B_EMAIL / TEST_OWNER_B_PASSWORD
 * - TEST_CUSTOMER_EMAIL / TEST_CUSTOMER_PASSWORD
 *
 * Assertions d'isolation optionnelles :
 * - EXPECTED_OWNER_A_SHOP_ID / FORBIDDEN_OWNER_A_SHOP_ID
 * - EXPECTED_OWNER_B_SHOP_ID / FORBIDDEN_OWNER_B_SHOP_ID
 *
 * Aucun mot de passe ni jeton n'est affiché.
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error(
    'Variables manquantes : définissez SUPABASE_URL et SUPABASE_ANON_KEY (ou leurs variantes VITE_).'
  );
  process.exit(2);
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

const fail = (message) => {
  throw new Error(message);
};

async function probeAnonymous() {
  const client = createClient(supabaseUrl, anonKey, clientOptions);
  const { data, error } = await client.from('shops').select('id').limit(1);
  if (error) {
    console.log(`✓ anon : accès refusé (${error.code || 'erreur PostgREST'})`);
    return;
  }
  if ((data ?? []).length > 0) fail('anon ne devrait voir aucune agence.');
  console.log('✓ anon : aucune agence visible');
}

async function probeAccount({ label, email, password, expectedShopId, forbiddenShopId }) {
  if (!email || !password) {
    console.log(`- ${label} : ignoré (e-mail/mot de passe de test absents)`);
    return;
  }

  const client = createClient(supabaseUrl, anonKey, clientOptions);
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) fail(`${label} : connexion refusée (${signInError.message})`);
  const user = signInData.user;
  if (!user) fail(`${label} : session sans utilisateur.`);

  const shops = await client.from('shops').select('id, organization_id, name').order('name');
  if (shops.error) fail(`${label} : lecture des agences refusée (${shops.error.message})`);

  const orders = await client.from('orders').select('id', { count: 'exact', head: true });
  if (orders.error) fail(`${label} : comptage des commandes refusé (${orders.error.message})`);

  const visibleShopIds = new Set((shops.data ?? []).map((shop) => shop.id));
  if (expectedShopId && !visibleShopIds.has(expectedShopId)) {
    fail(`${label} : agence attendue non visible (${expectedShopId}).`);
  }
  if (forbiddenShopId && visibleShopIds.has(forbiddenShopId)) {
    fail(`${label} : agence d’un autre tenant visible (${forbiddenShopId}).`);
  }

  console.log(
    `✓ ${label} : utilisateur ${user.id}, agences visibles=${visibleShopIds.size}, commandes visibles=${orders.count ?? 0}`
  );
  await client.auth.signOut();
}

await probeAnonymous();
await probeAccount({
  label: 'propriétaire A',
  email: process.env.TEST_OWNER_A_EMAIL,
  password: process.env.TEST_OWNER_A_PASSWORD,
  expectedShopId: process.env.EXPECTED_OWNER_A_SHOP_ID,
  forbiddenShopId: process.env.FORBIDDEN_OWNER_A_SHOP_ID,
});
await probeAccount({
  label: 'propriétaire B',
  email: process.env.TEST_OWNER_B_EMAIL,
  password: process.env.TEST_OWNER_B_PASSWORD,
  expectedShopId: process.env.EXPECTED_OWNER_B_SHOP_ID,
  forbiddenShopId: process.env.FORBIDDEN_OWNER_B_SHOP_ID,
});
await probeAccount({
  label: 'cliente liée',
  email: process.env.TEST_CUSTOMER_EMAIL,
  password: process.env.TEST_CUSTOMER_PASSWORD,
});

console.log('Tests Auth/PostgREST terminés.');
