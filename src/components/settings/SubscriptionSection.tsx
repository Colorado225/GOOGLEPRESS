import React, { useState } from 'react';
import { Check, Clock3, Copy, Crown, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SegmentedControl } from '../common/SegmentedControl';
import {
  SUBSCRIPTION_PLANS,
  TRIAL_DAYS,
  buildPlanRequestMessage,
  formatTrialRemaining,
  getTrialInfo,
  formatPlanLimit,
  formatXof,
  getSubscriptionStatusLabel,
  getSubscriptionPlan,
  getYearlySavingXof,
  type SubscriptionPlanDefinition,
} from '../../lib/subscription';

type Billing = 'monthly' | 'yearly';

/**
 * Formules Free / Pro / Business.
 *
 * L'écran dit ce qu'il fait vraiment : le choix d'une formule enregistre une
 * **demande** sur cet appareil, aucun paiement n'étant encaissé par
 * l'application. Les limites sont des engagements commerciaux ; elles ne sont
 * pas encore bloquantes techniquement, et l'écran ne prétend pas le contraire.
 */
export const SubscriptionSection: React.FC = () => {
  const { subscription, chooseSubscriptionPlan, shopSettings, workspace, showToast } = useApp();
  const [billing, setBilling] = useState<Billing>('monthly');
  const [requested, setRequested] = useState<SubscriptionPlanDefinition | null>(null);

  const currentPlan = getSubscriptionPlan(subscription.plan);
  const trial = getTrialInfo(subscription);
  const showTrial = Boolean(subscription.trialStartedAt);

  const choose = (plan: SubscriptionPlanDefinition) => {
    chooseSubscriptionPlan(plan.id);
    setRequested(plan);
    showToast(
      plan.id === 'free'
        ? 'Formule Free sélectionnée sur cet appareil.'
        : `Formule ${plan.label} enregistrée comme demande sur cet appareil.`
    );
  };

  const requestMessage = requested
    ? buildPlanRequestMessage({
        planId: requested.id,
        yearly: billing === 'yearly',
        shopName: shopSettings.name,
      })
    : '';

  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(requestMessage);
      showToast('Demande copiée — envoyez-la à l’équipe pour activation.');
    } catch {
      showToast('Copie impossible sur cet appareil : sélectionnez le texte ci-dessous.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Formule actuelle */}
      <section className="rounded-xl border border-zinc-200/90 dark:border-zinc-700/90 bg-white dark:bg-zinc-900 p-5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <Crown className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[14.5px] font-bold text-zinc-900 dark:text-zinc-100">
                {trial.active && subscription.plan === 'free'
                  ? 'Formule Free — essai Pro en cours'
                  : `Formule ${currentPlan.label}`}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-zinc-500 dark:text-zinc-400">
                {getSubscriptionStatusLabel(subscription.status)} · {currentPlan.tagline}
              </p>
            </div>
          </div>
          <p className="text-right">
            <span className="text-[22px] font-black leading-none text-zinc-900 dark:text-zinc-50">
              {formatXof(currentPlan.priceMonthlyXof)}
            </span>
            <span className="ml-1 text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400">
              /mois
            </span>
          </p>
        </div>

        {showTrial && (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 ${
              trial.active
                ? 'border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/40'
                : 'border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p
                className={`text-[11.5px] font-bold ${
                  trial.active
                    ? 'text-blue-900 dark:text-blue-200'
                    : 'text-amber-900 dark:text-amber-200'
                }`}
              >
                {trial.active
                  ? `Essai de ${TRIAL_DAYS} jours · ${formatTrialRemaining(trial)}`
                  : 'Essai terminé'}
              </p>
              <span className="text-[11px] font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
                {trial.daysLeft} j / {TRIAL_DAYS}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={trial.elapsedPercent}
              aria-label="Temps d’essai consommé"
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/80 dark:bg-zinc-800"
            >
              <div
                className={`h-full rounded-full ${trial.active ? 'bg-blue-500' : 'bg-amber-500'}`}
                style={{ width: `${trial.elapsedPercent}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              {trial.active
                ? 'Pendant l’essai, les fonctions Pro sont ouvertes : espace client, tournées et carte, preuve de remise, rapports détaillés. À l’échéance, la formule Free reste utilisable avec ses plafonds.'
                : 'L’essai est terminé : les plafonds Free s’appliquent. Choisissez une formule pour retrouver les fonctions Pro et lever les limites.'}
            </p>
          </div>
        )}

        <p className="mt-3 flex items-start gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-[11.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-bold">Aucun paiement n’est encaissé dans l’application.</strong>{' '}
            Choisir une formule l’applique immédiatement sur cet appareil (déblocage des fonctions
            et des plafonds) et enregistre votre demande ; l’encaissement se fait avec l’équipe.
          </span>
        </p>

        {workspace.mode !== 'live' && (
          <p className="mt-2 text-[11.5px] text-zinc-500 dark:text-zinc-400">
            Démonstration locale : le choix ne change que cet appareil. Sur un compte réel, il
            s’applique à votre agence et sert de demande auprès de l’équipe.
          </p>
        )}
      </section>

      {/* Rythme de facturation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-bold text-zinc-900 dark:text-zinc-100">
            Comparer les formules
          </p>
          <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
            Payer l’année offre deux mois par rapport au mensuel.
          </p>
        </div>
        <SegmentedControl
          ariaLabel="Choisir le rythme de facturation"
          options={[
            { id: 'monthly', label: 'Mensuel' },
            { id: 'yearly', label: 'Annuel · 2 mois offerts' },
          ]}
          value={billing}
          onChange={(value) => setBilling(value as Billing)}
        />
      </div>

      {/* Les trois formules */}
      <div className="grid gap-3 md:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = plan.id === subscription.plan;
          const price = billing === 'yearly' ? plan.priceYearlyXof : plan.priceMonthlyXof;
          const saving = getYearlySavingXof(plan);
          return (
            <section
              key={plan.id}
              aria-label={`Formule ${plan.label}`}
              className={`relative flex flex-col rounded-xl border bg-white dark:bg-zinc-900 p-4 ${
                plan.highlighted
                  ? 'border-amber-300 dark:border-amber-600/60 shadow-sm'
                  : 'border-zinc-200/90 dark:border-zinc-700/90'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  Recommandé
                </span>
              )}

              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-black text-zinc-900 dark:text-zinc-50">
                  {plan.label}
                </h3>
                {isCurrent && (
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Actuelle
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">{plan.tagline}</p>

              <p className="mt-3">
                <span className="text-[24px] font-black leading-none text-zinc-900 dark:text-zinc-50">
                  {price === 0 ? 'Gratuit' : formatXof(price)}
                </span>
                {price > 0 && (
                  <span className="ml-1 text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400">
                    /{billing === 'yearly' ? 'an' : 'mois'}
                  </span>
                )}
              </p>
              {billing === 'yearly' && saving > 0 && (
                <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatXof(saving)} économisés par an
                </p>
              )}

              <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                {plan.audience}
              </p>

              <dl className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-300">
                <div>
                  <dt className="text-zinc-400 dark:text-zinc-500">Agences</dt>
                  <dd className="font-bold">{formatPlanLimit(plan.limits.shops)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400 dark:text-zinc-500">Utilisateurs</dt>
                  <dd className="font-bold">{formatPlanLimit(plan.limits.users)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400 dark:text-zinc-500">Commandes / mois</dt>
                  <dd className="font-bold">{formatPlanLimit(plan.limits.ordersPerMonth)}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400 dark:text-zinc-500">Casiers</dt>
                  <dd className="font-bold">{formatPlanLimit(plan.limits.storageLocations)}</dd>
                </div>
              </dl>

              <ul className="mt-3 flex-1 space-y-1.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-1.5 text-[11.5px] leading-snug text-zinc-700 dark:text-zinc-300"
                  >
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
                {plan.comingSoon?.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-1.5 text-[11.5px] leading-snug text-zinc-400 dark:text-zinc-500"
                  >
                    <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {feature}
                      <span className="ml-1 rounded bg-zinc-100 px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        bientôt
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={isCurrent}
                onClick={() => choose(plan)}
                className={`mt-4 w-full rounded-lg px-3 py-2 text-[12.5px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${
                  isCurrent
                    ? 'cursor-default border border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500'
                    : plan.highlighted
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {isCurrent ? 'Formule actuelle' : `Choisir ${plan.label}`}
              </button>
            </section>
          );
        })}
      </div>

      {/* Demande à transmettre */}
      {requested && (
        <section
          aria-live="polite"
          className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/50 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[12.5px] font-bold text-blue-900 dark:text-blue-200">
                Demande pour la formule {requested.label}
              </p>
              <p className="mt-0.5 text-[11.5px] text-blue-800/80 dark:text-blue-300/80">
                Enregistrée sur cet appareil. Envoyez-la à l’équipe pour activer la formule et
                convenir du paiement.
              </p>
            </div>
            <button
              type="button"
              onClick={copyRequest}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-[11.5px] font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copier la demande
            </button>
          </div>
          <textarea
            readOnly
            value={requestMessage}
            rows={3}
            aria-label="Récapitulatif de la demande d’abonnement"
            className="mt-2 w-full resize-none rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-[11.5px] text-zinc-800 dark:border-blue-900 dark:bg-zinc-900 dark:text-zinc-200"
          />
        </section>
      )}
    </div>
  );
};
