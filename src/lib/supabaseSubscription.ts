import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { supabase } from './supabase';
import {
  TRIAL_DAYS,
  type SubscriptionPlanId,
  type SubscriptionState,
  type SubscriptionStatus,
} from './subscription';

type Client = SupabaseClient<Database>;

/**
 * État d'abonnement lu dans la base.
 *
 * La formule, la date de départ de l'essai et les quotas viennent de la
 * fonction `public.get_shop_subscription_state` : effacer le stockage du
 * navigateur ou bricoler la console ne change rien. Le client ne fait que
 * lire cet état et déposer une demande de formule.
 */
export interface RemotePlanQuotas {
  /** `null` = illimité. */
  users: number | null;
  ordersPerMonth: number | null;
  storageLocations: number | null;
}

export interface RemotePlanUsage {
  users: number;
  ordersThisMonth: number;
  storageLocations: number;
}

export interface RemoteSubscriptionState {
  plan: SubscriptionPlanId;
  status: SubscriptionStatus;
  /** Formule réellement appliquée, essai et suspension déjà arbitrés. */
  effectivePlan: SubscriptionPlanId;
  /** Modules de la formule effective ; null pour une ancienne RPC sans ce champ. */
  modules: string[] | null;
  /** Demande déposée, en attente d'activation par l'éditeur. */
  requestedPlan: SubscriptionPlanId | null;
  requestedAt: string | null;
  renewsOn: string | null;
  trialStartedAt: string;
  trialEndsAt: string;
  trialActive: boolean;
  trialDaysLeft: number;
  limits: RemotePlanQuotas;
  usage: RemotePlanUsage;
}

const PLAN_IDS: readonly SubscriptionPlanId[] = ['free', 'pro', 'business'];
const STATUSES: readonly SubscriptionStatus[] = ['essai', 'actif', 'suspendu'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRecord = (record: Record<string, unknown>, key: string): Record<string, unknown> => {
  const value = record[key];
  if (!isRecord(value)) {
    throw new Error(`Réponse d’abonnement invalide : champ ${key}.`);
  }
  return value;
};

const readString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Réponse d’abonnement invalide : champ ${key}.`);
  }
  return value;
};

const readNullableString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new Error(`Réponse d’abonnement invalide : champ ${key}.`);
  }
  return value.trim() ? value : null;
};

const readPlan = (record: Record<string, unknown>, key: string): SubscriptionPlanId => {
  const value = readString(record, key);
  if (!PLAN_IDS.includes(value as SubscriptionPlanId)) {
    throw new Error(`Réponse d’abonnement invalide : formule ${key} inconnue.`);
  }
  return value as SubscriptionPlanId;
};

const readNullablePlan = (
  record: Record<string, unknown>,
  key: string
): SubscriptionPlanId | null => {
  const value = readNullableString(record, key);
  if (value === null) return null;
  if (!PLAN_IDS.includes(value as SubscriptionPlanId)) {
    throw new Error(`Réponse d’abonnement invalide : formule ${key} inconnue.`);
  }
  return value as SubscriptionPlanId;
};

const readStatus = (record: Record<string, unknown>): SubscriptionStatus => {
  const value = readString(record, 'status');
  if (!STATUSES.includes(value as SubscriptionStatus)) {
    throw new Error('Réponse d’abonnement invalide : statut inconnu.');
  }
  return value as SubscriptionStatus;
};

const readModules = (record: Record<string, unknown>): string[] | null => {
  const value = record.modules;
  // Compatibilité avec la RPC déployée avant le durcissement des opérations.
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new Error('Réponse d’abonnement invalide : champ modules.');
  }
  return [...new Set(value)];
};

const readCount = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Réponse d’abonnement invalide : nombre ${key}.`);
  }
  return value;
};

