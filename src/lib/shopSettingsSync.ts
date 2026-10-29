import type { ShopSettings } from '../types';
import type { Json } from './database.types';
import { getSupabaseClient } from './supabase';
import { mergeShopSettings } from './shopSettings';

/**
 * Enregistrement des paramètres dans la base.
 *
 * Le navigateur reste l'endroit où l'on travaille (l'écran Paramètres est
 * utilisable hors ligne), mais chaque enregistrement part vers
 * `public.shop_settings` dès qu'un compte réel est ouvert. Les colonnes
 * historiques sont écrites en parallèle de l'instantané JSON : les RPC qui
 * calculent les commandes continuent de lire `pickup_fee_xof`, etc.
 */

export type ShopSettingsSyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export interface ShopSettingsSyncState {
  status: ShopSettingsSyncStatus;
  /** Échec bloquant : rien n'a été enregistré sur le serveur. */
  error: string | null;
  /** Enregistrement réussi mais partiel (ex. identité de l'agence). */
  warning: string | null;
  /** Dernier horodatage serveur connu (ISO), `null` si jamais enregistré. */
  savedAt: string | null;
}

type Client = NonNullable<ReturnType<typeof getSupabaseClient>>;

export interface RemoteShopSettingsSnapshot {
  settings: Partial<ShopSettings>;
  updatedAt: string | null;
  /** `false` pour une ligne créée avant l'ajout de l'instantané JSON. */
  hasSnapshot: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const readNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const readBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

/**
 * Lit une ligne de `shop_settings`.
 *
 * Les colonnes dédiées servent de repli pour les lignes antérieures à
 * l'instantané JSON ; l'instantané, quand il existe, a la priorité.
 */
export const readRemoteShopSettings = (row: unknown): RemoteShopSettingsSnapshot | null => {
  if (!isRecord(row)) return null;

  const fromColumns: Partial<ShopSettings> = {
    tagline: readString(row.tagline),
    currency: readString(row.currency),
    enableSms: readBoolean(row.enable_sms),
    enableThermalPrinter: readBoolean(row.enable_thermal_printer),
    pickupFee: readNumber(row.pickup_fee_xof),
    deliveryFee: readNumber(row.delivery_fee_xof),
    storageAssignmentRequired: readBoolean(row.storage_assignment_required),
    storageAllowCapacityOverflow: readBoolean(row.storage_allow_capacity_overflow),
    storageSuggestionsEnabled: readBoolean(row.storage_suggestions_enabled),
    storageDefaultCapacityPackages: readNumber(row.storage_default_capacity_packages),
  };
  // Les clés absentes ne doivent pas écraser l'instantané.
  for (const key of Object.keys(fromColumns) as (keyof ShopSettings)[]) {
    if (fromColumns[key] === undefined) delete fromColumns[key];
  }

  const rawSettings = isRecord(row.settings) ? (row.settings as Partial<ShopSettings>) : {};
  const hasSnapshot = Object.keys(rawSettings).length > 0;

  return {
    settings: { ...fromColumns, ...rawSettings },
    updatedAt: readString(row.settings_updated_at) ?? null,
    hasSnapshot,
  };
};

/** Charge les paramètres de l'agence et les fusionne avec la base locale. */
export const loadRemoteShopSettings = async (
  shopId: string,
  base: ShopSettings,
  client: Client | null = getSupabaseClient()
): Promise<
  | { ok: true; settings: ShopSettings; updatedAt: string | null; hasSnapshot: boolean }
  | { ok: false; error: string }
> => {
  if (!client) return { ok: false, error: 'Supabase n’est pas configuré sur cet appareil.' };
  try {
    const { data, error } = await client
      .from('shop_settings')
      .select('*')
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) return { ok: false, error: describeShopSettingsSyncError(error) };
    const snapshot = readRemoteShopSettings(data);
    if (!snapshot) {
      return { ok: true, settings: base, updatedAt: null, hasSnapshot: false };
    }
    return {
      ok: true,
      settings: mergeShopSettings(base, snapshot.settings),
      updatedAt: snapshot.updatedAt,
      hasSnapshot: snapshot.hasSnapshot,
    };
  } catch (error: unknown) {
    return { ok: false, error: describeShopSettingsSyncError(error) };
  }
};

/** Ligne envoyée à Supabase : instantané complet + colonnes historiques. */
export const buildShopSettingsRow = (input: {
  shopId: string;
  organizationId: string;
  settings: ShopSettings;
}): Record<string, unknown> => {
  const { settings } = input;
  return {
    shop_id: input.shopId,
    organization_id: input.organizationId,
    tagline: settings.tagline,
    currency: settings.currency,
    enable_sms: settings.enableSms,
    enable_thermal_printer: settings.enableThermalPrinter,
    pickup_fee_xof: Math.max(0, Math.round(settings.pickupFee)),
    delivery_fee_xof: Math.max(0, Math.round(settings.deliveryFee)),
    storage_assignment_required: settings.storageAssignmentRequired,
    storage_allow_capacity_overflow: settings.storageAllowCapacityOverflow,
    storage_suggestions_enabled: settings.storageSuggestionsEnabled,
    storage_default_capacity_packages: settings.storageDefaultCapacityPackages,
    settings: settings as unknown as Json,
  };
};

