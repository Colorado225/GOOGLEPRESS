import { getTrialInfo, type SubscriptionPlanId, type SubscriptionState } from './subscription';

/**
 * Garde-fous des formules Free / Pro / Business.
 *
 * Deux familles de règles, appliquées au moment de l'action :
 *
 * 1. **Limites quantitatives** (casiers, comptes, commandes du mois) : la
 *    création est refusée au-delà du plafond, avec un message qui dit la
 *    limite et la formule à prendre. Rien n'est supprimé : ce qui existe reste.
 * 2. **Fonctions réservées** (espace client, livraisons GPS, preuve de remise,
 *    rapports détaillés) : l'écran affiche un panneau verrouillé au lieu de la
 *    fonction, jamais une erreur technique.
 *
 * Le module est volontairement pur : aucune lecture de contexte, aucun effet
 * de bord. Les tests unitaires couvrent chaque règle et chaque limite.
 */

export type PlanFeature =
  | 'customerPortal'
  | 'deliveryTracking'
  | 'deliveryProof'
  | 'detailedReports'
  | 'multiShop';

export interface PlanFeatureDefinition {
  label: string;
  description: string;
  requiredPlan: SubscriptionPlanId;
}

export const PLAN_FEATURES: Record<PlanFeature, PlanFeatureDefinition> = {
  customerPortal: {
    label: 'Espace client et suivi en ligne',
    description:
      'Vos clients suivent leur commande sans appeler le comptoir, avec le lien de suivi.',
    requiredPlan: 'pro',
  },
  deliveryTracking: {
    label: 'Tournées et carte de livraison',
    description:
      'Carte des tournées, heure d’arrivée estimée et partage de position du coursier.',
    requiredPlan: 'pro',
  },
  deliveryProof: {
    label: 'Preuve de remise',
    description: 'Photo, signature, code à 4 chiffres et nom du réceptionnaire.',
    requiredPlan: 'pro',
  },
  detailedReports: {
    label: 'Rapports détaillés et exports',
    description: 'Rapports par période, par employé, inventaire et export CSV.',
    requiredPlan: 'pro',
  },
  multiShop: {
    label: 'Pilotage multi-agences',
    description: 'Plusieurs points de vente réunis dans un seul tableau de bord.',
    requiredPlan: 'business',
  },
};

export interface PlanCapabilities {
  /** `null` = illimité. */
  maxUsers: number | null;
  maxOrdersPerMonth: number | null;
  maxStorageLocations: number | null;
  maxShops: number | null;
  features: Record<PlanFeature, boolean>;
}

const ALL_FEATURES_OFF: Record<PlanFeature, boolean> = {
  customerPortal: false,
  deliveryTracking: false,
  deliveryProof: false,
  detailedReports: false,
  multiShop: false,
};

export const PLAN_CAPABILITIES: Record<SubscriptionPlanId, PlanCapabilities> = {
  free: {
    maxUsers: 2,
    maxOrdersPerMonth: 100,
    maxStorageLocations: 10,
    maxShops: 1,
    features: { ...ALL_FEATURES_OFF },
  },
  pro: {
    maxUsers: 8,
    maxOrdersPerMonth: null,
    maxStorageLocations: null,
    maxShops: 1,
    features: {
      ...ALL_FEATURES_OFF,
      customerPortal: true,
      deliveryTracking: true,
      deliveryProof: true,
      detailedReports: true,
    },
  },
  business: {
    maxUsers: null,
    maxOrdersPerMonth: null,
    maxStorageLocations: null,
    maxShops: 3,
    features: {
      customerPortal: true,
      deliveryTracking: true,
      deliveryProof: true,
      detailedReports: true,
      multiShop: true,
    },
  },
};

/**
 * Formule réellement appliquée.
 *
 * Un compte Free profite de l'**essai de 14 jours** : pendant cette période,
 * il dispose des fonctions Pro (essai de l'offre supérieure). À l'échéance, il
 * retombe automatiquement sur les plafonds Free — sans perte de données.
 * Une formule suspendue retombe aussi sur Free.
 */
