import type { WorkspaceScope } from './workspaceScope';

/**
 * Plan d'abonnement affiché dans la barre latérale.
 *
 * Aucune facturation n'existe encore côté serveur : l'état est donc une
 * préférence locale, explicitement présentée comme telle. Le jour où Supabase
 * portera les abonnements, seule la source de `resolveSubscriptionState`
 * changera ; l'affichage restera identique.
 */

export type SubscriptionPlanId = 'decouverte' | 'standard' | 'pro';
export type SubscriptionStatus = 'essai' | 'actif' | 'suspendu';

export interface SubscriptionPlanDefinition {
  id: SubscriptionPlanId;
  label: string;
  tagline: string;
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlanDefinition[] = [
  {
    id: 'decouverte',
    label: 'Formule Découverte',
    tagline: 'Phase pilote, sans facturation',
  },
  {
    id: 'standard',
    label: 'Formule Standard',
    tagline: 'Une agence, suivi client inclus',
  },
  {
    id: 'pro',
    label: 'Formule Pro',
    tagline: 'Multi-agences et rapports avancés',
  },
];

export interface SubscriptionState {
  plan: SubscriptionPlanId;
  status: SubscriptionStatus;
  /** Date de fin de période connue ; `null` = aucune échéance enregistrée. */
  renewsOn: string | null;
}

export const SUBSCRIPTION_STORAGE_KEY = 'pressingpro_subscription';

/**
 * État par défaut, honnête dans les deux portées :
 *
 * - espace réel : formule Découverte en essai — c'est ce que vit réellement un
 *   compte qui vient d'être créé, aucune facturation n'étant branchée ;
 * - démonstration : formule Pro, marquée « essai » pour ne pas laisser croire
 *   à un abonnement payé.
 */
export const resolveDefaultSubscription = (
  scope: Pick<WorkspaceScope, 'mode'>
): SubscriptionState =>
  scope.mode === 'live'
    ? { plan: 'decouverte', status: 'essai', renewsOn: null }
    : { plan: 'pro', status: 'essai', renewsOn: null };

const isPlanId = (value: unknown): value is SubscriptionPlanId =>
  value === 'decouverte' || value === 'standard' || value === 'pro';

const isStatus = (value: unknown): value is SubscriptionStatus =>
  value === 'essai' || value === 'actif' || value === 'suspendu';

/** Valide une sauvegarde locale ; toute valeur douteuse retombe sur le défaut. */
export const normalizeSubscription = (
  value: unknown,
  fallback: SubscriptionState
): SubscriptionState => {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<SubscriptionState>;
  return {
    plan: isPlanId(candidate.plan) ? candidate.plan : fallback.plan,
    status: isStatus(candidate.status) ? candidate.status : fallback.status,
    renewsOn:
      typeof candidate.renewsOn === 'string' && candidate.renewsOn.trim()
        ? candidate.renewsOn
        : null,
  };
};

export const getSubscriptionPlan = (
  planId: SubscriptionPlanId
): SubscriptionPlanDefinition =>
  SUBSCRIPTION_PLANS.find((plan) => plan.id === planId) ?? SUBSCRIPTION_PLANS[0];

/** Libellé de statut, jamais « actif » par défaut. */
export const getSubscriptionStatusLabel = (status: SubscriptionStatus): string => {
  switch (status) {
    case 'actif':
      return 'Abonnement actif';
    case 'essai':
      return 'Essai — sans facturation';
    case 'suspendu':
      return 'Abonnement suspendu';
  }
};

/** Ton visuel du statut (classes Tailwind complètes, pas de concaténation). */
export const getSubscriptionStatusTone = (
  status: SubscriptionStatus
): { chip: string; dot: string } => {
  switch (status) {
    case 'actif':
      return {
        chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-400',
      };
    case 'essai':
      return {
        chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        dot: 'bg-amber-400',
      };
    case 'suspendu':
      return {
        chip: 'bg-red-500/15 text-red-300 border-red-500/30',
        dot: 'bg-red-400',
      };
  }
};
