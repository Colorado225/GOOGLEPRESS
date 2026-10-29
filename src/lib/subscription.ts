import type { WorkspaceScope } from './workspaceScope';

/**
 * Formules d'abonnement de PressingPro.
 *
 * Trois paliers seulement — Free, Pro, Business — pensés pour un pressing
 * ivoirien : une offre gratuite qui installe l'habitude, une offre Pro qui
 * couvre le quotidien d'une agence, une offre Business pour les enseignes à
 * plusieurs points de vente et les besoins d'accompagnement.
 *
 * **Aucun paiement n'est encaissé dans l'application.** Le choix d'une formule
 * est une demande commerciale enregistrée localement ; l'activation se fait
 * avec l'équipe. Les limites affichées sont des engagements commerciaux, pas
 * encore des blocages techniques — c'est dit tel quel dans l'écran.
 */

export type SubscriptionPlanId = 'free' | 'pro' | 'business';
export type SubscriptionStatus = 'essai' | 'actif' | 'suspendu';

export type PlanLimit = number | 'illimite';

export interface SubscriptionPlanLimits {
  /** Agences (points de vente) couvertes par la formule. */
  shops: PlanLimit;
  /** Comptes de connexion actifs. */
  users: PlanLimit;
  /** Commandes enregistrées par mois. */
  ordersPerMonth: PlanLimit;
  /** Emplacements de rangement (casiers). */
  storageLocations: PlanLimit;
}

