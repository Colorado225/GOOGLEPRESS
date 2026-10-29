import React, { useMemo, useState } from 'react';
import { ArrowRight, Info, Minus, Plus, Settings2, ShoppingBag } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import {
  BLANCHISSERIE_SERVICES,
  buildBlanchisserieItem,
  calculateBlanchisserieQuote,
  calculateIroningQuote,
  describeBlanchisserieQuote,
  formatGarments,
  getBlanchisserieMode,
  getIronPrice,
  getServiceTiers,
  isBlanchisserieConfigured,
  type IroningQuoteLine,
} from '../../lib/blanchisserie';
import { getGarmentCatalog } from '../../lib/garmentCatalog';
import type { BlanchisserieServiceId, ClothingItem } from '../../types';

/**
 * Comptoir blanchisserie.
 *
 * Le caissier choisit la prestation (lavage simple, lavage + repassage,
 * repassage). Pour les lavages, il saisit le NOMBRE DE VÊTEMENTS déposés, et
 * l'application applique la grille réglée dans les Paramètres : le plus gros
 * forfait possible, puis les vêtements restants au prix du vêtement
 * supplémentaire. Pour le repassage, il sélectionne les vêtements sur des
 * cartes avec photos : chacun est facturé à son prix réglé, et un vêtement
 * sans prix est bloqué avec un renvoi vers les Paramètres.
 */