/**
 * Enregistre les paramètres de l'agence.
 *
 * L'identité (nom, adresse, téléphone) vit sur `public.shops` : elle y est
 * mise à jour dans le même mouvement, pour que les documents, l'espace client
 * et la portée affichée dans l'ERP restent d'accord avec l'écran Paramètres.
 */
export const saveRemoteShopSettings = async (input: {
  shopId: string;
  organizationId: string;
  settings: ShopSettings;
  client?: Client | null;
}): Promise<{ ok: true; updatedAt: string | null; warning?: string } | { ok: false; error: string }> => {
  const client = input.client ?? getSupabaseClient();
  if (!client) return { ok: false, error: 'Supabase n’est pas configuré sur cet appareil.' };

  const payload = buildShopSettingsRow(input);

  try {
    let data: unknown = null;
    {
      const response = await client
        .from('shop_settings')
        .upsert(payload as never, { onConflict: 'shop_id' })
        .select('settings_updated_at')
        .maybeSingle();
      if (response.error && isMissingSettingsColumn(response.error)) {
        // Base pas encore migrée : on enregistre au moins ce que les colonnes
        // historiques savent porter, plutôt que de tout perdre.
        const { settings: _ignored, ...legacyPayload } = payload;
        const fallback = await client
          .from('shop_settings')
          .upsert(legacyPayload as never, { onConflict: 'shop_id' })
          .select('updated_at')
          .maybeSingle();
        if (fallback.error) {
          return { ok: false, error: describeShopSettingsSyncError(fallback.error) };
        }
        const legacyUpdatedAt =
          isRecord(fallback.data) && typeof fallback.data.updated_at === 'string'
            ? fallback.data.updated_at
            : null;
        return {
          ok: true,
          updatedAt: legacyUpdatedAt,
          warning:
            'La base n’a pas encore la colonne des paramètres : seuls les réglages historiques (tarifs, slogan, rangement) ont été enregistrés. Appliquez la migration 20261028180000 pour enregistrer le reste.',
        };
      }
      if (response.error) return { ok: false, error: describeShopSettingsSyncError(response.error) };
      data = response.data;
    }

    const updatedAt =
      isRecord(data) && typeof data.settings_updated_at === 'string'
        ? data.settings_updated_at
        : null;

    // Second temps : l'enseigne elle-même. Un échec ici ne perd pas les
    // paramètres déjà enregistrés, il est signalé sans bloquer l'écran.
    let warning: string | undefined;
    const { error: shopError } = await client
      .from('shops')
      .update({
        name: input.settings.name.trim() || 'Pressing',
        address: input.settings.address.trim() || null,
        phone_display: input.settings.phone.trim() || null,
      })
      .eq('id', input.shopId);
    if (shopError) {
      warning = `Paramètres enregistrés, mais l’identité de l’agence n’a pas pu l’être : ${describeShopSettingsSyncError(
        shopError
      )}`;
    }

    return { ok: true, updatedAt, warning };
  } catch (error: unknown) {
    return { ok: false, error: describeShopSettingsSyncError(error) };
  }
};

/** Message lisible pour l'écran Paramètres. */
export const describeShopSettingsSyncError = (error: unknown): string => {
  const message =
    error instanceof Error
      ? error.message
      : isRecord(error) && typeof error.message === 'string'
        ? error.message
        : '';
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : '';
  if (code === '42501' || /permission denied|row-level security/i.test(message)) {
    return 'Votre rôle ne permet pas de modifier les paramètres de cette agence.';
  }
  if (/failed to fetch|network|timeout/i.test(message)) {
    return 'Serveur injoignable : les paramètres restent enregistrés sur cet appareil.';
  }
  return message.trim() || 'Enregistrement sur le serveur impossible pour le moment.';
};

/**
 * Détecte une base antérieure à la migration de l'instantané.
 *
 * Sans ce garde-fou, chaque enregistrement échouerait avec un message
 * technique tant que la migration n'est pas appliquée au projet hébergé.
 */
export const isMissingSettingsColumn = (error: unknown): boolean => {
  const message = isRecord(error) && typeof error.message === 'string' ? error.message : '';
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : '';
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    (/column/i.test(message) && /settings(_updated_at)?/i.test(message) && /does not exist/i.test(message))
  );
};