export interface SubscriptionPlanDefinition {
  id: SubscriptionPlanId;
  label: string;
  tagline: string;
  /** Prix mensuel en FCFA (0 pour la formule gratuite). */
  priceMonthlyXof: number;
  /** Prix annuel en FCFA, deux mois offerts par rapport au mensuel. */
  priceYearlyXof: number;
  /** À qui la formule s'adresse, en une phrase. */
  audience: string;
  limits: SubscriptionPlanLimits;
  /** Ce qui est réellement disponible aujourd'hui dans l'application. */
  features: string[];
  /** Ce qui est annoncé mais pas encore livré, dit franchement. */
  comingSoon?: string[];
  /** Formule mise en avant dans l'écran (celle qu'on veut vendre). */
  highlighted?: boolean;
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlanDefinition[] = [
  {
    id: 'free',
    label: 'Free',
    tagline: 'Pour démarrer sans risque',
    priceMonthlyXof: 0,
    priceYearlyXof: 0,
    audience: 'Pressing qui teste l’outil ou travaille seul.',
    limits: { shops: 1, users: 2, ordersPerMonth: 100, storageLocations: 10 },
    features: [
      'Caisse, tickets et encaissements',
      'Catalogue des prestations et des vêtements',
      'Rangement des commandes et étiquettes de casier',
      'Rapports du jour',
      'Sauvegarde manuelle des données',
    ],
    comingSoon: ['Support par e-mail'],
  },
  {
    id: 'pro',
    label: 'Pro',
    tagline: 'Le quotidien d’une agence',
    priceMonthlyXof: 12_000,
    priceYearlyXof: 120_000,
    audience: 'Pressing établi avec une équipe et des livraisons.',
    limits: {
      shops: 1,
      users: 8,
      ordersPerMonth: 'illimite',
      storageLocations: 'illimite',
    },
    features: [
      'Tout ce que contient Free',
      'Comptes illimités pour l’équipe (dans la limite de 8)',
      'Espace client : suivi de commande en ligne',
      'Tournées de livraison, carte et heure d’arrivée',
      'Preuve de remise : photo, signature, code',
      'Rapports détaillés et exports',
      'Sauvegarde automatique dans la base',
    ],
    comingSoon: ['Relances clients par SMS'],
    highlighted: true,
  },
  {
    id: 'business',
    label: 'Business',
    tagline: 'Plusieurs agences, un seul pilotage',
    priceMonthlyXof: 29_000,
    priceYearlyXof: 290_000,
    audience: 'Enseignes à plusieurs points de vente et franchises.',
    limits: {
      shops: 3,
      users: 'illimite',
      ordersPerMonth: 'illimite',
      storageLocations: 'illimite',
    },
    features: [
      'Tout ce que contient Pro',
      'Utilisateurs illimités',
      'Rôles et accès par agence',
      'Accompagnement à la mise en place',
      'Formation de l’équipe sur site',
      'Support prioritaire et gestionnaire dédié',
    ],
    comingSoon: ['Tableau de bord consolidé multi-agences', 'API et webhooks'],
  },
];

/** Durée de l'essai offert sur un compte réel, en jours. */
export const TRIAL_DAYS = 14;

export interface SubscriptionState {
  plan: SubscriptionPlanId;
  status: SubscriptionStatus;
  /** Date de fin de période connue ; `null` = aucune échéance enregistrée. */
  renewsOn: string | null;
  /**
   * Début de l'essai de 14 jours. Fixé une seule fois par espace : recharger
   * l'application ne remet jamais le compteur à zéro.
   */
  trialStartedAt: string | null;
}

export interface TrialInfo {
  /** L'essai court-il encore ? */
  active: boolean;
  startedAt: string | null;
  endsAt: string | null;
  totalDays: number;
  /** Jours entiers restants (arrondi au supérieur), 0 une fois terminé. */
  daysLeft: number;
  /** Heures restantes (arrondi au supérieur), 0 une fois terminé. */
  hoursLeft: number;
  /** Millisecondes restantes, 0 une fois terminé. */
  remainingMs: number;
  /** Pourcentage de temps consommé, de 0 à 100. */
  elapsedPercent: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** État du compteur de 14 jours, calculé à partir de la date de départ. */
export const getTrialInfo = (
  state: Pick<SubscriptionState, 'trialStartedAt'>,
  now: Date = new Date()
): TrialInfo => {
  const startedAt = state.trialStartedAt;
  const started = startedAt ? new Date(startedAt) : null;
  const valid = started !== null && !Number.isNaN(started.getTime());
  if (!started || !valid) {
    return {
      active: false,
      startedAt: null,
      endsAt: null,
      totalDays: TRIAL_DAYS,
      daysLeft: 0,
      hoursLeft: 0,
      remainingMs: 0,
      elapsedPercent: 100,
    };
  }
  const endsAt = new Date(started.getTime() + TRIAL_DAYS * DAY_MS);
  const remainingMs = Math.max(0, endsAt.getTime() - now.getTime());
  return {
    active: remainingMs > 0,
    startedAt: started.toISOString(),
    endsAt: endsAt.toISOString(),
    totalDays: TRIAL_DAYS,
    daysLeft: Math.ceil(remainingMs / DAY_MS),
    hoursLeft: Math.ceil(remainingMs / (60 * 60 * 1000)),
    remainingMs,
    elapsedPercent: Math.min(100, Math.max(0, Math.round((1 - remainingMs / (TRIAL_DAYS * DAY_MS)) * 100))),
  };
};

/** Texte court du compteur, prêt à afficher. */
export const formatTrialRemaining = (info: TrialInfo): string => {
  if (!info.active) return 'Essai terminé';
  if (info.remainingMs <= DAY_MS) {
    return `${info.hoursLeft} h restantes`;
  }
  return `${info.daysLeft} jour${info.daysLeft > 1 ? 's' : ''} restant${info.daysLeft > 1 ? 's' : ''}`;
};

export const SUBSCRIPTION_STORAGE_KEY = 'pressingpro_subscription';

export const getSubscriptionPlan = (planId: SubscriptionPlanId): SubscriptionPlanDefinition =>
  SUBSCRIPTION_PLANS.find((plan) => plan.id === planId) ?? SUBSCRIPTION_PLANS[0];

/** Espace réel : Free, sans facturation. Démonstration : Pro, marqué « essai ». */
export const resolveDefaultSubscription = (
  scope: Pick<WorkspaceScope, 'mode'>,
  now: Date = new Date()
): SubscriptionState =>
  scope.mode === 'live'
    ? {
        plan: 'free',
        status: 'essai',
        renewsOn: null,
        // L'essai démarre au premier lancement du compte réel.
        trialStartedAt: now.toISOString(),
      }
    : { plan: 'pro', status: 'essai', renewsOn: null, trialStartedAt: null };

/**
 * Anciens noms de formules (Découverte / Standard) : une sauvegarde locale
 * antérieure reste lisible au lieu de retomber brutalement sur Free.
 * L'ancien identifiant « pro » est conservé tel quel : il correspond
 * désormais à la formule Pro, sans surclasser personne en Business.
 */
const LEGACY_PLAN_IDS: Record<string, SubscriptionPlanId> = {
  decouverte: 'free',
  standard: 'pro',
};

const isStatus = (value: unknown): value is SubscriptionStatus =>
  value === 'essai' || value === 'actif' || value === 'suspendu';

const resolvePlanId = (value: unknown): SubscriptionPlanId | null => {
  if (typeof value !== 'string') return null;
  if (value === 'free' || value === 'pro' || value === 'business') return value;
  return LEGACY_PLAN_IDS[value] ?? null;
};

/** Valide une sauvegarde locale ; toute valeur douteuse retombe sur le défaut. */
export const normalizeSubscription = (
  value: unknown,
  fallback: SubscriptionState
): SubscriptionState => {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<SubscriptionState>;
  return {
    plan: resolvePlanId(candidate.plan) ?? fallback.plan,
    status: isStatus(candidate.status) ? candidate.status : fallback.status,
    renewsOn:
      typeof candidate.renewsOn === 'string' && candidate.renewsOn.trim()
        ? candidate.renewsOn
        : null,
    trialStartedAt:
      typeof candidate.trialStartedAt === 'string' && candidate.trialStartedAt.trim()
        ? candidate.trialStartedAt
        : fallback.trialStartedAt,
  };
};

/** « 12 000 FCFA » — espace insécable fine pour la lecture à l'écran. */
export const formatXof = (amount: number): string =>
  `${new Intl.NumberFormat('fr-FR').format(Math.max(0, Math.round(amount))).replace(/\u202f|\u00a0/g, ' ')} FCFA`;

export const formatPlanLimit = (limit: PlanLimit): string =>
  limit === 'illimite' ? 'Illimité' : new Intl.NumberFormat('fr-FR').format(limit);

/** Économie réalisée en payant l'année (deux mois offerts). */
export const getYearlySavingXof = (plan: SubscriptionPlanDefinition): number =>
  Math.max(0, plan.priceMonthlyXof * 12 - plan.priceYearlyXof);

/** Reste-t-il une raison commerciale de faire évoluer ce compte ? */
export const canUpgradeFrom = (planId: SubscriptionPlanId): boolean => {
  const order = SUBSCRIPTION_PLANS.map((plan) => plan.id);
  return order.indexOf(planId) < order.length - 1;
};

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

/** Récapitulatif copiable pour envoyer sa demande à l'équipe (WhatsApp, e-mail). */
export const buildPlanRequestMessage = (input: {
  planId: SubscriptionPlanId;
  yearly: boolean;
  shopName: string;
}): string => {
  const plan = getSubscriptionPlan(input.planId);
  const price =
    plan.priceMonthlyXof === 0
      ? 'formule gratuite'
      : input.yearly
        ? `${formatXof(plan.priceYearlyXof)} / an`
        : `${formatXof(plan.priceMonthlyXof)} / mois`;
  return [
    `Bonjour, je souhaite activer la formule ${plan.label} de PressingPro pour « ${input.shopName} » (${price}).`,
    'Merci de me confirmer les modalités de mise en service.',
  ].join(' ');
};