const readNullableCount = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Réponse d’abonnement invalide : plafond ${key}.`);
  }
  return value;
};

/** Valide et normalise le `jsonb` renvoyé par la base. */
export const parseRemoteSubscription = (raw: unknown): RemoteSubscriptionState => {
  if (!isRecord(raw)) {
    throw new Error('Réponse d’abonnement invalide.');
  }
  const limits = readRecord(raw, 'limits');
  const usage = readRecord(raw, 'usage');
  const trialActive = raw.trial_active;
  if (typeof trialActive !== 'boolean') {
    throw new Error('Réponse d’abonnement invalide : champ trial_active.');
  }
  return {
    plan: readPlan(raw, 'plan'),
    status: readStatus(raw),
    effectivePlan: readPlan(raw, 'effective_plan'),
    modules: readModules(raw),
    requestedPlan: readNullablePlan(raw, 'requested_plan'),
    requestedAt: readNullableString(raw, 'requested_at'),
    renewsOn: readNullableString(raw, 'renews_on'),
    trialStartedAt: readString(raw, 'trial_started_at'),
    trialEndsAt: readString(raw, 'trial_ends_at'),
    trialActive,
    trialDaysLeft: readCount(raw, 'trial_days_left'),
    limits: {
      users: readNullableCount(limits, 'users'),
      ordersPerMonth: readNullableCount(limits, 'orders_per_month'),
      storageLocations: readNullableCount(limits, 'storage_locations'),
    },
    usage: {
      users: readCount(usage, 'users'),
      ordersThisMonth: readCount(usage, 'orders_this_month'),
      storageLocations: readCount(usage, 'storage_locations'),
    },
  };
};

/**
 * Traduit l'état serveur en état d'affichage. Aucune valeur locale n'est
 * conservée : la formule, l'essai et la demande viennent toutes de la base.
 */
export const toSubscriptionState = (remote: RemoteSubscriptionState): SubscriptionState => ({
  plan: remote.plan,
  status: remote.status,
  renewsOn: remote.renewsOn,
  trialStartedAt: remote.trialStartedAt,
  trialEndsAt: remote.trialEndsAt,
  effectivePlan: remote.effectivePlan,
  requestedPlan: remote.requestedPlan,
  requestedAt: remote.requestedAt,
});

/** Durée d'essai annoncée par la base ; retombe sur la constante partagée. */
export const getRemoteTrialDays = (
  remote: Pick<RemoteSubscriptionState, 'trialStartedAt' | 'trialEndsAt'>
): number => {
  const started = new Date(remote.trialStartedAt).getTime();
  const ends = new Date(remote.trialEndsAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(ends) || ends <= started) {
    return TRIAL_DAYS;
  }
  return Math.round((ends - started) / (24 * 60 * 60 * 1000));
};

const requireClient = (client?: Client | null): Client => {
  const resolved = client ?? supabase;
  if (!resolved) {
    throw new Error('Supabase n’est pas configuré dans cet environnement.');
  }
  return resolved;
};

/** Lit l'abonnement de l'agence. Refuse (42501) si l'utilisateur n'est pas membre. */
export async function fetchRemoteSubscription(
  shopId: string,
  client?: Client | null
): Promise<RemoteSubscriptionState> {
  const resolved = requireClient(client);
  const { data, error } = await resolved.rpc('get_shop_subscription_state', {
    p_shop_id: shopId,
  });
  if (error) throw new Error(error.message);
  return parseRemoteSubscription(data as unknown);
}

/**
 * Dépose une demande de formule. Le propriétaire seul y a droit ; la base
 * refuse tout autre rôle, même si l'appel ne vient pas de l'écran.
 */
export async function requestRemotePlanChange(
  shopId: string,
  planId: SubscriptionPlanId,
  client?: Client | null
): Promise<RemoteSubscriptionState> {
  const resolved = requireClient(client);
  const { data, error } = await resolved.rpc('request_subscription_plan', {
    p_shop_id: shopId,
    p_plan: planId,
  });
  if (error) throw new Error(error.message);
  return parseRemoteSubscription(data as unknown);
}
