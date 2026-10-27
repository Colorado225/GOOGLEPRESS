import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { calculateOrderTotals } from '../../lib/pricing';
import { formatPromised, getPromisedDate, nowDateTime } from '../../lib/dates';
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
  } = useApp();

  const { subtotal, expressFee, discountPercent, discountAmount, total: finalTotal, remaining } =
    calculateOrderTotals(cartLines, {
      pickupOption,
      loyaltyDiscountPercent: selectedCustomer.loyaltyDiscountPercent,
      depositAmount,
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

  return (
    <div className="bg-white border border-zinc-200/90 rounded-xl overflow-hidden shadow-sm sticky top-3">
      {/* Dark Ticket Header */}
      <div className="bg-[#09090b] text-white px-5 py-4 flex justify-between items-center border-b border-zinc-800">
        <div>
          <p className="font-bold text-[15px] tracking-tight">Ticket #TK-{nextTicketNumber}</p>
          <p className="text-[12px] text-zinc-400 mt-0.5">
            {selectedCustomer.name} • {ticketDateTime}
          </p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-400 text-black tracking-wide">
          {remaining === 0 && finalTotal > 0 ? 'SOLDÉ ✓' : 'À ENCAISSER'}
        </span>
      </div>

      <div className="p-4 space-y-3 text-[13px]">
        {/* Cart Item Lines */}
        {cartLines.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 border-2 border-dashed border-zinc-200 rounded-lg">
            <p className="text-[13px] font-medium text-zinc-600">Le panier est vide</p>
            <p className="text-[11.5px] mt-1">Sélectionnez des vêtements dans le catalogue à gauche.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {cartLines.map((line) => (
              <div
                key={line.id}
                className="flex items-center justify-between border border-zinc-200 rounded-lg p-2.5 bg-zinc-50/50 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex-1 pr-2">
                  <p className="font-bold text-zinc-900 leading-snug">
                    <span className="tabular-nums">{line.quantity} ×</span> {line.name}{' '}
                    <span className="font-normal text-zinc-500 text-[11.5px]">— {line.serviceType}</span>
                  </p>
                  <p className="text-[11.5px] text-zinc-500 truncate">
                    {line.notes || `${formatFCFA(line.unitPrice)} / pièce`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-zinc-200 rounded-md bg-white">
                    <button
                      type="button"
                      onClick={() => updateCartItemQty(line.id, -1)}
                      className="px-1.5 py-0.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-l transition-colors"
                      title="Diminuer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-1.5 font-bold text-[12px] tabular-nums text-zinc-900">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartItemQty(line.id, 1)}
                      className="px-1.5 py-0.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-r transition-colors"
                      title="Augmenter"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right min-w-[70px]">
                    <p className="font-bold text-zinc-900 tabular-nums">
                      {formatFCFA(line.subtotal)}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeCartItem(line.id)}
                      className="text-red-500 hover:text-red-700 text-[11px] font-semibold transition-colors"
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
          <div className="flex justify-between items-center border border-blue-200 bg-blue-50/80 rounded-lg px-3 py-2 text-blue-900">
            <div>
              <p className="font-bold text-[12.5px]">Remise fidélité −{discountPercent} %</p>
              <p className="text-[11px] text-blue-700">Carte Gold • dès 20 dépôts</p>
            </div>
            <p className="font-bold text-blue-700 tabular-nums text-[13.5px]">
              −{formatFCFA(discountAmount)}
            </p>
          </div>
        )}

        {/* Financial Summary */}
        <div className="border-t border-dashed border-zinc-300 pt-3 space-y-1 text-zinc-700 text-[12.5px]">
          <div className="flex justify-between">
            <span>Sous-total</span>
            <span className="font-semibold text-zinc-900 tabular-nums">{formatFCFA(subtotal)}</span>
          </div>
          {expressFee > 0 && (
            <div className="flex justify-between text-amber-800">
              <span>Supplément Express (+50 %)</span>
              <span className="font-semibold tabular-nums">+{formatFCFA(expressFee)}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between text-blue-700">
              <span>Remise</span>
              <span className="font-semibold tabular-nums">−{formatFCFA(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-[18px] font-black text-zinc-950 pt-1 border-t border-zinc-200">
            <span>Total</span>
            <span className="tabular-nums">{formatFCFA(finalTotal)}</span>
          </div>
        </div>

        {/* Acompte reçu payment block */}
        <div className="pt-1">
          <div className="flex justify-between items-center mb-1.5">
            <p className="font-bold text-[11.5px] uppercase tracking-wide text-zinc-500">
              Acompte reçu
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleQuickDepositHalf}
                className="text-[10.5px] text-zinc-600 hover:text-black bg-zinc-100 hover:bg-zinc-200 px-1.5 py-0.5 rounded"
              >
                50%
              </button>
              <button
                type="button"
                onClick={handleQuickDepositAll}
                className="text-[10.5px] text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded font-semibold"
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
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
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
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
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
                className="border border-zinc-300 rounded-lg px-3 py-2 w-full font-bold text-[15px] text-zinc-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-900"
                placeholder="Montant FCFA"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400 font-semibold">
                FCFA
              </span>
            </div>
            <div className="text-[12px] text-zinc-500 self-center shrink-0 text-right">
              <span>Reste :</span>
              <br />
              <b className={`text-[15px] tabular-nums ${remaining > 0 ? 'text-black' : 'text-emerald-600'}`}>
                {formatFCFA(remaining)}
              </b>
            </div>
          </div>
        </div>

        {/* Validation CTA Button with Confetti */}
        <ConfettiButton
          type="button"
          onClick={() => submitNewOrder()}
          disabled={cartLines.length === 0}
          options={{
            particleCount: 80,
            spread: 70,
            colors: ['#2563EB', '#0D9488', '#F59E0B', '#10B981'],
          }}
          className={`w-full font-bold rounded-lg py-3 text-[14.5px] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
            cartLines.length === 0
              ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
              : 'bg-[#09090b] hover:bg-zinc-800 text-white active:scale-[0.99]'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>✓ Valider • Imprimer + SMS</span>
          <Sparkles className="w-4 h-4 text-yellow-300" />
        </ConfettiButton>

        {/* SMS Preview footnote */}
        <p className="text-center text-[11.5px] text-zinc-500 leading-relaxed bg-zinc-50 p-2 rounded-md border border-zinc-200">
          Reçu SMS : « Merci {selectedCustomer.name.split(' ')[0]} ! Ticket TK-{nextTicketNumber} : {formatFCFA(finalTotal)}. Retrait {formatPromised(getPromisedDate(pickupOption)).toLowerCase()}. Pressing Pro Cocody »
        </p>
      </div>
    </div>
  );
};
