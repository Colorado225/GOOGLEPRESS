import React, { useEffect, useState } from 'react';
import { CurrentColorSelector, LineColorSelect } from './ColorPicker';
import { useApp } from '../../context/AppContext';
import { INITIAL_CLOTHING_ITEMS, formatFCFA } from '../../data/demoData';
import { calculateOrderTotals } from '../../lib/pricing';
import { resolvePressingPrice } from '../../lib/pressing';
import { ClothingItem, OrderLine } from '../../types';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Trash2,
  Scale,
  Sparkles,
  ShoppingBag,
  Info,
} from 'lucide-react';
import { Badge } from '../common/DataTable';
import { SegmentedControl } from '../common/SegmentedControl';
import { BlanchisserieCounter } from './BlanchisserieCounter';

export const Step2ArticlesAndServices: React.FC = () => {
  const {
    selectedServiceCategory,
    setOrderStep,
    cartLines,
    addCartItem,
    removeCartItem,
    updateCartItemQty,
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

  // Prestations du pressing : liste et prix réglés dans Paramètres →
  // Prestations. « Express 24h » n'en fait pas partie : c'est un type de
  // service (normal / express) qui double le montant, pas un traitement.
  const pressingServiceDefs = shopSettings.pressing.services;
  const currentServicesList = pressingServiceDefs.map((service) => service.label);
  const activePressingService =
    pressingServiceDefs.find((service) => service.label === selectedServiceFilter) ??
    pressingServiceDefs[0];

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
  const catalogItems = INITIAL_CLOTHING_ITEMS.filter((item) => {
    const matchesCategory =
      item.serviceCategory === selectedServiceCategory || item.serviceCategory === 'both';
    const matchesTab =
      activeCategoryFilter === 'all' || item.category === activeCategoryFilter;
    return matchesCategory && matchesTab;
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

  const getItemCount = (itemId: string) => {
    return cartLines
      .filter((l) => l.clothingItemId === itemId)
      .reduce((sum, l) => sum + l.quantity, 0);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Intro Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
            <span>Étape 2 • Articles & Prestations</span>
            <Badge variant={isPressing ? 'info' : 'teal'} className={isPressing ? 'bg-blue-50 dark:bg-blue-950' : 'bg-teal-50 dark:bg-teal-950'}>
              {isPressing ? 'Catalogue Pressing' : 'Forfaits Blanchisserie'}
            </Badge>
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            {isPressing
              ? `Sélectionnez les vêtements apportés par ${selectedCustomer?.name || 'le client'}.`
              : 'Choisissez la prestation et le nombre de vêtements déposés.'}
          </p>
        </div>

        {/* Traitement du catalogue pressing ; la blanchisserie choisit sa
            prestation dans son propre comptoir. */}
        {isPressing && (
          <SegmentedControl
            ariaLabel="Choisir le traitement appliqué aux articles ajoutés"
            tone="blue"
            options={currentServicesList.map((srv) => ({ id: srv, label: srv }))}
            value={selectedServiceFilter}
            onChange={setSelectedServiceFilter}
          />
        )}
      </div>

      {/* Main Grid: Left Catalog, Right Cart summary */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left Column: Catalog Items */}
        <div className="lg:col-span-3 space-y-3">
          {isBlanchisserie ? (
            <BlanchisserieCounter />
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
                      addCartItem({ ...item, unitPrice: priceFor(item) })
                    }
                    className={`w-full font-bold text-[12px] py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs mt-1 ${
                      count > 0
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{count > 0 ? '+ Ajouter encore' : 'Ajouter'}</span>
                  </button>
                </div>
              );
            })}
          </div>
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
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 dark:bg-zinc-900/20 text-white uppercase">
                {isPressing ? 'Pressing' : 'Blanchisserie'}
              </span>
            </div>

            {/* List of cart lines */}
            <div className="p-4 space-y-2.5 max-h-[320px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {cartLines.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 dark:text-zinc-500 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
                  <ShoppingBag className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                  <p className="text-[13px] font-bold text-zinc-600 dark:text-zinc-400">Aucun article sélectionné</p>
                  <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    Cliquez sur les vêtements ou le linge à gauche pour remplir le panier.
                  </p>
                </div>
              ) : (
                cartLines.map((line) => (
                  <div key={line.id} className="pt-2 flex items-center justify-between gap-2 text-[12.5px]">
                    <div className="flex-1 min-w-0 pr-1">
                      <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {line.quantity} {line.pricingType === 'kilo' ? 'kg' : '×'} {line.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {line.serviceType} • {formatFCFA(line.unitPrice)} / {line.pricingType === 'kilo' ? 'kg' : 'pc'}
                      </p>
                      <LineColorSelect line={line} />
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
                    <span>Type express 24h (×2)</span>
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

      {/* Step 2 Actions Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOrderStep(1)}
          className="w-full sm:w-auto border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-[13px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>← Revenir aux informations</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (cartLines.length === 0) {
              showToast('Veuillez ajouter au moins un vêtement ou linge avant de continuer.');
              return;
            }
            setOrderStep(3);
          }}
          disabled={cartLines.length === 0}
          className={`w-full sm:w-auto font-bold px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-[13.5px] ${
            cartLines.length === 0
              ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
              : isPressing
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-teal-600 hover:bg-teal-700 text-white'
          }`}
        >
          <span>Vérifier & Valider la commande</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
