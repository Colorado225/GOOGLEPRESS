import type { StorageLocation, StorageZone } from '../types';
import { getSupabaseClient } from './supabase';
import { describeShopSettingsSyncError } from './shopSettingsSync';

/**
 * Emplacements de rangement (casiers) dans la base.
 *
 * Le plan physique du pressing est une configuration : il doit survivre à un
 * changement de téléphone et se retrouver identique sur le poste du comptoir.
 * Il vit dans `public.storage_locations`, avec `legacy_id` qui porte
 * l'identifiant local existant (aucune réécriture des commandes déjà rangées).
 *
 * Aucune suppression n'est possible par l'API : retirer un casier le désactive
 * (`is_active = false`), ce qui préserve l'historique des commandes qui y sont
 * passées.
 */

type Client = NonNullable<ReturnType<typeof getSupabaseClient>>;

export type StorageSyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export interface StorageSyncState {
  status: StorageSyncStatus;
  error: string | null;
  savedAt: string | null;
}

const STORAGE_ZONES: StorageZone[] = ['hanging', 'folded', 'delivery', 'bulky', 'hold', 'other'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

const readNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const readZone = (value: unknown): StorageZone =>
  STORAGE_ZONES.includes(value as StorageZone) ? (value as StorageZone) : 'other';

export interface RemoteStorageLocationRow {
  id: string;
  legacyId: string | null;
  code: string;
  label: string;
  zone: StorageZone;
  capacityPackages: number;
  description?: string;
  isActive: boolean;
}

/** Ligne Supabase → emplacement de l'application. */
export const rowToStorageLocation = (row: unknown): RemoteStorageLocationRow | null => {
  if (!isRecord(row) || typeof row.id !== 'string') return null;
  const code = readString(row.code);
  if (!code) return null;
  return {
    id: row.id,
    legacyId: readString(row.legacy_id),
    code,
    label: readString(row.label) ?? code,
    zone: readZone(row.zone),
    capacityPackages: Math.max(1, Math.round(readNumber(row.capacity_packages, 1))),
    description: readString(row.description) ?? undefined,
    isActive: row.is_active !== false,
  };
};

export const rowToLocalStorageLocation = (row: RemoteStorageLocationRow): StorageLocation => ({
  id: row.legacyId ?? row.id,
  code: row.code,
  label: row.label,
  zone: row.zone,
  capacityPackages: row.capacityPackages,
  description: row.description,
  isActive: row.isActive,
});

export interface StorageLocationSyncPlan {
  toInsert: StorageLocation[];
  toUpdate: { dbId: string; location: StorageLocation }[];
  /** Casiers retirés localement : désactivés en base, jamais supprimés. */
  toDeactivate: string[];
}

// La base impose un code en majuscules : on compare et on écrit normalisé pour
// éviter une boucle de réécritures inutiles.
const normalizeCode = (code: string) => code.trim().toUpperCase();

const sameLocation = (location: StorageLocation, row: RemoteStorageLocationRow): boolean =>
  normalizeCode(location.code) === normalizeCode(row.code) &&
  location.label === row.label &&
  location.zone === row.zone &&
  location.capacityPackages === row.capacityPackages &&
  (location.description?.trim() ?? '') === (row.description?.trim() ?? '') &&
  location.isActive === row.isActive;

/**
 * Compare le plan local et les lignes serveur.
 *
 * L'appariement se fait par `legacy_id` puis, à défaut, par code : une ligne
 * créée à la main dans l'éditeur SQL n'est pas dupliquée.
 */
export const planStorageLocationSync = (
  local: readonly StorageLocation[],
  remote: readonly RemoteStorageLocationRow[]
): StorageLocationSyncPlan => {
  const byLegacyId = new Map<string, RemoteStorageLocationRow>();
  const byCode = new Map<string, RemoteStorageLocationRow>();
  for (const row of remote) {
    if (row.legacyId) byLegacyId.set(row.legacyId, row);
    byCode.set(normalizeCode(row.code), row);
  }

  const matched = new Set<string>();
  const plan: StorageLocationSyncPlan = { toInsert: [], toUpdate: [], toDeactivate: [] };

  for (const location of local) {
    const row =
      byLegacyId.get(location.id) ?? byCode.get(normalizeCode(location.code));
    if (!row) {
      plan.toInsert.push(location);
      continue;
    }
    matched.add(row.id);
    if (!sameLocation(location, row)) {
      plan.toUpdate.push({ dbId: row.id, location });
    }
  }

  for (const row of remote) {
    if (matched.has(row.id)) continue;
    if (row.isActive) plan.toDeactivate.push(row.id);
  }

  return plan;
};

const locationPayload = (location: StorageLocation) => ({
  code: normalizeCode(location.code),
  label: location.label.trim() || normalizeCode(location.code),
  zone: location.zone,
  capacity_packages: Math.max(1, Math.round(location.capacityPackages)),
  description: location.description?.trim() || null,
  is_active: location.isActive,
});

export const loadRemoteStorageLocations = async (
  shopId: string,
  base: readonly StorageLocation[],
  client: Client | null = getSupabaseClient()
): Promise<
  | { ok: true; locations: StorageLocation[]; seeded: boolean }
  | { ok: false; error: string }
> => {
  if (!client) return { ok: false, error: 'Supabase n’est pas configuré sur cet appareil.' };
  try {
    const { data, error } = await client
      .from('storage_locations')
      .select('*')
      .eq('shop_id', shopId)
      .order('code', { ascending: true });
    if (error) return { ok: false, error: describeShopSettingsSyncError(error) };

    const rows = (data ?? [])
      .map(rowToStorageLocation)
      .filter((row): row is RemoteStorageLocationRow => row !== null);
    if (rows.length === 0) {
      // Première synchronisation : le plan local devient le plan de l'agence.
      return { ok: true, locations: [...base], seeded: true };
    }
    return {
      ok: true,
      locations: rows.map(rowToLocalStorageLocation).sort((a, b) => a.code.localeCompare(b.code, 'fr')),
      seeded: false,
    };
  } catch (error: unknown) {
    return { ok: false, error: describeShopSettingsSyncError(error) };
  }
};

/** Écrit les écarts : créations, modifications, désactivations. */
export const saveRemoteStorageLocations = async (input: {
  shopId: string;
  organizationId: string;
  locations: readonly StorageLocation[];
  client?: Client | null;
}): Promise<{ ok: true } | { ok: false; error: string }> => {
  const client = input.client ?? getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase n’est pas configuré sur cet appareil.' };

  try {
    const { data, error } = await client
      .from('storage_locations')
      .select('*')
      .eq('shop_id', input.shopId);
    if (error) return { ok: false, error: describeShopSettingsSyncError(error) };

    const remote = (data ?? [])
      .map(rowToStorageLocation)
      .filter((row): row is RemoteStorageLocationRow => row !== null);
    const plan = planStorageLocationSync(input.locations, remote);

    for (const location of plan.toInsert) {
      const { error: insertError } = await client.from('storage_locations').insert({
        shop_id: input.shopId,
        organization_id: input.organizationId,
        legacy_id: location.id,
        ...locationPayload(location),
      });
      if (insertError) return { ok: false, error: describeShopSettingsSyncError(insertError) };
    }

    for (const entry of plan.toUpdate) {
      const { error: updateError } = await client
        .from('storage_locations')
        .update(locationPayload(entry.location))
        .eq('id', entry.dbId);
      if (updateError) return { ok: false, error: describeShopSettingsSyncError(updateError) };
    }

    for (const dbId of plan.toDeactivate) {
      const { error: deactivateError } = await client
        .from('storage_locations')
        .update({ is_active: false })
        .eq('id', dbId);
      if (deactivateError) {
        return { ok: false, error: describeShopSettingsSyncError(deactivateError) };
      }
    }

    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: describeShopSettingsSyncError(error) };
  }
};
