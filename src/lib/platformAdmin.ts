import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { isSupabaseConfigured, supabase } from './supabase';
import { getStaffAccessEnvironment, resolvePlatformAdminAccessMode } from './staffAccess';
import type { SubscriptionPlanId, SubscriptionStatus } from './subscription';

type Client = SupabaseClient<Database>;

export type PlatformOrganizationStatus = 'active' | 'suspended' | 'closed';
export type PlatformSupportTone = 'info' | 'warning' | 'critical';
export type PlatformSupportCategory = 'support' | 'configuration';
export type PlatformAccountFilter = 'all' | 'pending' | 'active' | 'suspended';

export interface PlatformPublicConfig {
  registrations_open: boolean;
  support_message: string;
  support_message_tone: PlatformSupportTone;
  updated_at: string | null;
  campaign_id?: string | null;
  campaign_title?: string | null;
  maintenance_mode?: boolean;
}

export interface PlatformAdminSubscription {
  plan: SubscriptionPlanId;
  status: SubscriptionStatus;
  requested_plan: SubscriptionPlanId | null;
  requested_at: string | null;
  trial_started_at: string | null;
  renews_on: string | null;
}

export interface PlatformAdminShop {
  id: string;
  name: string;
  slug: string;
  status: PlatformOrganizationStatus;
  city: string | null;
  phone_display: string | null;
  email: string | null;
  subscription: PlatformAdminSubscription;
}

export interface PlatformSupportNote {
  id: string;
  shop_id: string | null;
  category: PlatformSupportCategory;
  note: string;
  created_at: string;
}

export interface PlatformAdminOwner {
  user_id: string;
  display_name: string | null;
  email: string | null;
}

export interface PlatformAdminOrganization {
  id: string;
  name: string;
  slug: string;
  status: PlatformOrganizationStatus;
  created_at: string;
  owner: PlatformAdminOwner | null;
  shops: PlatformAdminShop[];
  support_notes: PlatformSupportNote[];
}

export interface PlatformAdminSnapshot {
  config: PlatformPublicConfig;
  organizations: PlatformAdminOrganization[];
}

const PLANS: readonly SubscriptionPlanId[] = ['free', 'pro', 'business'];
const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = ['essai', 'actif', 'suspendu'];
const ORGANIZATION_STATUSES: readonly PlatformOrganizationStatus[] = [
  'active',
  'suspended',
  'closed',
];
const TONES: readonly PlatformSupportTone[] = ['info', 'warning', 'critical'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`Réponse d’administration invalide : ${label}.`);
  return value;
};

