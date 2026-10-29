import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  getFeatureDefinition,
  isFeatureIncluded,
  type PlanFeature,
} from '../../lib/planAccess';
import { formatXof, getSubscriptionPlan } from '../../lib/subscription';

/** Cette fonction est-elle incluse dans la formule courante ? */
export const usePlanFeature = (feature: PlanFeature): boolean => {
  const { effectivePlanId } = useApp();
  return isFeatureIncluded(effectivePlanId, feature);
};

/**
 * Panneau affiché à la place d'une fonction réservée à une formule supérieure.
 *
 * Il dit franchement ce qui manque, ce que la formule supérieure apporte et
 * son prix — puis ouvre l'onglet Abonnement. Jamais d'erreur technique, jamais
 * de bouton qui ne fait rien.
 */
export const PlanLockPanel: React.FC<{
  feature: PlanFeature;
  /** Version condensée pour une section de formulaire. */
  compact?: boolean;
  /** Précision propre à l'écran (facultatif). */
  note?: string;
}> = ({ feature, compact = false, note }) => {
  const { setActiveScreen, requestSettingsTab } = useApp();
  const definition = getFeatureDefinition(feature);
  const requiredPlan = getSubscriptionPlan(definition.requiredPlan);

  return (
    <section
      aria-label={`${definition.label} — réservé à la formule ${requiredPlan.label}`}
      className={`rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/70 dark:bg-amber-950/40 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <Lock className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold text-amber-900 dark:text-amber-200">
            {definition.label} — formule {requiredPlan.label}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-amber-900/80 dark:text-amber-200/80">
            {definition.description}
            {note ? ` ${note}` : ''}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                requestSettingsTab('subscription');
                setActiveScreen('settings');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1 text-[11.5px] font-bold text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Voir la formule {requiredPlan.label}
            </button>
            <span className="text-[11px] font-semibold text-amber-900/70 dark:text-amber-200/70">
              {requiredPlan.priceMonthlyXof === 0
                ? 'Inclus'
                : `${formatXof(requiredPlan.priceMonthlyXof)} / mois`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
