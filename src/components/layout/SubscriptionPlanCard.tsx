import React from 'react';
import { Crown, ChevronRight } from 'lucide-react';
import {
  formatTrialRemaining,
  getSubscriptionPlan,
  getSubscriptionStatusLabel,
  getSubscriptionStatusTone,
  getTrialInfo,
  type SubscriptionState,
} from '../../lib/subscription';

interface SubscriptionPlanCardProps {
  subscription: SubscriptionState;
  /**
   * Provenance de l'état : la carte ne prétend pas connaître la formule
   * quand la base n'a pas répondu.
   */
  source?: 'local' | 'chargement' | 'serveur' | 'indisponible';
  /** Barre latérale repliée : n'affiche que l'icône. */
  collapsed?: boolean;
  /** Ouvre les Paramètres (onglet boutique) pour gérer la formule. */
  onManage?: () => void;
}

/**
 * Carte du plan d'abonnement de la barre latérale.
 *
 * Elle affiche l'état réel (formule + statut) et rien de plus : aucune
 * échéance, aucun quota ni montant inventés tant que la facturation n'existe
 * pas côté serveur.
 */
export const SubscriptionPlanCard: React.FC<SubscriptionPlanCardProps> = ({
  subscription,
  source = 'local',
  collapsed = false,
  onManage,
}) => {
  const plan = getSubscriptionPlan(subscription.plan);
  const trial = getTrialInfo(subscription);
  const showTrial = Boolean(subscription.trialStartedAt);
  const tone = getSubscriptionStatusTone(subscription.status);
  const loading = source === 'chargement';
  const unverified = source === 'indisponible';
  const requestedPlan =
    subscription.requestedPlan && subscription.requestedPlan !== subscription.plan
      ? getSubscriptionPlan(subscription.requestedPlan)
      : null;
  const statusLabel = loading
    ? 'Lecture de la formule dans la base…'
    : unverified
      ? 'Abonnement non vérifié — connexion requise'
      : showTrial
        ? trial.active
          ? `Essai Pro · ${formatTrialRemaining(trial)}`
          : 'Essai terminé — formule Free'
        : getSubscriptionStatusLabel(subscription.status);
  const chipLabel = loading
    ? '…'
    : unverified
      ? '?'
      : showTrial
        ? trial.active
          ? `${trial.daysLeft} j`
          : 'terminé'
        : subscription.status;
  // Pendant l'essai, c'est Pro qui est réellement appliqué : l'afficher ainsi
  // évite le paradoxe « Free » + « fonctions Pro ouvertes ».
  const displayLabel = unverified
    ? 'Abonnement'
    : loading
      ? 'Abonnement'
      : showTrial && trial.active
        ? 'Essai Pro'
        : plan.label;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onManage}
        title={`${displayLabel} — ${statusLabel}`}
        aria-label={`Plan d’abonnement : ${displayLabel}, ${statusLabel}`}
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300 transition-colors hover:bg-amber-500/20"
      >
        <Crown className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <section
      aria-label="Plan d’abonnement"
      className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/30 p-3 text-white"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Plan d’abonnement
            </p>
            <p className="truncate text-[12.5px] font-bold leading-tight text-amber-300">
              {displayLabel}
            </p>
          </div>
        </div>
        <span
          className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${tone.chip}`}
        >
          {chipLabel}
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-zinc-400">
        {unverified
          ? 'Fonctions payantes fermées tant que la base ne répond pas.'
          : loading
            ? 'La formule vient de la base, pas de cet appareil.'
            : showTrial && trial.active
              ? 'Essai de 14 jours : fonctions Pro ouvertes.'
              : plan.tagline}
      </p>

      {requestedPlan && (
        <p className="mt-1 text-[10.5px] font-semibold text-amber-300/90">
          Demande envoyée : {requestedPlan.label}
        </p>
      )}

      <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-zinc-300">
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
        <span className="truncate">{statusLabel}</span>
      </div>

      {subscription.renewsOn && (
        <p className="mt-1 text-[10.5px] text-zinc-500">
          Échéance : {subscription.renewsOn}
        </p>
      )}

      {onManage && (
        <button
          type="button"
          onClick={onManage}
          className="mt-2.5 flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-200 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-200"
        >
          Gérer la formule
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </section>
  );
};
