import React, { useMemo, useState } from 'react';
import { AlertTriangle, Info, Plus, Save, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import {
  BLANCHISSERIE_SERVICES,
  MAX_PRICE_XOF,
  MAX_TIERS,
  MAX_TIER_GARMENTS,
  MIN_TIER_GARMENTS,
  calculateBlanchisserieQuote,
  describeBlanchisserieQuote,
  formatGarments,
  getBlanchisserieMode,
  normalizeBlanchisserieSettings,
  validateBlanchisserieSettings,
} from '../../lib/blanchisserie';
import type { BlanchisserieServiceId, BlanchisserieSettings } from '../../types';

/**
 * Réglage de la blanchisserie.
 *
 * Le modèle est posé ici, avant toute commande : des forfaits au NOMBRE DE
 * VÊTEMENTS (20 vêtements = 3 000 FCFA) et, en complément, le prix du vêtement
 * supplémentaire. Le repassage seul se facture au vêtement par défaut.
 */
export const BlanchisserieSettingsSection: React.FC = () => {
  const { shopSettings, updateShopSettings, showToast } = useApp();
  const [draft, setDraft] = useState<BlanchisserieSettings>(shopSettings.blanchisserie);
  const [error, setError] = useState<string | null>(null);
  const [simulation, setSimulation] = useState('20');

  const forfaitServices = BLANCHISSERIE_SERVICES.filter(
    (service) => getBlanchisserieMode(draft, service.id) === 'forfait'
  );

  const simulationCount = Math.round(Number(simulation));
  const simulations = useMemo(
    () =>
      BLANCHISSERIE_SERVICES.map((service) => ({
        service,
        quote:
          Number.isFinite(simulationCount) && simulationCount > 0
            ? calculateBlanchisserieQuote(draft, service.id, simulationCount)
            : null,
      })),
    [draft, simulationCount]
  );

  const patch = (updater: (current: BlanchisserieSettings) => BlanchisserieSettings) => {
    setError(null);
    setDraft((current) => updater(current));
  };

  const setTierField = (
    tierId: string,
    field: 'garments' | BlanchisserieServiceId,
    rawValue: string
  ) => {
    patch((current) => ({
      ...current,
      tiers: current.tiers.map((tier) => {
        if (tier.id !== tierId) return tier;
        const value = Math.max(0, Math.min(MAX_PRICE_XOF, Math.round(Number(rawValue) || 0)));
        if (field === 'garments') {
          return { ...tier, garments: Math.min(MAX_TIER_GARMENTS, value) };
        }
        return { ...tier, prices: { ...tier.prices, [field]: value } };
      }),
    }));
  };

  const setUnitPrice = (serviceId: BlanchisserieServiceId, rawValue: string) => {
    patch((current) => ({
      ...current,
      unitPrices: {
        ...current.unitPrices,
        [serviceId]: Math.max(0, Math.min(MAX_PRICE_XOF, Math.round(Number(rawValue) || 0))),
      },
    }));
  };

  const togglePerGarment = (serviceId: BlanchisserieServiceId) => {
    patch((current) => ({
      ...current,
      perGarment: { ...current.perGarment, [serviceId]: !current.perGarment[serviceId] },
    }));
  };

  const addTier = () => {
    patch((current) => {
      if (current.tiers.length >= MAX_TIERS) return current;
      const last = current.tiers.reduce((max, tier) => Math.max(max, tier.garments), 0);
      const garments = Math.max(MIN_TIER_GARMENTS, Math.min(MAX_TIER_GARMENTS, last > 0 ? last + 10 : 10));
      if (current.tiers.some((tier) => tier.garments === garments)) return current;
      return {
        ...current,
        tiers: [
          ...current.tiers,
          {
            id: `tier-${garments}-${Date.now().toString(36)}`,
            garments,
            prices: { wash_only: 0, wash_iron: 0, iron_only: 0 },
          },
        ].sort((a, b) => a.garments - b.garments),
      };
    });
  };

  const removeTier = (tierId: string) => {
    patch((current) => ({
      ...current,
      tiers: current.tiers.filter((tier) => tier.id !== tierId),
    }));
  };

  const save = () => {
    const normalized = normalizeBlanchisserieSettings(draft);
    const validationError = validateBlanchisserieSettings(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }
    updateShopSettings({ ...shopSettings, blanchisserie: normalized });
    setDraft(normalized);
    setError(null);
    showToast('✓ Grille blanchisserie enregistrée');
  };

  const inputClass =
    'w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-600';

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-5 shadow-2xs space-y-5 text-[13px]">
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-teal-600 dark:text-teal-400" aria-hidden="true">
          🧺
        </span>
        <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100">
          Prestations de blanchisserie
        </h2>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50/70 p-3 text-[12px] leading-snug text-teal-900 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Les forfaits portent sur un <strong>nombre de vêtements</strong>, jamais sur un poids.
          Exemple : 20 vêtements pour 3 000 FCFA. Les vêtements qui dépassent le dernier palier
          sont facturés au prix du vêtement supplémentaire.
        </span>
      </p>

      {/* Grille des forfaits */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
            Grille des forfaits
          </h3>
          <button
            type="button"
            onClick={addTier}
            disabled={draft.tiers.length >= MAX_TIERS}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Ajouter un palier
          </button>
        </div>

        {draft.tiers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-[12px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Aucun forfait défini. Ajoutez un palier (par exemple 20 vêtements) pour ouvrir la
            blanchisserie au comptoir.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="py-1.5 pr-2 font-bold">Vêtements</th>
                  {forfaitServices.map((service) => (
                    <th key={service.id} className="py-1.5 pr-2 font-bold">
                      {service.label} (FCFA)
                    </th>
                  ))}
                  <th className="w-10 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {draft.tiers.map((tier) => (
                  <tr key={tier.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 pr-2">
                      <label className="sr-only" htmlFor={`tier-garments-${tier.id}`}>
                        Nombre de vêtements du forfait
                      </label>
                      <input
                        id={`tier-garments-${tier.id}`}
                        type="number"
                        min={MIN_TIER_GARMENTS}
                        max={MAX_TIER_GARMENTS}
                        value={tier.garments}
                        onChange={(event) => setTierField(tier.id, 'garments', event.target.value)}
                        className={`${inputClass} w-24`}
                      />
                    </td>
                    {forfaitServices.map((service) => (
                      <td key={service.id} className="py-1.5 pr-2">
                        <label className="sr-only" htmlFor={`tier-${tier.id}-${service.id}`}>
                          Prix {service.label} pour {formatGarments(tier.garments)}
                        </label>
                        <input
                          id={`tier-${tier.id}-${service.id}`}
                          type="number"
                          min={0}
                          max={MAX_PRICE_XOF}
                          step={50}
                          value={tier.prices[service.id]}
                          onChange={(event) =>
                            setTierField(tier.id, service.id, event.target.value)
                          }
                          className={`${inputClass} w-28`}
                        />
                      </td>
                    ))}
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeTier(tier.id)}
                        aria-label={`Supprimer le forfait de ${formatGarments(tier.garments)}`}
                        className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {draft.tiers.length > 0 && forfaitServices.length === 0 && (
          <p className="text-[11.5px] text-amber-600 dark:text-amber-400">
            Les deux prestations au forfait sont réglées « au vêtement » : la grille n’est pas
            utilisée.
          </p>
        )}
      </section>

      {/* Prix à l'unité et mode de facturation */}
      <section className="space-y-2">
        <h3 className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
          Prix du vêtement
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {BLANCHISSERIE_SERVICES.map((service) => {
            const perGarment = getBlanchisserieMode(draft, service.id) === 'per_garment';
            return (
              <div
                key={service.id}
                className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-700"
              >
                <label
                  htmlFor={`unit-${service.id}`}
                  className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400"
                >
                  {service.label}
                </label>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    id={`unit-${service.id}`}
                    type="number"
                    min={0}
                    max={MAX_PRICE_XOF}
                    step={50}
                    value={draft.unitPrices[service.id]}
                    onChange={(event) => setUnitPrice(service.id, event.target.value)}
                    className={inputClass}
                  />
                  <span className="text-[11.5px] text-zinc-500 dark:text-zinc-400">FCFA</span>
                </div>
                <p className="mt-1 text-[10.5px] leading-snug text-zinc-500 dark:text-zinc-400">
                  {perGarment
                    ? 'Facturée au vêtement (pas de forfait).'
                    : 'Vêtements au-delà du dernier palier utilisable.'}
                </p>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11.5px] text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={perGarment}
                    onChange={() => togglePerGarment(service.id)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-teal-600 focus:ring-teal-600"
                  />
                  Facturer au vêtement
                </label>
              </div>
            );
          })}
        </div>
      </section>

      {/* Simulation */}
      <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
            Aperçu d’un dépôt
          </h3>
          <div className="flex items-center gap-2">
            <label htmlFor="simulation-count" className="text-[11.5px] text-zinc-600 dark:text-zinc-400">
              Nombre de vêtements
            </label>
            <input
              id="simulation-count"
              type="number"
              min={1}
              value={simulation}
              onChange={(event) => setSimulation(event.target.value)}
              className={`${inputClass} w-20`}
            />
          </div>
        </div>
        <ul className="mt-2 space-y-1.5">
          {simulations.map(({ service, quote }) => (
            <li
              key={service.id}
              className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[12px]"
            >
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {service.emoji} {service.label}
              </span>
              {quote ? (
                <span className="text-zinc-600 dark:text-zinc-400">
                  {describeBlanchisserieQuote(quote)} ={' '}
                  <strong className="text-zinc-900 dark:text-zinc-100">
                    {formatFCFA(quote.subtotal)}
                  </strong>
                </span>
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500">non tarifé</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[12px] font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-teal-700"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Enregistrer la grille
        </button>
      </div>
    </div>
  );
};