export const resolveEffectivePlanId = (
  state: Pick<SubscriptionState, 'plan' | 'status' | 'trialStartedAt'> &
    Partial<Pick<SubscriptionState, 'effectivePlan'>>,
  now: Date = new Date()
): SubscriptionPlanId => {
  // En espace réel, la base a déjà arbitré essai et suspension : sa réponse
  // fait foi. Le calcul local ne sert qu'à la démonstration et aux anciennes
  // sauvegardes.
  if (state.effectivePlan) return state.effectivePlan;
  if (state.status === 'suspendu') return 'free';
  if (state.plan !== 'free') return state.plan;
  return getTrialInfo(state, now).active ? 'pro' : 'free';
};

export const getPlanCapabilities = (planId: SubscriptionPlanId): PlanCapabilities =>
  PLAN_CAPABILITIES[planId] ?? PLAN_CAPABILITIES.free;

export const isFeatureIncluded = (planId: SubscriptionPlanId, feature: PlanFeature): boolean =>
  getPlanCapabilities(planId).features[feature] === true;

export const getFeatureDefinition = (feature: PlanFeature): PlanFeatureDefinition =>
  PLAN_FEATURES[feature];

export interface PlanGuard {
  allowed: boolean;
  /** Plafond de la formule, `null` quand il est illimité. */
  limit: number | null;
  /** Formule qui lève le blocage. */
  requiredPlan: SubscriptionPlanId;
  /** Message prêt à afficher, vide quand l'action est autorisée. */
  message: string;
}

const allow = (): PlanGuard => ({ allowed: true, limit: null, requiredPlan: 'free', message: '' });

const deny = (limit: number, requiredPlan: SubscriptionPlanId, message: string): PlanGuard => ({
  allowed: false,
  limit,
  requiredPlan,
  message,
});

/** Un ajout de casier (ou une série) tient-il dans la formule ? */
export const guardStorageLocationCount = (
  currentCount: number,
  addedCount: number,
  planId: SubscriptionPlanId
): PlanGuard => {
  const max = getPlanCapabilities(planId).maxStorageLocations;
  if (max === null) return allow();
  if (currentCount + Math.max(1, addedCount) <= max) return allow();
  return deny(
    max,
    'pro',
    `La formule Free limite à ${max} emplacements de rangement. Passez en Pro pour des casiers illimités.`
  );
};

/** Un compte d'équipe supplémentaire tient-il dans la formule ? */
export const guardEmployeeCount = (
  currentCount: number,
  planId: SubscriptionPlanId
): PlanGuard => {
  const max = getPlanCapabilities(planId).maxUsers;
  if (max === null) return allow();
  if (currentCount + 1 <= max) return allow();
  const requiredPlan: SubscriptionPlanId = planId === 'free' ? 'pro' : 'business';
  return deny(
    max,
    requiredPlan,
    `La formule ${planId === 'free' ? 'Free' : 'Pro'} permet ${max} comptes. Changez de formule pour en ajouter un.`
  );
};

/** La commande du mois tient-elle dans le quota ? */
export const guardMonthlyOrderCount = (
  ordersThisMonth: number,
  planId: SubscriptionPlanId
): PlanGuard => {
  const max = getPlanCapabilities(planId).maxOrdersPerMonth;
  if (max === null) return allow();
  if (ordersThisMonth < max) return allow();
  return deny(
    max,
    'pro',
    `La formule Free s’arrête à ${max} commandes par mois (${ordersThisMonth} enregistrées). Passez en Pro pour continuer sans plafond.`
  );
};

/** Clé « AAAA-MM » d'une date ISO, dans le fuseau du poste. */
export const getMonthKey = (iso: string): string | null => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/** Nombre de commandes créées pendant le mois calendaire de `reference`. */
export const countOrdersInMonth = (
  orders: readonly { receivedAt?: string }[],
  reference: Date = new Date()
): number => {
  const month = `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, '0')}`;
  return orders.filter((order) => {
    if (!order.receivedAt) return false;
    return getMonthKey(order.receivedAt) === month;
  }).length;
};

/** Pourcentage de consommation d'un quota, borné à 100. */
export const getQuotaUsage = (used: number, limit: number | null): number | null => {
  if (limit === null) return null;
  if (limit <= 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
};