export const BlanchisserieCounter: React.FC = () => {
  const {
    shopSettings,
    addCartItem,
    showToast,
    setActiveScreen,
    requestSettingsTab,
  } = useApp();

  const settings = shopSettings.blanchisserie;
  const configured = isBlanchisserieConfigured(settings);

  const [serviceId, setServiceId] = useState<BlanchisserieServiceId>('wash_iron');
  const [garmentInput, setGarmentInput] = useState('20');
  const [ironQuantities, setIronQuantities] = useState<Record<string, number>>({});
  const [selectedGarmentTypes, setSelectedGarmentTypes] = useState<string[]>([]);

  const garments = Math.max(0, Math.min(500, Math.round(Number(garmentInput) || 0)));

  // Vêtements proposés en repassage : lignes tarifées du propriétaire croisées
  // avec le catalogue visible (photos et noms effectifs, masqués exclus).
  const ironGarments = useMemo(() => {
    const catalog = getGarmentCatalog(shopSettings);
    const garments: { item: ClothingItem; price: number }[] = [];
    for (const item of catalog) {
      if (settings.ironPrices[item.id] === undefined) continue;
      garments.push({ item, price: getIronPrice(settings, item.id) });
    }
    garments.sort((a, b) => a.item.name.localeCompare(b.item.name, 'fr'));
    return garments;
  }, [settings, shopSettings]);

  const ironLines = useMemo<IroningQuoteLine[]>(
    () =>
      ironGarments
        .filter(({ item, price }) => price > 0 && (ironQuantities[item.id] ?? 0) > 0)
        .map(({ item }) => ({ item, quantity: ironQuantities[item.id] })),
    [ironGarments, ironQuantities]
  );

  const quote = useMemo(
    () =>
      serviceId === 'iron_only'
        ? calculateIroningQuote(settings, ironLines)
        : garments > 0
          ? calculateBlanchisserieQuote(settings, serviceId, garments)
          : null,
    [settings, serviceId, garments, ironLines]
  );

  const mode = getBlanchisserieMode(settings, serviceId);
  const tiers = getServiceTiers(settings, serviceId);
  const suggestedCounts = tiers.slice(0, 4).map((tier) => tier.garments);

  const setCount = (next: number) => {
    setGarmentInput(String(Math.max(0, Math.min(500, Math.round(next)))));
  };

  const setIronQuantity = (garmentId: string, next: number) => {
    const quantity = Math.max(0, Math.min(500, Math.round(next)));
    setIronQuantities((current) => ({ ...current, [garmentId]: quantity }));
  };

  const toggleGarmentType = (name: string) => {
    setSelectedGarmentTypes((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name]
    );
  };

  const handleUnpricedIron = (name: string) => {
    showToast(`« ${name} » n’a pas de prix de repassage — définissez-le dans Paramètres → Blanchisserie.`);
  };

  const openSettings = () => {
    requestSettingsTab('services');
    setActiveScreen('settings');
  };

  const addToCart = () => {
    if (!quote) return;
    for (const block of quote.blocks) {
      addCartItem(
        buildBlanchisserieItem(block),
        quote.serviceLabel,
        block.quantity,
        undefined,
        {
          garments: block.garments,
          pricingBasis: block.kind,
          blanchisserieService: block.serviceId,
        }
      );
    }
    showToast(
      `✓ ${formatGarments(quote.garments)} — ${quote.serviceLabel} ajoutés (${formatFCFA(quote.subtotal)})`
    );
    setGarmentInput('0');
    setIronQuantities({});
  };

  if (!configured) {
    return (
      <div className="rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/40 p-6 text-center dark:border-teal-800 dark:bg-teal-950/20">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-200">
          <Settings2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-3 text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
          La grille blanchisserie n’est pas encore définie
        </p>
        <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-snug text-zinc-600 dark:text-zinc-400">
          Indiquez d’abord vos forfaits (nombre de vêtements et prix) et le prix du vêtement
          supplémentaire. Aucun tarif n’est inventé à votre place.
        </p>
        <button
          type="button"
          onClick={openSettings}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-teal-700"
        >
          Définir la grille
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Choix de la prestation */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-3 shadow-2xs dark:border-zinc-700/90 dark:bg-zinc-900">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Prestation
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {BLANCHISSERIE_SERVICES.map((service) => {
            const active = service.id === serviceId;
            const serviceMode = getBlanchisserieMode(settings, service.id);
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => setServiceId(service.id)}
                aria-pressed={active}
                className={`rounded-xl border-2 p-3 text-left transition-all duration-200 ${
                  active
                    ? 'border-teal-600 bg-teal-50/60 shadow-sm dark:bg-teal-950/30'
                    : 'border-zinc-200 hover:border-teal-300 dark:border-zinc-700 dark:hover:border-teal-700'
                }`}
              >
                <span className="text-lg" aria-hidden="true">
                  {service.emoji}
                </span>
                <p className="mt-1 text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                  {service.label}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                  {serviceMode === 'forfait' ? 'Au forfait' : 'Au vêtement'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {serviceId === 'iron_only' ? (
        <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs dark:border-zinc-700/90 dark:bg-zinc-900">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Vêtements à repasser
          </p>
          {ironGarments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-[12.5px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Aucun vêtement tarifé en repassage.{' '}
              <button
                type="button"
                onClick={openSettings}
                className="font-bold text-teal-700 underline dark:text-teal-300"
              >
                Définir les prix
              </button>
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ironGarments.map(({ item, price }) => {
                const quantity = ironQuantities[item.id] ?? 0;
                const priced = price > 0;
                return (
                  <div
                    key={item.id}
                    className={`flex min-h-[150px] flex-col items-center justify-between rounded-xl border-1.5 p-2.5 text-center transition-all duration-200 ${
                      quantity > 0
                        ? 'border-teal-600 bg-teal-50/60 dark:bg-teal-950/30'
                        : 'border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="h-14 w-14 rounded-lg object-cover shadow-xs"
                      />
                    ) : (
                      <span className="text-3xl" aria-hidden="true">
                        {item.emoji}
                      </span>
                    )}
                    <p className="mt-1 text-[12px] font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                      {item.name}
                    </p>
                    {priced ? (
                      <p className="text-[11.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatFCFA(price)}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUnpricedIron(item.name)}
                        className="mt-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900"
                      >
                        Non tarifé
                      </button>
                    )}
                    {priced ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIronQuantity(item.id, quantity - 1)}
                          aria-label={`Retirer ${item.name}`}
                          className="rounded-lg border border-zinc-300 p-1 text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span
                          className="w-6 text-center text-[13px] font-black tabular-nums text-zinc-900 dark:text-zinc-100"
                          aria-live="polite"
                        >
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIronQuantity(item.id, quantity + 1)}
                          aria-label={`Ajouter ${item.name}`}
                          className="rounded-lg border border-zinc-300 p-1 text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <span className="mt-1.5 text-[10.5px] leading-tight text-zinc-400 dark:text-zinc-500">
                        Touchez « Non tarifé »
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
      {/* Nombre de vêtements */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs dark:border-zinc-700/90 dark:bg-zinc-900">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <label
              htmlFor="blanchisserie-garments"
              className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              Nombre de vêtements déposés
            </label>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCount(garments - 1)}
                aria-label="Retirer un vêtement"
                className="rounded-lg border border-zinc-300 p-1.5 text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <input
                id="blanchisserie-garments"
                type="number"
                min={0}
                max={500}
                value={garmentInput}
                onChange={(event) => setGarmentInput(event.target.value)}
                className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-center text-[15px] font-bold tabular-nums text-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => setCount(garments + 1)}
                aria-label="Ajouter un vêtement"
                className="rounded-lg border border-zinc-300 p-1.5 text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {suggestedCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Forfaits :
              </span>
              {suggestedCounts.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setCount(count)}
                  className="rounded-full border border-zinc-300 px-2.5 py-1 text-[11.5px] font-bold tabular-nums text-zinc-700 transition-colors hover:border-teal-500 hover:text-teal-700 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-teal-500 dark:hover:text-teal-300"
                >
                  {count}
                </button>
              ))}
            </div>
          )}
        </div>

      {/* Catalogue des vêtements déposés : sélection indicative des types de pièces */}
      <div className="rounded-xl border border-zinc-200/90 bg-white p-3 shadow-2xs dark:border-zinc-700/90 dark:bg-zinc-900">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Catalogue des vêtements déposés
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {getGarmentCatalog(shopSettings).map((g) => {
            const active = selectedGarmentTypes.includes(g.name);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGarmentType(g.name)}
                className={`flex flex-col items-center rounded-xl border-1.5 p-2 text-center transition-all ${
                  active
                    ? 'border-teal-600 bg-teal-50/60 dark:bg-teal-950/30'
                    : 'border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {g.image ? (
                  <img src={g.image} alt="" className="h-12 w-12 rounded-lg object-cover shadow-xs" />
                ) : (
                  <span className="text-2xl" aria-hidden="true">{g.emoji}</span>
                )}
                <span className="mt-1 text-[11px] font-bold leading-tight text-zinc-900 dark:text-zinc-100">{g.name}</span>
              </button>
            );
          })}
        </div>
        {selectedGarmentTypes.length > 0 && (
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Pièces sélectionnées : {selectedGarmentTypes.join(', ')}
          </p>
        )}
      </div>

        {mode === 'per_garment' && (
          <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {BLANCHISSERIE_SERVICES.find((service) => service.id === serviceId)?.label} est
            facturé au vêtement : {formatFCFA(settings.unitPrices[serviceId])} par vêtement.
          </p>
        )}
      </div>
        </>
      )}

      {/* Devis */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-2xs dark:border-zinc-700/90 dark:bg-zinc-900">
        <div className="flex items-center justify-between bg-teal-950 px-4 py-2.5 text-white">
          <p className="text-[13px] font-bold">Détail du prix</p>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase">
            Blanchisserie
          </span>
        </div>

        <div className="space-y-2 p-4">
          {!quote ? (
            <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-[12.5px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              {serviceId === 'iron_only'
                ? ironGarments.length === 0
                  ? 'Aucun vêtement tarifé en repassage — définissez les prix dans les Paramètres.'
                  : 'Sélectionnez les vêtements à repasser.'
                : garments === 0
                  ? 'Saisissez le nombre de vêtements déposés.'
                  : `Aucun forfait ne permet de couvrir exactement ${formatGarments(garments)}. Ajoutez un prix au vêtement dans les Paramètres.`}
            </p>
          ) : (
            <>
              <ul className="space-y-1.5">
                {quote.blocks.map((block) => (
                  <li key={block.key} className="flex items-baseline justify-between gap-2 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                      {block.quantity} × {block.name}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatFCFA(block.subtotal)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {describeBlanchisserieQuote(quote)} • {formatGarments(quote.garments)} couverts
              </p>
              <div className="flex items-baseline justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <span className="text-[12.5px] font-bold text-zinc-700 dark:text-zinc-300">
                  Total
                </span>
                <span className="text-[16px] font-black tabular-nums text-teal-700 dark:text-teal-300">
                  {formatFCFA(quote.subtotal)}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Soit {formatFCFA(quote.averagePerGarment)} par vêtement en moyenne.
              </p>
            </>
          )}

          <button
            type="button"
            onClick={addToCart}
            disabled={!quote}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            Ajouter au panier
          </button>
        </div>
      </div>
    </div>
  );
};
