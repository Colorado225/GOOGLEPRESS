import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database, Tables } from './database.types';
import { getMetadataString, normalizePhoneToE164 } from './customerAuth';
import { supabase } from './supabase';
import { updateOrInsert } from './supabaseWrite';

type Client = SupabaseClient<Database>;

export type CustomerProfile = Tables<'profiles'>;
export type CustomerAccountLink = Tables<'customer_account_links'>;
export type LinkedCustomer = Pick<
  Tables<'customers'>,
  | 'id'
  | 'organization_id'
  | 'full_name'
  | 'phone_display'
  | 'phone_e164'
  | 'address'
  | 'balance_xof'
  | 'deposits_count'
  | 'loyalty_discount_percent'
  | 'is_vip'
>;
export type LinkedOrganization = Pick<
  Tables<'organizations'>,
  'id' | 'name' | 'slug' | 'status'
>;

const requireSupabaseClient = (client?: Client | null): Client => {
  const resolved = client ?? supabase;
  if (!resolved) {
    throw new Error('Supabase n’est pas configuré dans cet environnement.');
  }
  return resolved;
};

/**
 * Recopie dans `profiles` le nom et le téléphone déclarés à l'inscription.
 * Le téléphone reste une coordonnée déclarée : seule la liaison créée après
 * contrôle par le pressing donne accès aux commandes d'une fiche client.
 */
export async function syncCustomerProfile(
  user: User,
  client?: Client | null
): Promise<void> {
  const resolved = requireSupabaseClient(client);
  const displayName = getMetadataString(user.user_metadata, ['full_name', 'name']);
  const metadataPhone = getMetadataString(user.user_metadata, ['phone_e164', 'phone']);
  const authPhone = user.phone ? normalizePhoneToE164(user.phone) : null;
  const phone = authPhone || (metadataPhone ? normalizePhoneToE164(metadataPhone) : null);
  const existingProfile = await getCustomerProfile(user.id, resolved);

  const payload: {
    user_id: string;
    display_name?: string | null;
    phone_e164?: string | null;
  } = { user_id: user.id };
  // Compléter les champs encore absents sans écraser une correction déjà
  // enregistrée dans le profil (par la cliente ou par le pressing).
  if (displayName && !existingProfile?.display_name) payload.display_name = displayName;
  if (phone && !existingProfile?.phone_e164) payload.phone_e164 = phone;
  if (existingProfile && !payload.display_name && !payload.phone_e164) return;

  // Pas d'upsert : la table n'accorde que des droits par colonne et `user_id`
  // n'est pas modifiable (voir `supabaseWrite.ts`).
  const { user_id: userId, ...profilePatch } = payload;
  const written = await updateOrInsert<{ user_id: string }>({
    update: () =>
      resolved
        .from('profiles')
        .update(profilePatch)
        .eq('user_id', userId)
        .select('user_id')
        .maybeSingle(),
    insert: () =>
      resolved
        .from('profiles')
        .insert(payload)
        .select('user_id')
        .maybeSingle(),
  });

  if (!written.ok) {
    throw new Error(
      typeof written.error === 'object' && written.error !== null && 'message' in written.error
        ? String((written.error as { message?: unknown }).message)
        : 'Profil client non enregistré.'
    );
  }
}

export async function getCustomerProfile(
  userId: string,
  client?: Client | null
): Promise<CustomerProfile | null> {
  const resolved = requireSupabaseClient(client);
  const { data, error } = await resolved
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateCustomerProfile(
  input: { userId: string; displayName: string; phoneE164: string },
  client?: Client | null
): Promise<CustomerProfile> {
  const resolved = requireSupabaseClient(client);
  const patch = {
    display_name: input.displayName.trim().replace(/\s+/g, ' '),
    phone_e164: input.phoneE164,
  };
  const written = await updateOrInsert<CustomerProfile>({
    update: () =>
      resolved
        .from('profiles')
        .update(patch)
        .eq('user_id', input.userId)
        .select('*')
        .maybeSingle(),
    insert: () =>
      resolved
        .from('profiles')
        .insert({ user_id: input.userId, ...patch })
        .select('*')
        .maybeSingle(),
  });

  if (!written.ok) {
    throw new Error(
      typeof written.error === 'object' && written.error !== null && 'message' in written.error
        ? String((written.error as { message?: unknown }).message)
        : 'Profil client non enregistré.'
    );
  }
  const data = written.row;

  // Garder les métadonnées Auth cohérentes pour les prochaines connexions.
  const { error: userError } = await resolved.auth.updateUser({
    data: {
      full_name: input.displayName.trim().replace(/\s+/g, ' '),
      phone_e164: input.phoneE164,
      account_type: 'customer',
    },
  });
  if (userError) throw new Error(userError.message);

  return data;
}

export async function listCustomerAccountLinks(
  userId: string,
  client?: Client | null
): Promise<CustomerAccountLink[]> {
  const resolved = requireSupabaseClient(client);
  const { data, error } = await resolved
    .from('customer_account_links')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listLinkedCustomers(
  customerIds: readonly string[],
  client?: Client | null
): Promise<LinkedCustomer[]> {
  if (customerIds.length === 0) return [];
  const resolved = requireSupabaseClient(client);
  const { data, error } = await resolved
    .from('customers')
    .select(
      'id, organization_id, full_name, phone_display, phone_e164, address, balance_xof, deposits_count, loyalty_discount_percent, is_vip'
    )
    .in('id', [...customerIds])
    .order('full_name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listLinkedOrganizations(
  organizationIds: readonly string[],
  client?: Client | null
): Promise<LinkedOrganization[]> {
  if (organizationIds.length === 0) return [];
  const resolved = requireSupabaseClient(client);
  const { data, error } = await resolved
    .from('organizations')
    .select('id, name, slug, status')
    .in('id', [...organizationIds])
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
