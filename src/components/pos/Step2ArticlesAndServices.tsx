import React, { useState } from 'react';
import { CurrentColorSelector, LineColorSelect } from './ColorPicker';
import { useApp } from '../../context/AppContext';
import { INITIAL_CLOTHING_ITEMS, formatFCFA } from '../../data/demoData';
import { calculateSubtotal } from '../../lib/pricing';
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
  } = useApp();

  const isPressing = selectedServiceCategory === 'pressing';
  const isBlanchisserie = selectedServiceCategory === 'blanchisserie';

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [kiloWeightInput, setKiloWeightInput] = useState<number>(3.5);

  // Available services depending on category
  const pressingServices = [
    'Lavage + Repassage',
    'Pressing à sec',
    'Repassage seul',
    'Teinture',
    'Express 24h',
  ];

  const blanchisserieServices = [
    'Blanchisserie complète',
    'Lavage désinfectant',
    'Repassage calandre',
    'Lavage au kilo',
    'Express 24h',
  ];

  const currentServicesList = isPressing ? pressingServices : blanchisserieServices;

  // Filter catalog items by service category (pressing vs blanchisserie)
  const catalogItems = INITIAL_CLOTHING_ITEMS.filter((item) => {
    const matchesCategory =
      item.serviceCategory === selectedServiceCategory || item.serviceCategory === 'both';
    const matchesTab =
      activeCategoryFilter === 'all' || item.category === activeCategoryFilter;
    return matchesCategory && matchesTab;
  });

  const subtotal = calculateSubtotal(cartLines);

  const getItemCount = (itemId: string) => {
    return cartLines
      .filter((l) => l.clothingItemId === itemId)
      .reduce((sum, l) => sum + l.quantity, 0);
  };

  const handleAddKiloItem = (item: ClothingItem) => {
    addCartItem(item, 'Lavage au kilo', 1, kiloWeightInput);
    showToast(`✓ ${kiloWeightInput} kg de linge ajoutés (${formatFCFA(item.unitPrice * kiloWeightInput)})`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Intro Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-zinc-950 flex items-center gap-2">
            <span>Étape 2 • Articles & Prestations</span>
            <span
              className={`text-[11.5px] font-bold px-2.5 py-0.5 rounded-full border ${
                isPressing
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-teal-50 text-teal-700 border-teal-200'
              }`}
            >
              {isPressing ? 'Catalogue Pressing' : 'Catalogue Blanchisserie'}
            </span>
          </h2>
          <p className="text-[13px] text-zinc-500 mt-0.5">
            Sélectionnez les vêtements ou le linge apporté par {selectedCustomer?.name || 'le client'}.
          </p>
        </div>

        {/* Treatment service filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {currentServicesList.map((srv) => (
            <button
              key={srv}
              type="button"
              onClick={() => setSelectedServiceFilter(srv)}
              className={`text-[11.5px] font-semibold border rounded-full px-3 py-1 transition-all ${
                selectedServiceFilter === srv
                  ? isPressing
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              {srv}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Left Catalog, Right Cart summary */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left Column: Catalog Items */}
        <div className="lg:col-span-3 space-y-3">
          {/* Sub-category tabs */}
          <div className="bg-white border border-zinc-200/90 rounded-xl p-3 shadow-2xs flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-zinc-600">Catégories :</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'men', label: 'Hommes' },
                { id: 'women', label: 'Femmes' },
                { id: 'home', label: 'Linge maison' },
                { id: 'pro', label: 'B2B / Pro' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategoryFilter(tab.id)}
                  className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                    activeCategoryFilter === tab.id
                      ? 'bg-[#09090b] text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-zinc-200/90 rounded-xl p-3 shadow-2xs">
            <CurrentColorSelector />
          </div>

          {/* Catalog Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {catalogItems.map((item) => {
              const count = getItemCount(item.id);
              const isKilo = item.pricingType === 'kilo';

              return (
                <div
                  key={item.id}
                  className={`bg-white border-1.5 rounded-xl p-3 flex flex-col justify-between transition-all duration-150 hover:shadow-xs select-none ${
                    count > 0
                      ? isPressing
                        ? 'border-blue-500 bg-blue-50/20 shadow-2xs'
                        : 'border-teal-500 bg-teal-50/20 shadow-2xs'
                      : 'border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover shadow-2xs shrink-0" />
                    ) : (
                      <span className="text-3xl filter drop-shadow-xs">{item.emoji}</span>
                    )}
                    {count > 0 && (
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-full tabular-nums text-white ${
                          isPressing ? 'bg-blue-600' : 'bg-teal-600'
                        }`}
                      >
                        {isKilo ? `${count} kg` : `× ${count}`}
                      </span>
                    )}
                  </div>

                  <div className="my-2">
                    <p className="font-bold text-[13px] text-zinc-900 leading-tight">
                      {item.name}
                    </p>
                    <p className="text-[11.5px] text-zinc-500 font-semibold tabular-nums mt-0.5">
                      {formatFCFA(item.unitPrice)}{' '}
                      <span className="font-normal text-zinc-400">/ {item.unitLabel || 'pièce'}</span>
                    </p>
                    {item.description && (
                      <p className="text-[10.5px] text-zinc-400 line-clamp-1 mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Kilo input or standard click button */}
                  {isKilo ? (
                    <div className="mt-1 pt-2 border-t border-zinc-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-zinc-600">Poids :</span>
                        <div className="flex items-center gap-1 font-bold">
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            value={kiloWeightInput}
                            onChange={(e) => setKiloWeightInput(parseFloat(e.target.value) || 1)}
                            className="w-14 border border-zinc-300 rounded px-1.5 py-0.5 text-center text-[12px] tabular-nums"
                          />
                          <span>kg</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddKiloItem(item)}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11.5px] py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Peser & Ajouter</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addCartItem(item)}
                      className={`w-full font-bold text-[12px] py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-2xs mt-1 ${
                        count > 0
                          ? isPressing
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-teal-600 text-white hover:bg-teal-700'
                          : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{count > 0 ? '+ Ajouter encore' : 'Ajouter'}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Order Cart Ticket */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden shadow-sm sticky top-16">
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
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white uppercase">
                {isPressing ? 'Pressing' : 'Blanchisserie'}
              </span>
            </div>

            {/* List of cart lines */}
            <div className="p-4 space-y-2.5 max-h-[320px] overflow-y-auto divide-y divide-zinc-100">
              {cartLines.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 border-2 border-dashed border-zinc-200 rounded-xl">
                  <ShoppingBag className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
                  <p className="text-[13px] font-bold text-zinc-600">Aucun article sélectionné</p>
                  <p className="text-[11.5px] text-zinc-400 mt-0.5">
                    Cliquez sur les vêtements ou le linge à gauche pour remplir le panier.
                  </p>
                </div>
              ) : (
                cartLines.map((line) => (
                  <div key={line.id} className="pt-2 flex items-center justify-between gap-2 text-[12.5px]">
                    <div className="flex-1 min-w-0 pr-1">
                      <p className="font-bold text-zinc-900 truncate">
                        {line.quantity} {line.pricingType === 'kilo' ? 'kg' : '×'} {line.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {line.serviceType} • {formatFCFA(line.unitPrice)} / {line.pricingType === 'kilo' ? 'kg' : 'pc'}
                      </p>
                      <LineColorSelect line={line} />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-zinc-200 rounded-lg bg-zinc-50">
                        <button
                          type="button"
                          onClick={() => updateCartItemQty(line.id, -1)}
                          className="px-1.5 py-0.5 hover:bg-zinc-200 text-zinc-600 rounded-l"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-1.5 font-bold tabular-nums text-[12px]">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartItemQty(line.id, 1)}
                          className="px-1.5 py-0.5 hover:bg-zinc-200 text-zinc-600 rounded-r"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="font-bold text-zinc-900 tabular-nums min-w-[65px] text-right">
                        {formatFCFA(line.subtotal)}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeCartItem(line.id)}
                        className="text-red-500 hover:text-red-700 p-1"
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
              <div className="p-4 bg-zinc-50 border-t border-zinc-200 space-y-1.5 text-[12.5px]">
                <div className="flex justify-between text-zinc-600">
                  <span>Sous-total articles</span>
                  <span className="font-bold text-zinc-900 tabular-nums">{formatFCFA(subtotal)}</span>
                </div>
                {(selectedCustomer?.loyaltyDiscountPercent || 0) > 0 && (
                  <div className="flex justify-between text-blue-700">
                    <span>Remise fidélité ({selectedCustomer?.loyaltyDiscountPercent}%)</span>
                    <span className="font-bold tabular-nums">
                      −{formatFCFA(Math.round(subtotal * ((selectedCustomer?.loyaltyDiscountPercent || 0) / 100)))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-950 font-black text-[15px] pt-1.5 border-t border-zinc-200">
                  <span>Montant estimé</span>
                  <span className="tabular-nums">
                    {formatFCFA(
                      subtotal - Math.round(subtotal * ((selectedCustomer?.loyaltyDiscountPercent || 0) / 100))
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 2 Actions Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOrderStep(1)}
          className="w-full sm:w-auto border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-[13px]"
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
              ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
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
