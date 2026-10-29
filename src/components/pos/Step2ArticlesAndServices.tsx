import React, { useEffect, useState } from 'react';
import { CurrentColorSelector, LineColorSelect } from './ColorPicker';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { getGarmentCatalog } from '../../lib/garmentCatalog';
import { calculateOrderTotals, isOrderLineExpress } from '../../lib/pricing';
import { formatPressingWeight, getPressingPricingMode, resolvePressingPrice } from '../../lib/pressing';
import { normalizeText } from '../../lib/utils';
import { ClothingItem, OrderLine } from '../../types';
import {
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Search,
  ShoppingBasket,
} from 'lucide-react';
import { SegmentedControl } from '../common/SegmentedControl';
import { BlanchisserieCounter } from './BlanchisserieCounter';
import { PressingWeightServiceSale } from './PressingWeightServiceSale';
import { OrderFlowActions, OrderStepIntro } from './OrderFlowUi';

export const Step2ArticlesAndServices: React.FC = () => {
  const {
    selectedServiceCategory,
    setOrderStep,
    cartLines,
    addCartItem,
    removeCartItem,
    updateCartItemQty,
    setCartLineExpress,
    selectedServiceFilter,
    setSelectedServiceFilter,
    selectedCustomer,
    showToast,
    pickupOption,
    pendingPickupTask,
    shopSettings,
    orderFulfillmentMethod,
  } = useApp();

  const isPressing = selectedServiceCategory === 'pressing';
  const isBlanchisserie = selectedServiceCategory === 'blanchisserie';

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [itemSearch, setItemSearch] = useState('');
  const [cartSearch, setCartSearch] = useState('');
  const [cartSpeedFilter, setCartSpeedFilter] = useState<'all' | 'normal' | 'express'>('all');
  // Deux lots du même vêtement peuvent être ajoutés avec deux délais sans
  // quitter la réception : ce réglage ne s'applique qu'aux prochains ajouts.
  const [nextItemExpress, setNextItemExpress] = useState(pickupOption === 'express');

  // Prestations du pressing : liste et prix réglés dans Paramètres →
  // Prestations. « Express 24h » n'en fait pas partie : c'est un type de
  // service (normal / express) qui double le montant, pas un traitement.
  const pressingServiceDefs = shopSettings.pressing.services;
  const currentServicesList = pressingServiceDefs.map((service) => service.label);
  const activePressingService =
    pressingServiceDefs.find((service) => service.label === selectedServiceFilter) ??
    pressingServiceDefs[0];
  const activePricingMode = getPressingPricingMode(activePressingService);

  // Une prestation renommée ou supprimée dans les Paramètres ne doit pas
  // laisser le comptoir sur un libellé fantôme.
  useEffect(() => {
    if (!pressingServiceDefs.some((service) => service.label === selectedServiceFilter)) {
      setSelectedServiceFilter(pressingServiceDefs[0]?.label ?? '');
    }
  }, [pressingServiceDefs, selectedServiceFilter, setSelectedServiceFilter]);

  const priceFor = (item: ClothingItem) =>
    resolvePressingPrice(item, shopSettings.pressing, activePressingService?.id ?? '');

  // Filter catalog items by service category (pressing vs blanchisserie)
  // Catalogue réel : vêtements créés dans les Paramètres + catalogue fourni.
  const normalizedItemSearch = itemSearch.trim().toLowerCase();
  const catalogItems = getGarmentCatalog(shopSettings).filter((item) => {
    const matchesCategory =
      item.serviceCategory === selectedServiceCategory || item.serviceCategory === 'both';
    const matchesTab =
      activeCategoryFilter === 'all' || item.category === activeCategoryFilter;
    const matchesSearch =
      !normalizedItemSearch ||
      item.name.toLowerCase().includes(normalizedItemSearch) ||
      (item.description ?? '').toLowerCase().includes(normalizedItemSearch);
    return matchesCategory && matchesTab && matchesSearch;
  });

  const wantsHomeDelivery = orderFulfillmentMethod === 'home_delivery';
  const {
    subtotal,
    expressFee,
    collectionFee,
    deliveryFee,
    discountPercent,
    discountAmount,
    total: estimatedTotal,
  } = calculateOrderTotals(cartLines, {
    pickupOption,
    loyaltyDiscountPercent: selectedCustomer?.loyaltyDiscountPercent,
    collectionFee: pendingPickupTask?.fee ?? 0,
    deliveryFee: wantsHomeDelivery ? shopSettings.deliveryFee : 0,
  });

  const expressGarments = isPressing
    ? cartLines
        .filter((line) => isOrderLineExpress(line, pickupOption))
        .reduce((total, line) => total + line.quantity, 0)
    : 0;
  const normalGarments = isPressing
    ? cartLines
        .filter((line) => !isOrderLineExpress(line, pickupOption))
        .reduce((total, line) => total + line.quantity, 0)
    : 0;
  const hasWeightLines = cartLines.some((line) => line.pricingType === 'kilo' || line.unitLabel === 'forfait');
  const expressLineCount = cartLines.filter((line) => isOrderLineExpress(line, pickupOption)).length;
  const normalLineCount = cartLines.length - expressLineCount;

  const normalizedCartSearch = normalizeText(cartSearch);
  const visibleCartLines = cartLines.filter((line) => {
    const lineIsExpress = isOrderLineExpress(line, pickupOption);
    const matchesSpeed =
      !isPressing ||
      cartSpeedFilter === 'all' ||
      (cartSpeedFilter === 'express' ? lineIsExpress : !lineIsExpress);
    const searchable = normalizeText(
      `${line.name} ${line.serviceType} ${line.color ?? ''} ${lineIsExpress ? 'express 24h' : 'normal'}`
    );
    return matchesSpeed && (!normalizedCartSearch || searchable.includes(normalizedCartSearch));
  });

  const getItemCount = (itemId: string) => {
    return cartLines
      .filter((l) => l.clothingItemId === itemId)
      .reduce((sum, l) => sum + l.quantity, 0);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <OrderStepIntro
        step={2}
        title="Articles & prestations"
        description={isPressing
          ? `Comptez les vêtements de ${selectedCustomer?.name || 'le client'}, choisissez leur traitement et ajustez les quantités dans le panier.`
          : 'Indiquez le nombre de vêtements déposés, puis répartissez-les dans le catalogue avec + ou −.'}
        icon={<ShoppingBasket className="h-5 w-5" aria-hidden="true" />}
        aside={
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-left sm:text-right dark:border-zinc-700 dark:bg-zinc-950/60">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total estimé en direct</p>
            <p className="mt-0.5 text-[17px] font-black tabular-nums text-zinc-950 dark:text-zinc-50">{formatFCFA(estimatedTotal)}</p>
          </div>
        }
      />

      {isPressing && (
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-2xs xl:flex-row xl:items-center xl:justify-between dark:border-zinc-800 dark:bg-zinc-900">
          <div className="min-w-0">
            <p className="mb-1.5 text-[10.5px] font-black uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Traitement des prochains articles</p>
            <SegmentedControl
              ariaLabel="Choisir le traitement appliqué aux articles ajoutés"
              tone="blue"
              options={currentServicesList.map((srv) => ({ id: srv, label: srv }))}
              value={selectedServiceFilter}
              onChange={setSelectedServiceFilter}
            />
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[10.5px] font-black uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Délai des prochains articles</p>
            <SegmentedControl
              ariaLabel="Choisir le délai des prochains articles"
              tone="blue"
              options={[
                { id: 'normal', label: 'Normal' },
                { id: 'express', label: 'Express 24h ×2' },
              ]}
              value={nextItemExpress ? 'express' : 'normal'}
              onChange={(speed) => setNextItemExpress(speed === 'express')}
            />
          </div>
          {activePricingMode === 'unit' && (
            <label className="group relative block w-full xl:max-w-xs">
              <span className="sr-only">Rechercher un article</span>
              <Search className="pos-field-icon" aria-hidden="true" />
              <input
                type="search"
                value={itemSearch}
                onChange={(event) => setItemSearch(event.target.value)}
                placeholder="Rechercher un article…"
                className="pos-field pl-10"
              />
            </label>
          )}
        </div>
      )}

      {/* Main Grid: Left Catalog, Right Cart summary */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left Column: Catalog Items */}
        <div className="lg:col-span-3 space-y-3">
          {isBlanchisserie ? (
            <BlanchisserieCounter />
          ) : activePricingMode !== 'unit' && activePressingService ? (
            <PressingWeightServiceSale service={activePressingService} isExpress={nextItemExpress} />
          ) : (
            <>
          {/* Sub-category tabs */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-3 shadow-2xs flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-zinc-600 dark:text-zinc-400">Catégories :</span>
            <SegmentedControl
              ariaLabel="Filtrer le catalogue par catégorie"
              options={[
                { id: 'all', label: 'Tous' },
                { id: 'men', label: 'Hommes' },
                { id: 'women', label: 'Femmes' },
                { id: 'home', label: 'Linge maison' },
                { id: 'pro', label: 'B2B / Pro' },
              ]}
              value={activeCategoryFilter}
              onChange={setActiveCategoryFilter}
            />
          </div>

          <div className="card-3d rounded-xl p-3">
            <CurrentColorSelector />
          </div>

          {/* Catalog Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {catalogItems.map((item, index) => {
              const count = getItemCount(item.id);

              return (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-zinc-900 border-1.5 rounded-xl p-3 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 select-none group animate-in fade-in zoom-in-95 ${
                    count > 0
                      ? isPressing
                        ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 shadow-pop'
                        : 'border-teal-500 bg-teal-50/20 dark:bg-teal-950/20 shadow-pop'
                      : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 shadow-card hover:shadow-card-hover'
                  }`}
                  style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                >
                  <div className="flex items-start justify-between gap-1">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover shadow-xs shrink-0 transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <span className="text-3xl filter drop-shadow-xs inline-block transition-transform duration-300 group-hover:scale-110">{item.emoji}</span>
                    )}
                    {count > 0 && (
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-full tabular-nums text-white ${
                          isPressing ? 'bg-blue-600' : 'bg-teal-600'
                        }`}
                      >
                        × {count}
                      </span>
                    )}
                  </div>

                  <div className="my-2">
                    <p className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100 leading-tight">
                      {item.name}
                    </p>
                    <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 font-semibold tabular-nums mt-0.5">
                      {formatFCFA(priceFor(item))}{' '}
                      <span className="font-normal text-zinc-400 dark:text-zinc-500">/ {item.unitLabel || 'pièce'}</span>
                    </p>
                    {item.description && (
                      <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500 line-clamp-1 mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      addCartItem(
                        { ...item, unitPrice: priceFor(item) },
                        undefined,
                        undefined,
                        undefined,
                        { isExpress: nextItemExpress }
                      )
                    }
                    className={`w-full font-bold text-[12px] py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs mt-1 ${
                      count > 0
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{nextItemExpress ? '+ Ajouter en Express' : count > 0 ? '+ Ajouter encore' : 'Ajouter'}</span>
                  </button>
                </div>
              );
            })}
          </div>
          {catalogItems.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <Search className="mx-auto mb-2 h-6 w-6 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
              <p className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">Aucun article ne correspond à cette recherche</p>
              <button type="button" onClick={() => { setItemSearch(''); setActiveCategoryFilter('all'); }} className="mt-2 text-[12px] font-bold text-blue-600 hover:underline dark:text-blue-400">
                Réinitialiser les filtres
              </button>
            </div>
          )}
            </>
          )}
        </div>

        {/* Right Column: Live Order Cart Ticket */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-2xl overflow-hidden shadow-sm sticky top-16">
            <div
              className={`p-4 text-white flex items-center justify-between ${
                isPressing ? 'bg-blue-900' : 'bg-teal-950'
              }`}
            >
              <div>
                <p className="font-bold text-[14.5px]">Panier de la commande</p>
                <p className="text-[11.5px] text-zinc-300">
                  {cartLines.length} référence{cartLines.length > 1 ? 's' : ''} ajoutée{cartLines.length > 1 ? 's' : ''}
                </p>
                {isPressing && cartLines.length > 0 && (
                  <p className="mt-1 text-[11px] font-bold text-amber-200">
                    {hasWeightLines
                      ? `${expressLineCount} ligne${expressLineCount > 1 ? 's' : ''} Express • ${normalLineCount} ligne${normalLineCount > 1 ? 's' : ''} Normal`
                      : `${expressGarments} vêtement${expressGarments > 1 ? 's' : ''} Express • ${normalGarments} au délai normal`}
                  </p>
                )}
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 dark:bg-zinc-900/20 text-white uppercase">
                {isPressing ? 'Pressing' : 'Blanchisserie'}
              </span>
            </div>

            {cartLines.length > 0 && (
              <div className="space-y-2.5 border-b border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-950/40">
                <label className="group relative block">
                  <span className="sr-only">Rechercher dans le panier</span>
                  <Search className="pos-field-icon" aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Rechercher dans le panier"
                    value={cartSearch}
                    onChange={(event) => setCartSearch(event.target.value)}
                    placeholder="Article, prestation, couleur, Normal, Express…"
                    className="pos-field pos-field-compact pl-10"
                  />
                </label>
                {isPressing && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SegmentedControl
                      ariaLabel="Filtrer le panier par délai"
                      tone="blue"
                      options={[
                        { id: 'all', label: 'Tous' },
                        { id: 'normal', label: 'Normal' },
                        { id: 'express', label: 'Express' },
                      ]}
                      value={cartSpeedFilter}
                      onChange={setCartSpeedFilter}
                    />
                    <span aria-live="polite" className="text-[10.5px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {visibleCartLines.length} / {cartLines.length} ligne{cartLines.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* List of cart lines */}
            <div className="p-4 space-y-2.5 max-h-[480px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {cartLines.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 dark:text-zinc-500 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
                  <ShoppingBag className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                  <p className="text-[13px] font-bold text-zinc-600 dark:text-zinc-400">Aucun article sélectionné</p>
                  <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    Cliquez sur les vêtements ou le linge à gauche pour remplir le panier.
                  </p>
                </div>
              ) : visibleCartLines.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
                  <Search className="mx-auto mb-2 h-6 w-6 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
                  <p className="text-[12.5px] font-bold text-zinc-700 dark:text-zinc-300">Aucune ligne ne correspond à ce filtre</p>
                  <button
                    type="button"
                    onClick={() => { setCartSearch(''); setCartSpeedFilter('all'); }}
                    className="mt-2 text-[11.5px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Afficher tout le panier
                  </button>
                </div>
              ) : (
                visibleCartLines.map((line) => (
                  <div key={line.id} className="pt-2 flex items-center justify-between gap-2 text-[12.5px]">
                    <div className="flex-1 min-w-0 pr-1">
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {line.pricingType === 'kilo'
                          ? `${formatPressingWeight(line.weightKg ?? line.quantity)} kg`
                          : line.unitLabel === 'forfait'
                            ? `${line.quantity} forfait${line.quantity > 1 ? 's' : ''}`
                            : `${line.quantity} ×`}{' '}
                        {line.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {line.serviceType} • {formatFCFA(line.unitPrice)} / {line.pricingType === 'kilo' ? 'kg' : line.unitLabel || 'pc'}
                        {line.unitLabel === 'forfait' && line.weightKg !== undefined
                          ? ` • ${formatPressingWeight(line.weightKg)} kg couverts`
                          : ''}
                      </p>
                      <LineColorSelect line={line} />
                      {isPressing && (
                        <div
                          role="group"
                          aria-label={`Délai de ${line.name}`}
                          className="mt-2 inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <button
                            type="button"
                            aria-label={`Normal : ${line.name}`}
                            aria-pressed={!isOrderLineExpress(line, pickupOption)}
                            onClick={() => setCartLineExpress(line.id, false)}
                            className={`rounded-md px-2 py-1 text-[10.5px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                              !isOrderLineExpress(line, pickupOption)
                                ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-50'
                                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                            }`}
                          >
                            Normal
                          </button>
                          <button
                            type="button"
                            aria-label={`Express 24h : ${line.name}`}
                            aria-pressed={isOrderLineExpress(line, pickupOption)}
                            onClick={() => setCartLineExpress(line.id, true)}
                            className={`rounded-md px-2 py-1 text-[10.5px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${
                              isOrderLineExpress(line, pickupOption)
                                ? 'bg-amber-400 text-amber-950 shadow-2xs'
                                : 'text-zinc-500 hover:text-amber-700 dark:text-zinc-400 dark:hover:text-amber-300'
                            }`}
                          >
                            Express 24h ×2
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <button
                          type="button"
                          onClick={() => updateCartItemQty(line.id, -1)}
                          className="px-1.5 py-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-l"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-1.5 font-bold tabular-nums text-[12px]">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartItemQty(line.id, 1)}
                          className="px-1.5 py-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-r"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums min-w-[65px] text-right">
                        {formatFCFA(line.subtotal)}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeCartItem(line.id)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Financial subtotal preview */}
            {cartLines.length > 0 && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 space-y-1.5 text-[12.5px]">
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Sous-total articles</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatFCFA(subtotal)}</span>
                </div>
                {expressFee > 0 && (
                  <div className="flex justify-between text-amber-800 dark:text-amber-200">
                    <span>Supplément Express 24h — lignes sélectionnées (×2)</span>
                    <span className="font-bold tabular-nums">+{formatFCFA(expressFee)}</span>
                  </div>
                )}
                {pendingPickupTask && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                    <span>Ramassage à domicile</span>
                    <span className="font-bold tabular-nums">
                      {collectionFee > 0 ? `+${formatFCFA(collectionFee)}` : 'Offert'}
                    </span>
                  </div>
                )}
                {wantsHomeDelivery && (
                  <div className="flex justify-between text-blue-700 dark:text-blue-300">
                    <span>Livraison à domicile</span>
                    <span className="font-bold tabular-nums">
                      {deliveryFee > 0 ? `+${formatFCFA(deliveryFee)}` : 'Offerte'}
                    </span>
                  </div>
                )}
                {discountAmount > 0 && discountPercent > 0 && (
                  <div className="flex justify-between text-blue-700 dark:text-blue-300">
                    <span>Remise fidélité ({discountPercent}%)</span>
                    <span className="font-bold tabular-nums">−{formatFCFA(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-950 dark:text-zinc-50 font-black text-[15px] pt-1.5 border-t border-zinc-200 dark:border-zinc-700">
                  <span>Montant estimé</span>
                  <span className="tabular-nums">{formatFCFA(estimatedTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <OrderFlowActions
        onBack={() => setOrderStep(1)}
        backLabel="Client & service"
        onNext={() => {
          if (cartLines.length === 0) {
            showToast('Ajoutez au moins un article ou une prestation avant de continuer.');
            return;
          }
          setOrderStep(3);
        }}
        nextDisabled={cartLines.length === 0}
        nextLabel="Retrait & consignes"
        hint={cartLines.length > 0
          ? `${cartLines.length} référence${cartLines.length > 1 ? 's' : ''} dans le panier • ${formatFCFA(estimatedTotal)}`
          : 'Ajoutez au moins un article pour débloquer la suite'}
      />
    </div>
  );
};
