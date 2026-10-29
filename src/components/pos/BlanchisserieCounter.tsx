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
 * supplémentaire. Le catalogue répartit ce total par type avec +/−, sans
 * influence du type sur le prix, et bloque les ajouts lorsque le reste est à 0.
 * Pour le repassage, il sélectionne les vêtements sur des
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
  // Répartition du dépôt de lavage : une quantité par vêtement, plutôt qu'une
  // simple liste de types cochés. La somme ne peut jamais dépasser le total.
  const [washQuantities, setWashQuantities] = useState<Record<string, number>>({});

  const garments = Math.max(0, Math.min(500, Math.round(Number(garmentInput) || 0)));
  const washGarments = useMemo(() => getGarmentCatalog(shopSettings), [shopSettings]);

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

  const washSelectedLines = useMemo(
    () =>
      washGarments
        .filter((item) => (washQuantities[item.id] ?? 0) > 0)
        .map((item) => ({ item, quantity: washQuantities[item.id] })),
    [washGarments, washQuantities]
  );
  const selectedGarmentTotal = washSelectedLines.reduce(
    (total, line) => total + line.quantity,
    0
  );
  const remainingGarments = Math.max(0, garments - selectedGarmentTotal);
  const washSelectionComplete = garments > 0 && selectedGarmentTotal === garments;

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
    // Ne jamais supprimer silencieusement des pièces déjà identifiées : pour
    // réduire davantage le total, le caissier libère d'abord des quantités.
    const minimum = selectedGarmentTotal;
    setGarmentInput(String(Math.max(minimum, Math.min(500, Math.round(next)))));
  };

  const handleGarmentInput = (value: string) => {
    if (value === '') {
      setGarmentInput(selectedGarmentTotal === 0 ? '' : String(selectedGarmentTotal));
      return;
    }
    const next = Number(value);
    if (Number.isFinite(next)) setCount(next);
  };

  const setIronQuantity = (garmentId: string, next: number) => {
    const quantity = Math.max(0, Math.min(500, Math.round(next)));
    setIronQuantities((current) => ({ ...current, [garmentId]: quantity }));
  };

  const changeWashQuantity = (garmentId: string, delta: -1 | 1) => {
    setWashQuantities((current) => {
      const currentTotal = Object.values(current).reduce((total, quantity) => total + quantity, 0);
      if (delta > 0 && (garments === 0 || currentTotal >= garments)) return current;
      const quantity = Math.max(0, (current[garmentId] ?? 0) + delta);
      return { ...current, [garmentId]: quantity };
    });
  };

  const handleUnpricedIron = (name: string) => {
    showToast(`« ${name} » n’a pas de prix de repassage — définissez-le dans Paramètres → Blanchisserie.`);
  };

  const openSettings = () => {
    requestSettingsTab('services');
    setActiveScreen('settings');
  };

  const canAddToCart = Boolean(
    quote && (serviceId === 'iron_only' || washSelectionComplete)
  );

  const addToCart = () => {
    if (!quote || !canAddToCart) return;
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
    setWashQuantities({});
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
          {/* Capacité du dépôt : chaque sélection du catalogue consomme une pièce. */}
          <section
            aria-labelledby="blanchisserie-count-title"
            className="rounded-xl border border-zinc-200/90 bg-white p-4 shadow-2xs dark:border-zinc-700/90 dark:bg-zinc-900"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <label
                  id="blanchisserie-count-title"
                  htmlFor="blanchisserie-garments"
                  className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  Nombre de vêtements déposés
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCount(garments - 1)}
                    disabled={garments <= selectedGarmentTotal}
                    aria-label="Retirer un vêtement"
                    className="rounded-lg border border-zinc-300 p-1.5 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <input
                    id="blanchisserie-garments"
                    type="number"
                    min={selectedGarmentTotal}
                    max={500}
                    value={garmentInput}
                    onChange={(event) => handleGarmentInput(event.target.value)}
                    className="pos-field pos-field-compact pos-field-teal w-20 text-center text-[15px] font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setCount(garments + 1)}
                    disabled={garments >= 500}
                    aria-label="Ajouter un vêtement"
                    className="rounded-lg border border-zinc-300 p-1.5 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
                      disabled={count < selectedGarmentTotal}
                      className="rounded-full border border-zinc-300 px-2.5 py-1 text-[11.5px] font-bold tabular-nums text-zinc-700 transition-colors hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-teal-500 dark:hover:text-teal-300"
                    >
                      {count}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              role="status"
              aria-live="polite"
              className={`mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[12px] ${
                garments > 0 && remainingGarments === 0
                  ? 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                  : 'border-teal-200 bg-teal-50/70 text-teal-900 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-100'
              }`}
            >
              <span className="font-bold">
                {garments === 0
                  ? 'Saisissez d’abord le nombre de vêtements'
                  : remainingGarments === 0
                    ? '0 restant — sélection complète'
                    : `${formatGarments(remainingGarments)} à répartir`}
              </span>
              <span className="shrink-0 font-black tabular-nums">
                {selectedGarmentTotal} / {garments} répartis
              </span>
            </div>

            {mode === 'per_garment' && (
              <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {BLANCHISSERIE_SERVICES.find((service) => service.id === serviceId)?.label} est
                facturé au vêtement : {formatFCFA(settings.unitPrices[serviceId])} par vêtement.
              </p>
            )}
          </section>

          {/* Allocation interactive : + consomme une pièce, − la restitue. */}
          <section
            aria-labelledby="blanchisserie-catalog-title"
            className="rounded-xl border border-zinc-200/90 bg-white p-3 shadow-2xs dark:border-zinc-700/90 dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3
                  id="blanchisserie-catalog-title"
                  className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                >
                  Catalogue des vêtements déposés
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                  Cliquez sur un vêtement pour l’ajouter, puis ajustez avec + ou −.
                </p>
              </div>
              {selectedGarmentTotal > 0 && (
                <button
                  type="button"
                  onClick={() => setWashQuantities({})}
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:text-teal-300 dark:hover:bg-teal-950/50"
                >
                  Effacer la sélection
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {washGarments.map((garment) => {
                const quantity = washQuantities[garment.id] ?? 0;
                const selected = quantity > 0;
                const cannotAdd = remainingGarments === 0;
                const greyed = cannotAdd && !selected;
                return (
                  <div
                    key={garment.id}
                    className={`flex min-h-[164px] flex-col rounded-xl border-1.5 p-2 text-center transition-all duration-200 ${
                      selected
                        ? 'border-teal-600 bg-teal-50/60 shadow-sm dark:bg-teal-950/30'
                        : greyed
                          ? 'border-zinc-200 bg-zinc-100 opacity-55 grayscale dark:border-zinc-800 dark:bg-zinc-900'
                          : 'border-zinc-200 bg-white hover:border-teal-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-teal-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => changeWashQuantity(garment.id, 1)}
                      disabled={cannotAdd}
                      aria-label={`Sélectionner ${garment.name}`}
                      title={cannotAdd ? 'Retirez une pièce avec − pour modifier la sélection' : `Ajouter ${garment.name} au dépôt`}
                      className="flex flex-1 flex-col items-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:cursor-not-allowed"
                    >
                      {garment.image ? (
                        <img src={garment.image} alt="" className="h-12 w-12 rounded-lg object-cover shadow-xs" />
                      ) : (
                        <span className="text-2xl" aria-hidden="true">{garment.emoji}</span>
                      )}
                      <span className="mt-1 text-[11px] font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                        {garment.name}
                      </span>
                      <span className="mt-1 text-[9.5px] font-semibold leading-tight text-zinc-400 dark:text-zinc-500">
                        {selected ? `${quantity} dans le dépôt` : cannotAdd ? 'Complet' : 'Cliquer pour ajouter'}
                      </span>
                    </button>

                    <div className="mt-1.5 flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => changeWashQuantity(garment.id, -1)}
                        disabled={quantity === 0}
                        aria-label={`Retirer une pièce : ${garment.name}`}
                        className="rounded-lg border border-zinc-300 p-1 text-zinc-600 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <output
                        aria-label={`Quantité de ${garment.name}`}
                        className="w-6 text-center text-[13px] font-black tabular-nums text-zinc-900 dark:text-zinc-100"
                      >
                        {quantity}
                      </output>
                      <button
                        type="button"
                        onClick={() => changeWashQuantity(garment.id, 1)}
                        disabled={cannotAdd}
                        aria-label={`Ajouter une pièce : ${garment.name}`}
                        className="rounded-lg border border-zinc-300 p-1 text-zinc-600 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Composition du dépôt et devis : les types choisis sont visibles sans
          changer le tarif, qui reste basé sur le nombre total déclaré. */}
      <section
        aria-labelledby="blanchisserie-quote-title"
        className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-2xs dark:border-zinc-700/90 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between bg-teal-950 px-4 py-2.5 text-white">
          <h3 id="blanchisserie-quote-title" className="text-[13px] font-bold">Détail du prix</h3>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase">
            Blanchisserie
          </span>
        </div>

        <div className="space-y-3 p-4">
          {serviceId !== 'iron_only' && (
            <section
              aria-label="Vêtements du dépôt"
              className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-950/50"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                  Vêtements du dépôt
                </h4>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-black tabular-nums text-teal-700 shadow-2xs dark:bg-zinc-800 dark:text-teal-300">
                  {selectedGarmentTotal} / {garments}
                </span>
              </div>

              {washSelectedLines.length === 0 ? (
                <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Cliquez sur un vêtement du catalogue : son nom, sa description et sa quantité apparaîtront ici.
                </p>
              ) : (
                <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">
                  {washSelectedLines.map(({ item, quantity }) => (
                    <li key={item.id} className="flex items-center gap-2.5 rounded-lg bg-white p-2 shadow-2xs dark:bg-zinc-900">
                      {item.image ? (
                        <img src={item.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center text-xl" aria-hidden="true">
                          {item.emoji}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                        {item.description && (
                          <p className="mt-0.5 text-[10.5px] leading-snug text-zinc-500 dark:text-zinc-400">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-teal-100 px-2 py-1 text-[11px] font-black tabular-nums text-teal-800 dark:bg-teal-900 dark:text-teal-200">
                        × {quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

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
              <p className="text-[10.5px] font-black uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Calcul du tarif
              </p>
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
              <p className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                {serviceId === 'iron_only'
                  ? `Soit ${formatFCFA(quote.averagePerGarment)} par vêtement en moyenne.`
                  : `Tarif basé sur le total déclaré (${formatGarments(garments)}) : les types choisis ne modifient pas le prix.`}
              </p>
            </>
          )}

          {serviceId !== 'iron_only' && quote && !washSelectionComplete && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-[11.5px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Encore {formatGarments(remainingGarments)} à sélectionner pour finaliser le dépôt.
            </p>
          )}

          <button
            type="button"
            onClick={addToCart}
            disabled={!canAddToCart}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            Ajouter au panier
          </button>
        </div>
      </section>
    </div>
  );
};
