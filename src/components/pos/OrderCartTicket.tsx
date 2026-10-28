import React, { useState } from 'react';
import { LineColorSelect } from './ColorPicker';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { calculateOrderTotals } from '../../lib/pricing';
import { formatPromised, getPromisedDate, isValidISODate, nowDateTime, todayISO } from '../../lib/dates';
import { formatLogisticsSchedule } from '../../lib/logistics';
import { resolveShopDisplayName } from '../../lib/shopIdentity';
import { Trash2, Plus, Minus, Printer, MessageSquare, Check, ShieldAlert, Sparkles } from 'lucide-react';
import { ConfettiButton } from '../../registry/magicui/confetti';

export const OrderCartTicket: React.FC = () => {
  const {
    cartLines,
    removeCartItem,
    updateCartItemQty,
    selectedCustomer,
    pickupOption,
    depositAmount,
    setDepositAmount,
    paymentMethod,
    setPaymentMethod,
    submitNewOrder,
    nextTicketNumber,
    pendingPickupTask,
    shopSettings,
    workspace,
    orderFulfillmentMethod,
    deliveryAddress,
    deliveryDateISO,
    deliveryTimeSlot,
  } = useApp();

  const wantsHomeDelivery = orderFulfillmentMethod === 'home_delivery';
  const deliveryDetailsMissing =
    wantsHomeDelivery &&
    (!deliveryAddress.trim() || !isValidISODate(deliveryDateISO) || deliveryDateISO < todayISO());
  const {
    subtotal,
    expressFee,
    collectionFee,
    deliveryFee,
    discountPercent,
    discountAmount,
    total: finalTotal,
    remaining,
  } = calculateOrderTotals(cartLines, {
    pickupOption,
    loyaltyDiscountPercent: selectedCustomer?.loyaltyDiscountPercent,
    depositAmount,
    collectionFee: pendingPickupTask?.fee ?? 0,
    deliveryFee: wantsHomeDelivery ? shopSettings.deliveryFee : 0,
  });

  // Date/heure figées à l'ouverture du ticket (évite un affichage qui bouge à chaque rendu).
  const [ticketDateTime] = useState(() => nowDateTime());

  const [customDeposit, setCustomDeposit] = useState<string>(depositAmount.toString());

  const handleDepositChange = (valStr: string) => {
    setCustomDeposit(valStr);
    const parsed = parseInt(valStr.replace(/\D/g, ''), 10);
    setDepositAmount(isNaN(parsed) ? 0 : parsed);
  };

  const handleQuickDepositAll = () => {
    setDepositAmount(finalTotal);
    setCustomDeposit(finalTotal.toString());
  };

  const handleQuickDepositHalf = () => {
    const half = Math.round(finalTotal / 2);
    setDepositAmount(half);
    setCustomDeposit(half.toString());
  };

  const handlePayOnDelivery = () => {
    setDepositAmount(0);
    setCustomDeposit('0');
  };

  return (
    <div className="card-3d rounded-xl overflow-hidden sticky top-3">
      {/* Dark Ticket Header */}
      <div className="bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 px-5 py-4 flex justify-between items-center border-b border-zinc-800">
        <div>
          <p className="font-bold text-[15px] tracking-tight">Ticket #TK-{nextTicketNumber}</p>
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            {selectedCustomer?.name ?? 'Client à définir'} • {ticketDateTime}
          </p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-400 text-black dark:text-zinc-50 tracking-wide">
          {remaining === 0 && finalTotal > 0 ? 'SOLDÉ ✓' : 'À ENCAISSER'}
        </span>
      </div>

      <div className="p-4 space-y-3 text-[13px]">
        {/* Cart Item Lines */}
        {cartLines.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 dark:text-zinc-500 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
            <p className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">Le panier est vide</p>
            <p className="text-[11.5px] mt-1">Sélectionnez des vêtements dans le catalogue à gauche.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {cartLines.map((line) => (
              <div
                key={line.id}
                className="flex items-center justify-between border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 bg-zinc-50/50 dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="flex-1 pr-2">
                  <p className="font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                    <span className="tabular-nums">
                      {line.quantity} {line.unitLabel === 'forfait' ? 'forfait' : '×'}
                    </span>{' '}
                    {line.name}{' '}
                    <span className="font-normal text-zinc-500 dark:text-zinc-400 text-[11.5px]">— {line.serviceType}</span>
                  </p>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 truncate">
                    {line.notes || `${formatFCFA(line.unitPrice)} / pièce`}
                  </p>
                  <LineColorSelect line={line} />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900">
                    <button
                      type="button"
                      onClick={() => updateCartItemQty(line.id, -1)}
                      className="px-1.5 py-0.5 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-l transition-colors"
                      title="Diminuer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-1.5 font-bold text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartItemQty(line.id, 1)}
                      className="px-1.5 py-0.5 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-r transition-colors"
                      title="Augmenter"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right min-w-[70px]">
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {formatFCFA(line.subtotal)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeCartItem(line.id)}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-[11px] font-semibold transition-colors"
                    >
                      retirer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loyalty Discount Box */}
        {discountPercent > 0 && cartLines.length > 0 && (
          <div className="flex justify-between items-center border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/80 rounded-lg px-3 py-2 text-blue-900 dark:text-blue-100">
            <div>
              <p className="font-bold text-[12.5px]">Remise fidélité −{discountPercent} %</p>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">Carte Gold • dès 20 dépôts</p>
            </div>
            <p className="font-bold text-blue-700 dark:text-blue-300 tabular-nums text-[13.5px]">
              −{formatFCFA(discountAmount)}
            </p>
          </div>
        )}

        {/* Financial Summary */}
        <div className="border-t border-dashed border-zinc-300 dark:border-zinc-600 pt-3 space-y-1 text-zinc-700 dark:text-zinc-300 text-[12.5px]">
          <div className="flex justify-between">
            <span>Sous-total</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatFCFA(subtotal)}</span>
          </div>
          {expressFee > 0 && (
            <div className="flex justify-between text-amber-800 dark:text-amber-200">
              <span>Supplément Express (+50 %)</span>
              <span className="font-semibold tabular-nums">+{formatFCFA(expressFee)}</span>
            </div>
          )}
          {pendingPickupTask && (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
              <span>Ramassage à domicile</span>
              <span className="font-semibold tabular-nums">
                {collectionFee > 0 ? `+${formatFCFA(collectionFee)}` : 'Offert'}
              </span>
            </div>
          )}
          {wantsHomeDelivery && (
            <div className="flex justify-between text-blue-700 dark:text-blue-300">
              <span>Livraison à domicile</span>
              <span className="font-semibold tabular-nums">
                {deliveryFee > 0 ? `+${formatFCFA(deliveryFee)}` : 'Offerte'}
              </span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between text-blue-700 dark:text-blue-300">
              <span>Remise</span>
              <span className="font-semibold tabular-nums">−{formatFCFA(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-[18px] font-black text-zinc-950 dark:text-zinc-50 pt-1 border-t border-zinc-200 dark:border-zinc-700">
            <span>Total</span>
            <span className="tabular-nums">{formatFCFA(finalTotal)}</span>
          </div>
        </div>

        {/* Acompte reçu payment block */}
        <div className="pt-1">
          <div className="flex justify-between items-center mb-1.5">
            <p className="font-bold text-[11.5px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Acompte reçu
            </p>
            <div className="flex gap-1">
              {wantsHomeDelivery && (
                <button
                  type="button"
                  onClick={handlePayOnDelivery}
                  className="text-[10.5px] text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900 px-1.5 py-0.5 rounded font-semibold"
                >
                  À la livraison
                </button>
              )}
              <button
                type="button"
                onClick={handleQuickDepositHalf}
                className="text-[10.5px] text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded"
              >
                50%
              </button>
              <button
                type="button"
                onClick={handleQuickDepositAll}
                className="text-[10.5px] text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 px-1.5 py-0.5 rounded font-semibold"
              >
                100% (Soldé)
              </button>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="grid grid-cols-3 gap-1.5 font-semibold text-[12px] mb-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('especes')}
              className={`py-2 rounded-lg border transition-all ${
                paymentMethod === 'especes'
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              Espèces
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('wave')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                paymentMethod === 'wave'
                  ? 'bg-[#1DA1F2] text-white shadow-2xs ring-2 ring-blue-400'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
            >
              <span>Wave</span> <span>🟠</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('momo')}
              className={`py-2 rounded-lg border transition-all ${
                paymentMethod === 'momo' || paymentMethod === 'om'
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              MTN / Orange
            </button>
          </div>

          {/* Deposit input + Reste */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                value={customDeposit}
                onChange={(e) => handleDepositChange(e.target.value)}
                className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 w-full font-bold text-[15px] text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                placeholder="Montant FCFA"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400 dark:text-zinc-500 font-semibold">
                FCFA
              </span>
            </div>
            <div className="text-[12px] text-zinc-500 dark:text-zinc-400 self-center shrink-0 text-right">
              <span>{wantsHomeDelivery ? 'À la livraison :' : 'Reste :'}</span>
              <br />
              <b className={`text-[15px] tabular-nums ${remaining > 0 ? 'text-black dark:text-zinc-50' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {formatFCFA(remaining)}
              </b>
            </div>
          </div>
        </div>

        {deliveryDetailsMissing && (
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-2.5 py-2 text-[11.5px] font-medium text-amber-800 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Complétez l’adresse et une date de livraison valide dans l’onglet « Retrait &amp; livraison ».
          </p>
        )}

        {/* Validation CTA Button with Confetti */}
        <ConfettiButton
          type="button"
          onClick={() => submitNewOrder()}
          disabled={cartLines.length === 0 || deliveryDetailsMissing}
          options={{
            particleCount: 80,
            spread: 70,
            colors: ['#2563EB', '#0D9488', '#F59E0B', '#10B981'],
          }}
          className={`w-full font-bold rounded-lg py-3 text-[14.5px] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
            cartLines.length === 0 || deliveryDetailsMissing
              ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-500 dark:text-zinc-400 cursor-not-allowed'
              : 'bg-[#09090b] dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 active:scale-[0.99]'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>✓ Valider la réception</span>
          <Sparkles className="w-4 h-4 text-yellow-300" />
        </ConfettiButton>

        {/* Message client à copier manuellement après validation */}
        <p className="text-center text-[11.5px] text-zinc-500 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-800 p-2 rounded-md border border-zinc-200 dark:border-zinc-700">
          Message à copier après validation : « Merci {selectedCustomer?.name?.split(' ')[0] ?? 'cher client'} ! Ticket TK-{nextTicketNumber} : {formatFCFA(finalTotal)}.{' '}
          {wantsHomeDelivery
            ? `Livraison ${formatLogisticsSchedule(deliveryDateISO, deliveryTimeSlot).toLowerCase()}`
            : `Retrait ${formatPromised(getPromisedDate(pickupOption)).toLowerCase()}`}
          . {resolveShopDisplayName(shopSettings, workspace)} »
        </p>
      </div>
    </div>
  );
};
