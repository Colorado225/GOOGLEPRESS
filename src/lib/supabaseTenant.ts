import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { supabase } from './supabase';

type Client = SupabaseClient<Database>;

export interface CreateMyOrganizationInput {
  organizationName: string;
  shopName: string;
  city?: string | null;
  address?: string | null;
  phoneDisplay?: string | null;
  shopEmail?: string | null;
  tagline?: string;
  pickupFeeXof: number;
  deliveryFeeXof: number;
  seedCatalog: boolean;
}

export interface CreatedOrganization {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  catalogSeededItems: number;
}

const requireSupabaseClient = (client?: Client | null): Client => {
  const resolved = client ?? supabase;
  if (!resolved) {
    throw new Error('Supabase n’est pas configuré dans cet environnement.');
  }
  return resolved;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Réponse d’onboarding Supabase invalide : champ ${key}.`);
  }
  return value;
};

const readCount = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Réponse d’onboarding Supabase invalide : compteur ${key}.`);
  }
  return value;
};

/**
 * Crée l'organisation et la première agence du compte connecté via la RPC
 * `create_my_organization`. Le serveur impose : aucun rattachement actif
 * préexistant, rôle propriétaire pour l'appelant uniquement, slugs générés
 * et dédupliqués côté PostgreSQL. Le navigateur ne choisit ni identifiants
 * ni rôle.
 */
export async function createMyOrganization(
  input: CreateMyOrganizationInput,
  client?: Client | null
): Promise<CreatedOrganization> {
  const resolved = requireSupabaseClient(client);

  const { data, error } = await resolved.rpc('create_my_organization', {
    p_organization_name: input.organizationName.trim(),
    p_shop_name: input.shopName.trim(),
    p_city: input.city?.trim() || null,
    p_address: input.address?.trim() || null,
    p_phone_display: input.phoneDisplay?.trim() || null,
    p_shop_email: input.shopEmail?.trim().toLowerCase() || null,
    p_tagline: input.tagline?.trim() ?? '',
    p_pickup_fee_xof: input.pickupFeeXof,
    p_delivery_fee_xof: input.deliveryFeeXof,
    p_seed_catalog: input.seedCatalog,
  });

  if (error) throw new Error(error.message);
  const raw: unknown = data;
  if (!isRecord(raw)) {
    throw new Error('La RPC d’onboarding n’a renvoyé aucune organisation.');
  }

  return {
    organizationId: readString(raw, 'organization_id'),
    organizationName: readString(raw, 'organization_name'),
    organizationSlug: readString(raw, 'organization_slug'),
    shopId: readString(raw, 'shop_id'),
    shopName: readString(raw, 'shop_name'),
    shopSlug: readString(raw, 'shop_slug'),
    catalogSeededItems: readCount(raw, 'catalog_seeded_items'),
  };
}