const readString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Réponse d’administration invalide : champ ${key}.`);
  }
  return value;
};

const readNullableString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new Error(`Réponse d’administration invalide : champ ${key}.`);
  }
  return value;
};

const readBoolean = (record: Record<string, unknown>, key: string): boolean => {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Error(`Réponse d’administration invalide : champ ${key}.`);
  }
  return value;
};

const readArray = (record: Record<string, unknown>, key: string): unknown[] => {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`Réponse d’administration invalide : champ ${key}.`);
  }
  return value;
};

const readChoice = <T extends string>(
  record: Record<string, unknown>,
  key: string,
  choices: readonly T[]
): T => {
  const value = readString(record, key) as T;
  if (!choices.includes(value)) {
    throw new Error(`Réponse d’administration invalide : champ ${key}.`);
  }
  return value;
};

const readNullablePlan = (
  record: Record<string, unknown>,
  key: string
): SubscriptionPlanId | null => {
  const value = readNullableString(record, key);
  if (value === null) return null;
  if (!PLANS.includes(value as SubscriptionPlanId)) {
    throw new Error(`Réponse d’administration invalide : champ ${key}.`);
  }
  return value as SubscriptionPlanId;
};

export const parsePlatformPublicConfig = (raw: unknown): PlatformPublicConfig => {
  const record = readRecord(raw, 'configuration');
  return {
    registrations_open: readBoolean(record, 'registrations_open'),
    support_message: readString(record, 'support_message'),
    support_message_tone: readChoice(record, 'support_message_tone', TONES),
    updated_at: readNullableString(record, 'updated_at'),
    campaign_id: readNullableString(record, 'campaign_id'),
    campaign_title: readNullableString(record, 'campaign_title'),
    maintenance_mode: record.maintenance_mode === undefined
      ? false
      : readBoolean(record, 'maintenance_mode'),
  };
};

const parseSubscription = (raw: unknown): PlatformAdminSubscription => {
  const record = readRecord(raw, 'abonnement');
  return {
    plan: readChoice(record, 'plan', PLANS),
    status: readChoice(record, 'status', SUBSCRIPTION_STATUSES),
    requested_plan: readNullablePlan(record, 'requested_plan'),
    requested_at: readNullableString(record, 'requested_at'),
    trial_started_at: readNullableString(record, 'trial_started_at'),
    renews_on: readNullableString(record, 'renews_on'),
  };
};

const parseShop = (raw: unknown): PlatformAdminShop => {
  const record = readRecord(raw, 'agence');
  return {
    id: readString(record, 'id'),
    name: readString(record, 'name'),
    slug: readString(record, 'slug'),
    status: readChoice(record, 'status', ORGANIZATION_STATUSES),
    city: readNullableString(record, 'city'),
    phone_display: readNullableString(record, 'phone_display'),
    email: readNullableString(record, 'email'),
    subscription: parseSubscription(record.subscription),
  };
};

const parseSupportNote = (raw: unknown): PlatformSupportNote => {
  const record = readRecord(raw, 'note de support');
  return {
    id: readString(record, 'id'),
    shop_id: readNullableString(record, 'shop_id'),
    category: readChoice(record, 'category', ['support', 'configuration'] as const),
    note: readString(record, 'note'),
    created_at: readString(record, 'created_at'),
  };
};

const parseOwner = (raw: unknown): PlatformAdminOwner | null => {
  if (raw === null || raw === undefined) return null;
  const record = readRecord(raw, 'propriétaire');
  return {
    user_id: readString(record, 'user_id'),
    display_name: readNullableString(record, 'display_name'),
    email: readNullableString(record, 'email'),
  };
};

const parseOrganization = (raw: unknown): PlatformAdminOrganization => {
  const record = readRecord(raw, 'organisation');
  return {
    id: readString(record, 'id'),
    name: readString(record, 'name'),
    slug: readString(record, 'slug'),
    status: readChoice(record, 'status', ORGANIZATION_STATUSES),
    created_at: readString(record, 'created_at'),
    owner: parseOwner(record.owner),
    shops: readArray(record, 'shops').map(parseShop),
    support_notes: readArray(record, 'support_notes').map(parseSupportNote),
  };
};

export const parsePlatformAdminSnapshot = (raw: unknown): PlatformAdminSnapshot => {
  const record = readRecord(raw, 'instantané');
  return {
    config: parsePlatformPublicConfig(record.config),
    organizations: readArray(record, 'organizations').map(parseOrganization),
  };
};

export const getPlatformAdminMetrics = (organizations: readonly PlatformAdminOrganization[]) => ({
  organizations: organizations.length,
  shops: organizations.reduce((total, organization) => total + organization.shops.length, 0),
  active: organizations.filter((organization) => organization.status === 'active').length,
  suspended: organizations.filter((organization) => organization.status === 'suspended').length,
  pending: organizations.filter((organization) =>
    organization.shops.some((shop) => shop.subscription.requested_plan !== null)
  ).length,
});

const normalizeSearch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .trim();

export const filterPlatformAdminOrganizations = (
  organizations: readonly PlatformAdminOrganization[],
  query: string,
  filter: PlatformAccountFilter
): PlatformAdminOrganization[] => {
  const normalizedQuery = normalizeSearch(query);
  return organizations.filter((organization) => {
    if (filter === 'active' && organization.status !== 'active') return false;
    if (filter === 'suspended' && organization.status !== 'suspended') return false;
    if (
      filter === 'pending' &&
      !organization.shops.some((shop) => shop.subscription.requested_plan !== null)
    ) {
      return false;
    }
    if (!normalizedQuery) return true;
    const haystack = normalizeSearch(
      [
        organization.name,
        organization.slug,
        organization.owner?.display_name ?? '',
        organization.owner?.email ?? '',
        ...organization.shops.flatMap((shop) => [shop.name, shop.city ?? '', shop.email ?? '']),
      ].join(' ')
    );
    return haystack.includes(normalizedQuery);
  });
};

const DEMO_STORAGE_KEY = 'pressingpro_platform_admin_demo_v1';

const createDemoSnapshot = (): PlatformAdminSnapshot => ({
  config: {
    registrations_open: true,
    support_message: '',
    support_message_tone: 'info',
    updated_at: null,
  },
  organizations: [
    {
      id: 'demo-org-harmonie',
      name: 'Pressing Harmonie — démonstration',
      slug: 'pressing-harmonie-demo',
      status: 'active',
      created_at: '2026-10-02T09:00:00.000Z',
      owner: {
        user_id: 'demo-owner-harmonie',
        display_name: 'Propriétaire fictif Harmonie',
        email: 'harmonie@example.test',
      },
      shops: [
        {
          id: 'demo-shop-harmonie-cocody',
          name: 'Harmonie Cocody',
          slug: 'cocody',
          status: 'active',
          city: 'Abidjan',
          phone_display: '+225 07 00 00 00 01',
          email: 'cocody@example.test',
          subscription: {
            plan: 'free',
            status: 'essai',
            requested_plan: 'pro',
            requested_at: '2026-10-28T14:30:00.000Z',
            trial_started_at: '2026-10-20T09:00:00.000Z',
            renews_on: null,
          },
        },
      ],
      support_notes: [],
    },
    {
      id: 'demo-org-plateau',
      name: 'Buanderie du Plateau — démonstration',
      slug: 'buanderie-plateau-demo',
      status: 'active',
      created_at: '2026-09-12T09:00:00.000Z',
      owner: {
        user_id: 'demo-owner-plateau',
        display_name: 'Propriétaire fictive Plateau',
        email: 'plateau@example.test',
      },
      shops: [
        {
          id: 'demo-shop-plateau',
          name: 'Buanderie Plateau',
          slug: 'plateau',
          status: 'active',
          city: 'Abidjan',
          phone_display: '+225 07 00 00 00 02',
          email: 'plateau-agence@example.test',
          subscription: {
            plan: 'business',
            status: 'actif',
            requested_plan: null,
            requested_at: null,
            trial_started_at: '2026-09-12T09:00:00.000Z',
            renews_on: '2026-11-12',
          },
        },
      ],
      support_notes: [
        {
          id: 'demo-note-plateau',
          shop_id: 'demo-shop-plateau',
          category: 'configuration',
          note: 'Configuration initiale fictive vérifiée avec le propriétaire.',
          created_at: '2026-10-25T10:00:00.000Z',
        },
      ],
    },
    {
      id: 'demo-org-emeraude',
      name: 'Pressing Émeraude — démonstration',
      slug: 'pressing-emeraude-demo',
      status: 'suspended',
      created_at: '2026-08-05T09:00:00.000Z',
      owner: {
        user_id: 'demo-owner-emeraude',
        display_name: 'Propriétaire fictif Émeraude',
        email: 'emeraude@example.test',
      },
      shops: [
        {
          id: 'demo-shop-emeraude',
          name: 'Émeraude Marcory',
          slug: 'marcory',
          status: 'active',
          city: 'Abidjan',
          phone_display: '+225 07 00 00 00 03',
          email: 'emeraude-agence@example.test',
          subscription: {
            plan: 'pro',
            status: 'suspendu',
            requested_plan: null,
            requested_at: null,
            trial_started_at: '2026-08-05T09:00:00.000Z',
            renews_on: null,
          },
        },
      ],
      support_notes: [],
    },
  ],
});

const isLocalDemo = (): boolean =>
  resolvePlatformAdminAccessMode(getStaffAccessEnvironment(isSupabaseConfigured)) ===
  'explicit-local-demo';

const cloneDemoSnapshot = (): PlatformAdminSnapshot =>
  JSON.parse(JSON.stringify(createDemoSnapshot())) as PlatformAdminSnapshot;

const readDemoSnapshot = (): PlatformAdminSnapshot => {
  if (typeof window === 'undefined') return cloneDemoSnapshot();
  const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
  if (!raw) return cloneDemoSnapshot();
  try {
    return parsePlatformAdminSnapshot(JSON.parse(raw));
  } catch {
    return cloneDemoSnapshot();
  }
};

const writeDemoSnapshot = (snapshot: PlatformAdminSnapshot): PlatformAdminSnapshot => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(snapshot));
    window.dispatchEvent(new CustomEvent('pressingpro:platform-config-updated'));
  }
  return snapshot;
};

const requireClient = (client?: Client | null): Client => {
  const resolved = client ?? supabase;
  if (!resolved) throw new Error('Supabase n’est pas configuré dans cet environnement.');
  return resolved;
};

const throwRpcError = (error: { message: string } | null): void => {
  if (error) throw new Error(error.message);
};

/** Vérifie le rôle réel dans la table protégée ; jamais une métadonnée Auth modifiable. */
export async function isPlatformAdminUser(
  userId: string,
  client?: Client | null
): Promise<boolean> {
  const resolved = requireClient(client);
  const { data, error } = await resolved
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

export async function fetchPlatformAdminSnapshot(
  client?: Client | null
): Promise<PlatformAdminSnapshot> {
  if (isLocalDemo()) return readDemoSnapshot();
  const resolved = requireClient(client);
  const { data, error } = await resolved.rpc('get_platform_admin_snapshot');
  throwRpcError(error);
  return parsePlatformAdminSnapshot(data as unknown);
}

export async function fetchPlatformPublicConfig(
  client?: Client | null
): Promise<PlatformPublicConfig | null> {
  if (isLocalDemo()) return readDemoSnapshot().config;
  if (!isSupabaseConfigured && !client) return null;
  const resolved = requireClient(client);
  const { data, error } = await resolved.rpc('get_platform_public_config');
  throwRpcError(error);
  return parsePlatformPublicConfig(data as unknown);
}

export async function adminSetShopSubscription(
  input: {
    shopId: string;
    plan: SubscriptionPlanId;
    status: SubscriptionStatus;
    renewsOn: string | null;
    note?: string;
  },
  client?: Client | null
): Promise<PlatformAdminSnapshot> {
  if (isLocalDemo()) {
    const snapshot = readDemoSnapshot();
    const shop = snapshot.organizations
      .flatMap((organization) => organization.shops)
      .find((entry) => entry.id === input.shopId);
    if (!shop) throw new Error('Agence de démonstration introuvable.');
    shop.subscription = {
      ...shop.subscription,
      plan: input.plan,
      status: input.status,
      renews_on: input.renewsOn,
      requested_plan: null,
      requested_at: null,
    };
    return writeDemoSnapshot(snapshot);
  }
  const resolved = requireClient(client);
  const { data, error } = await resolved.rpc('admin_set_shop_subscription', {
    p_shop_id: input.shopId,
    p_plan: input.plan,
    p_status: input.status,
    p_renews_on: input.renewsOn,
    p_note: input.note?.trim() || null,
  });
  throwRpcError(error);
  return parsePlatformAdminSnapshot(data as unknown);
}

export async function adminSetOrganizationStatus(
  organizationId: string,
  status: 'active' | 'suspended',
  note: string,
  client?: Client | null
): Promise<PlatformAdminSnapshot> {
  if (status === 'suspended' && note.trim().length < 2) {
    throw new Error('Indiquez le motif du verrouillage.');
  }
  if (isLocalDemo()) {
    const snapshot = readDemoSnapshot();
    const organization = snapshot.organizations.find((entry) => entry.id === organizationId);
    if (!organization) throw new Error('Organisation de démonstration introuvable.');
    organization.status = status;
    return writeDemoSnapshot(snapshot);
  }
  const resolved = requireClient(client);
  const { data, error } = await resolved.rpc('admin_set_organization_status', {
    p_organization_id: organizationId,
    p_status: status,
    p_note: note.trim() || null,
  });
  throwRpcError(error);
  return parsePlatformAdminSnapshot(data as unknown);
}

export async function adminAddSupportNote(
  input: {
    organizationId: string;
    shopId: string | null;
    category: PlatformSupportCategory;
    note: string;
  },
  client?: Client | null
): Promise<PlatformAdminSnapshot> {
  if (input.note.trim().length < 2) throw new Error('Saisissez une note de support.');
  if (isLocalDemo()) {
    const snapshot = readDemoSnapshot();
    const organization = snapshot.organizations.find(
      (entry) => entry.id === input.organizationId
    );
    if (!organization) throw new Error('Organisation de démonstration introuvable.');
    organization.support_notes.unshift({
      id: `demo-note-${Date.now()}`,
      shop_id: input.shopId,
      category: input.category,
      note: input.note.trim(),
      created_at: new Date().toISOString(),
    });
    return writeDemoSnapshot(snapshot);
  }
  const resolved = requireClient(client);
  const { data, error } = await resolved.rpc('admin_add_support_note', {
    p_organization_id: input.organizationId,
    p_category: input.category,
    p_note: input.note.trim(),
    p_shop_id: input.shopId,
  });
  throwRpcError(error);
  return parsePlatformAdminSnapshot(data as unknown);
}

export async function adminUpdatePlatformConfig(
  config: Pick<
    PlatformPublicConfig,
    'registrations_open' | 'support_message' | 'support_message_tone'
  >,
  client?: Client | null
): Promise<PlatformAdminSnapshot> {
  if (config.support_message.length > 500) {
    throw new Error('L’annonce est limitée à 500 caractères.');
  }
  if (isLocalDemo()) {
    const snapshot = readDemoSnapshot();
    snapshot.config = {
      ...config,
      support_message: config.support_message.trim(),
      updated_at: new Date().toISOString(),
    };
    return writeDemoSnapshot(snapshot);
  }
  const resolved = requireClient(client);
  const { data, error } = await resolved.rpc('admin_update_platform_config', {
    p_registrations_open: config.registrations_open,
    p_support_message: config.support_message,
    p_support_message_tone: config.support_message_tone,
  });
  throwRpcError(error);
  return parsePlatformAdminSnapshot(data as unknown);
}
