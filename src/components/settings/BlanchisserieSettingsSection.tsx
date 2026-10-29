import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Info,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import {
  BLANCHISSERIE_SERVICES,
  MAX_PRICE_XOF,
  MAX_TIERS,
  MAX_TIER_GARMENTS,
  MIN_TIER_GARMENTS,
  calculateBlanchisserieQuote,
  countPricedIronGarments,
  describeBlanchisserieQuote,
  formatGarments,
  getBlanchisserieMode,
  normalizeBlanchisserieSettings,
  validateBlanchisserieSettings,
} from '../../lib/blanchisserie';
import {
  BASE_GARMENT_IDS,
  getGarmentById,
  getGarmentCatalog,
} from '../../lib/garmentCatalog';
import type {
  BlanchisserieServiceId,
  BlanchisserieSettings,
  ClothingItem,
} from '../../types';

/**
 * Réglage de la blanchisserie.
 *
 * Le modèle est posé ici, avant toute commande : des forfaits au NOMBRE DE
 * VÊTEMENTS (20 vêtements = 3 000 FCFA) et, en complément, le prix du vêtement
 * supplémentaire. Le repassage seul se facture au vêtement, avec un prix par
 * type de vêtement (robe, pantalon, chemise…).
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
      BLANCHISSERIE_SERVICES.filter((service) => service.id !== 'iron_only').map((service) => ({
        service,
        quote:
          Number.isFinite(simulationCount) && simulationCount > 0
            ? calculateBlanchisserieQuote(draft, service.id, simulationCount)
            : null,
      })),
    [draft, simulationCount]
  );

  // Lignes de repassage : chaque identifiant est résolu vers son vêtement
  // effectif (nom et photo après retouches, vêtements masqués compris — le
  // comptoir ne proposera que les visibles, sans perdre le prix réglé).
  const ironLines = useMemo(() => {
    const lines: { id: string; item: ClothingItem; price: number; hidden: boolean }[] = [];
    for (const [id, price] of Object.entries(draft.ironPrices)) {
      const item = getGarmentById(shopSettings, id);
      if (!item) continue;
      lines.push({
        id,
        item,
        price,
        hidden: shopSettings.catalogOverrides?.[id]?.hidden === true,
      });
    }
    lines.sort((a, b) => a.item.name.localeCompare(b.item.name, 'fr'));
    return lines;
  }, [draft.ironPrices, shopSettings]);
  const pricedIronCount = useMemo(() => countPricedIronGarments(draft), [draft]);

  // Candidats à l'ajout : vêtements visibles au comptoir, pas encore en ligne.
  const ironCandidates = useMemo(
    () =>
      getGarmentCatalog(shopSettings)
        .filter((item) => draft.ironPrices[item.id] === undefined)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [draft.ironPrices, shopSettings]
  );
  const pricedIronLines = ironLines.filter((line) => line.price > 0).length;
  const unpricedIronLines = ironLines.filter((line) => line.price <= 0).length;
  const ironProgress =
    ironLines.length === 0 ? 0 : Math.round((pricedIronLines / ironLines.length) * 100);

  // Recherche unique : elle filtre à la fois les lignes tarifées et les
  // vêtements ajoutables. Insensible aux accents (« robe » trouve « Robe »).
  const [ironSearch, setIronSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fillPrice, setFillPrice] = useState('');
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const priceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const matchesSearch = (name: string): boolean => {
    const query = ironSearch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (!query) return true;
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .includes(query);
  };
  const filteredIronLines = ironLines.filter((line) => matchesSearch(line.item.name));
  const filteredIronCandidates = ironCandidates.filter((item) => matchesSearch(item.name));

  // Le curseur se place dans le prix de la ligne qui vient d'être ajoutée :
  // le propriétaire enchaîne les tarifs sans reprendre la souris.
  useEffect(() => {
    if (!lastAddedId) return;
    priceInputRefs.current[lastAddedId]?.focus();
    priceInputRefs.current[lastAddedId]?.select();
    setLastAddedId(null);
  }, [lastAddedId, draft.ironPrices]);
  const showLegacyIronBanner =
    Object.keys(draft.ironPrices).length === 0 && draft.unitPrices.iron_only > 0;

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

  const setIronPrice = (garmentId: string, rawValue: string) => {
    patch((current) => ({
      ...current,
      ironPrices: {
        ...current.ironPrices,
        [garmentId]: Math.max(0, Math.min(MAX_PRICE_XOF, Math.round(Number(rawValue) || 0))),
      },
    }));
  };

  const removeIronLine = (garmentId: string) => {
    patch((current) => {
      const ironPrices = { ...current.ironPrices };
      delete ironPrices[garmentId];
      return { ...current, ironPrices };
    });
  };

  const addIronLine = (garmentId: string) => {
    if (!garmentId) return;
    patch((current) => {
      if (current.ironPrices[garmentId] !== undefined) return current;
      return { ...current, ironPrices: { ...current.ironPrices, [garmentId]: 0 } };
    });
    setLastAddedId(garmentId);
  };

  // Saisie groupée : applique un prix aux seules lignes encore à zéro. Les
  // prix déjà réglés ne sont jamais écrasés — geste explicite, sans surprise.
  const fillUnpricedIronPrices = () => {
    const price = Math.max(0, Math.min(MAX_PRICE_XOF, Math.round(Number(fillPrice) || 0)));
    if (price <= 0) return;
    patch((current) => {
      const ironPrices = { ...current.ironPrices };
      for (const line of ironLines) {
        if (ironPrices[line.id] <= 0) ironPrices[line.id] = price;
      }
      return { ...current, ironPrices };
    });
    setFillPrice('');
  };

  // Reprise explicite de l'ancien prix unique : le propriétaire choisit de
  // l'appliquer aux vêtements visibles — rien n'est inventé sans son geste.
  const applyLegacyIronPriceToCatalog = () => {
    const legacy = draft.unitPrices.iron_only;
    if (legacy <= 0) return;
    patch((current) => {
      const ironPrices = { ...current.ironPrices };
      for (const item of getGarmentCatalog(shopSettings)) {
        if (ironPrices[item.id] === undefined) ironPrices[item.id] = legacy;
      }
      return { ...current, ironPrices };
    });
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
    const knownGarmentIds = [
      ...BASE_GARMENT_IDS,
      ...shopSettings.customGarments.map((garment) => garment.id),
    ];
    const normalized = normalizeBlanchisserieSettings(draft, knownGarmentIds);
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
          sont facturés au prix du vêtement supplémentaire. Le repassage, lui, se tarife
          <strong> par type de vêtement</strong> dans le tableau dédié ci-dessous.
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
            if (service.id === 'iron_only') {
              return (
                <div
                  key={service.id}
                  className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-700"
                >
                  <p className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400">
                    {service.emoji} {service.label}
                  </p>
                  <p className="mt-1 text-[15px] font-black tabular-nums text-zinc-900 dark:text-zinc-100">
                    {pricedIronCount} vêtement{pricedIronCount > 1 ? 's' : ''} tarifé
                    {pricedIronCount > 1 ? 's' : ''}
                  </p>
                  <p className="mt-1 text-[10.5px] leading-snug text-zinc-500 dark:text-zinc-400">
                    Prix réglés par type de vêtement dans le tableau « Prix du repassage »
                    ci-dessous. Un vêtement sans prix est bloqué au comptoir.
                  </p>
                </div>
              );
            }
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

      {/* Prix du repassage par vêtement */}
      <section className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
            Prix du repassage par vêtement
          </h3>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${
              ironLines.length > 0 && unpricedIronLines === 0
                ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {ironLines.length > 0 && unpricedIronLines === 0 && (
              <Check className="h-3 w-3" aria-hidden="true" />
            )}
            {pricedIronLines} / {ironLines.length} tarifé{pricedIronLines > 1 ? 's' : ''}
          </span>
        </div>
        {ironLines.length > 0 && (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
            role="progressbar"
            aria-valuenow={ironProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression des tarifs de repassage"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                unpricedIronLines === 0 ? 'bg-teal-600' : 'bg-amber-500'
              }`}
              style={{ width: `${ironProgress}%` }}
            />
          </div>
        )}
        {showLegacyIronBanner && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <span>
              Votre ancien prix unique ({formatFCFA(draft.unitPrices.iron_only)} par vêtement)
              peut servir de point de départ :
            </span>
            <button
              type="button"
              onClick={applyLegacyIronPriceToCatalog}
              className="rounded-lg bg-amber-600 px-2.5 py-1 text-[12px] font-bold text-white transition-colors hover:bg-amber-700"
            >
              Appliquer à tout le catalogue
            </button>
          </p>
        )}
        {ironLines.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
              <label className="sr-only" htmlFor="iron-search">
                Rechercher un vêtement
              </label>
              <input
                id="iron-search"
                type="search"
                value={ironSearch}
                onChange={(event) => setIronSearch(event.target.value)}
                placeholder="Rechercher un vêtement…"
                className={`${inputClass} py-1.5 pl-8 pr-8`}
              />
              {ironSearch && (
                <button
                  type="button"
                  onClick={() => setIronSearch('')}
                  aria-label="Effacer la recherche"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            {unpricedIronLines > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-2 py-1 dark:border-amber-800 dark:bg-amber-950/20">
                <span className="whitespace-nowrap text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                  {unpricedIronLines} sans prix :
                </span>
                <label className="sr-only" htmlFor="iron-fill-price">
                  Prix à appliquer aux lignes sans prix
                </label>
                <input
                  id="iron-fill-price"
                  type="number"
                  min={0}
                  max={MAX_PRICE_XOF}
                  step={50}
                  value={fillPrice}
                  onChange={(event) => setFillPrice(event.target.value)}
                  placeholder="500"
                  className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-[12px] tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-600 dark:border-zinc-600 dark:bg-zinc-900"
                />
                <button
                  type="button"
                  onClick={fillUnpricedIronPrices}
                  disabled={!(Number(fillPrice) > 0)}
                  title="Appliquer ce prix aux lignes encore à zéro (les prix réglés sont conservés)"
                  className="rounded-md bg-teal-600 px-2 py-1 text-[11.5px] font-bold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        )}
        {ironLines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-[12px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Aucun vêtement tarifé en repassage. Ajoutez ci-dessous les vêtements proposés
            (robe, pantalon, chemise…), puis indiquez le prix de chacun.
          </p>
        ) : filteredIronLines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-[12px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Aucun vêtement ne correspond à « {ironSearch} ».
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
            {filteredIronLines.map((line) => (
              <li
                key={line.id}
                className={`flex items-center gap-2.5 px-3 py-2 transition-colors ${
                  line.price <= 0 ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    line.price > 0 ? 'bg-teal-500' : 'bg-amber-500'
                  }`}
                  title={line.price > 0 ? 'Tarifé' : 'Sans prix — bloqué au comptoir'}
                  aria-hidden="true"
                />
                {line.item.image ? (
                  <img
                    src={line.item.image}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xl dark:bg-zinc-800" aria-hidden="true">
                    {line.item.emoji}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100">
                    <span className="truncate">{line.item.name}</span>
                    {line.hidden && (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        Masqué
                      </span>
                    )}
                  </p>
                  <p className={`truncate text-[11px] ${
                    line.price <= 0
                      ? 'font-semibold text-amber-600 dark:text-amber-400'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}>
                    {line.price <= 0
                      ? 'Sans prix — bloqué au comptoir'
                      : line.hidden
                        ? 'Prix conservé, invisible au comptoir'
                        : `Par ${line.item.unitLabel ?? 'pièce'}`}
                  </p>
                </div>
                <label className="sr-only" htmlFor={`iron-${line.id}`}>
                  Prix du repassage pour {line.item.name}
                </label>
                <input
                  ref={(element) => {
                    priceInputRefs.current[line.id] = element;
                  }}
                  id={`iron-${line.id}`}
                  type="number"
                  min={0}
                  max={MAX_PRICE_XOF}
                  step={50}
                  value={line.price}
                  onChange={(event) => setIronPrice(line.id, event.target.value)}
                  aria-invalid={line.price <= 0}
                  className={`w-24 shrink-0 rounded-lg border bg-white px-2 py-1.5 text-right text-[13px] tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-600 dark:bg-zinc-900 dark:text-zinc-100 ${
                    line.price <= 0
                      ? 'border-amber-400 dark:border-amber-700'
                      : 'border-zinc-300 dark:border-zinc-600'
                  }`}
                />
                <span className="hidden w-9 shrink-0 text-[11px] text-zinc-500 sm:inline dark:text-zinc-400">
                  FCFA
                </span>
                <button
                  type="button"
                  onClick={() => removeIronLine(line.id)}
                  aria-label={`Retirer ${line.item.name} du repassage`}
                  title={`Retirer ${line.item.name}`}
                  className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {ironCandidates.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              aria-expanded={pickerOpen}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-zinc-300 px-3 py-2.5 text-[12.5px] font-semibold text-zinc-700 transition-colors hover:border-teal-500 hover:bg-teal-50/50 hover:text-teal-800 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-teal-500 dark:hover:bg-teal-950/20 dark:hover:text-teal-200"
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Ajouter un vêtement
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-[11px] font-bold tabular-nums text-zinc-400 dark:text-zinc-500">
                  {ironCandidates.length} disponible{ironCandidates.length > 1 ? 's' : ''}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${pickerOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </span>
            </button>
            {pickerOpen && (
              filteredIronCandidates.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-zinc-300 p-3 text-center text-[12px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  {ironSearch
                    ? `Aucun vêtement à ajouter ne correspond à « ${ironSearch} ».`
                    : 'Tous les vêtements visibles sont déjà tarifés.'}
                </p>
              ) : (
                <div className="mt-2 grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-zinc-200 p-2 sm:grid-cols-3 dark:border-zinc-700">
                  {filteredIronCandidates.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addIronLine(item.id)}
                      title={`Tarifer ${item.name} en repassage`}
                      className="group flex items-center gap-2 rounded-lg border border-zinc-200 p-1.5 text-left transition-colors hover:border-teal-500 hover:bg-teal-50/60 dark:border-zinc-700 dark:hover:border-teal-500 dark:hover:bg-teal-950/20"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-base dark:bg-zinc-800" aria-hidden="true">
                          {item.emoji}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-zinc-700 dark:text-zinc-200">
                        {item.name}
                      </span>
                      <Plus className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-colors group-hover:text-teal-600 dark:text-zinc-600 dark:group-hover:text-teal-400" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        )}
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
          <li className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[12px]">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              ♨️ Repassage
            </span>
            {pricedIronCount > 0 ? (
              <span className="text-zinc-600 dark:text-zinc-400">
                {pricedIronCount} vêtement{pricedIronCount > 1 ? 's' : ''} tarifé
                {pricedIronCount > 1 ? 's' : ''} — saisie au comptoir
              </span>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500">non tarifé</span>
            )}
          </li>
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
