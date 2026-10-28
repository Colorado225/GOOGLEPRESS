import React, { useState } from 'react';
import { GarmentColorChip } from './ColorPicker';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { calculateOrderTotals } from '../../lib/pricing';
import { formatLongDateTime, formatPromisedLong, getPickupLabel, getPromisedDate } from '../../lib/dates';
import { formatLogisticsSchedule } from '../../lib/logistics';
import { ConfettiButton } from '../../registry/magicui/confetti';
import {
  ArrowLeft,
  Check,
  RotateCcw,
  ShieldCheck,
  Calendar,
  User,
  Clock,
  Shirt,
  Waves,
  CreditCard,
  AlertTriangle,
  Loader2,
  Sparkles,
  Truck,
  MapPin,
} from 'lucide-react';
import {
  Badge,
  Frame,
  FramePanel,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../common/DataTable';

export const Step3SummaryAndConfirm: React.FC = () => {
  const {
    selectedServiceCategory,
    setOrderStep,
    cartLines,
    selectedCustomer,
    pickupOption,
    orderNotes,
    depositAmount,
    setDepositAmount,
    paymentMethod,
    setPaymentMethod,
    submitNewOrder,
    resetNewOrderFlow,
    showToast,
    pendingPickupTask,
    shopSettings,
    orderFulfillmentMethod,
    deliveryAddress,
    deliveryAddressDetails,
    deliveryDateISO,
    deliveryTimeSlot,
  } = useApp();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const isPressing = selectedServiceCategory === 'pressing';
  const isBlanchisserie = selectedServiceCategory === 'blanchisserie';
  const wantsHomeDelivery = orderFulfillmentMethod === 'home_delivery';

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

  const promisedDateStr =
    pickupOption === 'express'
      ? `Demain • 12h00 (${getPickupLabel(pickupOption)})`
      : `${formatPromisedLong(getPromisedDate(pickupOption))} (${getPickupLabel(pickupOption)})`;

  const depositDateStr = `Aujourd'hui, ${formatLongDateTime(new Date())}`;

  const handleConfirmOrder = () => {
    if (isSubmitting) return; // Prevent double clicks
    setIsSubmitting(true);

    try {
      const order = submitNewOrder();
      if (order) {
        // Successful registration handled inside submitNewOrder
      }
    } catch (e) {
      showToast('Erreur lors de l’enregistrement de la commande');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    resetNewOrderFlow();
    setCancelConfirmOpen(false);
    showToast('Parcours de commande réinitialisé');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Step Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
            <span>Étape 3 • Récapitulatif & Enregistrement</span>
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Vérifiez l'ensemble des informations de la commande avant confirmation et émission du ticket.
          </p>
        </div>

        <Badge
          variant={isPressing ? 'info' : 'teal'}
          className={`self-start px-3 py-1 text-[12px] sm:self-center ${isPressing ? 'bg-blue-50 dark:bg-blue-950' : 'bg-teal-50 dark:bg-teal-950'}`}
        >
          {isPressing ? <Shirt className="w-3.5 h-3.5" /> : <Waves className="w-3.5 h-3.5" />}
          <span>{isPressing ? 'Commande Pressing' : 'Commande Blanchisserie'}</span>
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Client & Order Meta Recap (1 Col) */}
        <div className="space-y-3">
          {/* Client Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-2xl p-4 shadow-2xs space-y-2.5 text-[12.5px]">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <span className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <User className="w-4 h-4 text-zinc-500 dark:text-zinc-400" /> Fiche Client
              </span>
              <button
                type="button"
                onClick={() => setOrderStep(1)}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-semibold"
              >
                Modifier
              </button>
            </div>
            <div>
              <p className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100">{selectedCustomer?.name || 'Client comptoir'}</p>
              <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">Tél : {selectedCustomer?.phone || '—'}</p>
              <p className="text-zinc-500 dark:text-zinc-400 text-[12px]">Quartier : {selectedCustomer?.address || 'Abidjan'}</p>
              {(selectedCustomer?.loyaltyDiscountPercent || 0) > 0 && (
                <span className="inline-block mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  🎁 Carte fidélité −{selectedCustomer?.loyaltyDiscountPercent ?? 0}%
                </span>
              )}
            </div>
          </div>

          {/* Turnaround Dates Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-2xl p-4 shadow-2xs space-y-2.5 text-[12.5px]">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <span className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-zinc-500 dark:text-zinc-400" /> Délais & remise
              </span>
              <button
                type="button"
                onClick={() => setOrderStep(1)}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-semibold"
              >
                Modifier
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-500 dark:text-zinc-400 text-[11.5px]">
                {pendingPickupTask ? 'Comptage à la boutique :' : 'Date de dépôt :'}
              </p>
              <p className="font-bold text-zinc-800 dark:text-zinc-200">{depositDateStr}</p>
              <p className="text-zinc-500 dark:text-zinc-400 text-[11.5px] pt-1">Prêt promis au client :</p>
              <p className="font-extrabold text-zinc-950 dark:text-zinc-50 text-[13.5px]">{promisedDateStr}</p>
            </div>

            <div className="space-y-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-2.5">
              <p className="flex items-start gap-1.5 text-zinc-700 dark:text-zinc-300">
                <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
                <span>
                  Origine : <strong>{pendingPickupTask ? 'Ramassage à domicile' : 'Dépôt au comptoir'}</strong>
                </span>
              </p>
              <p className="flex items-start gap-1.5 text-zinc-700 dark:text-zinc-300">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
                <span>
                  Remise : <strong>{wantsHomeDelivery ? 'Livraison à domicile' : 'Retrait au comptoir'}</strong>
                  {wantsHomeDelivery && (
                    <>
                      <br />
                      {deliveryAddress || 'Adresse non renseignée'}
                      {deliveryAddressDetails ? ` — ${deliveryAddressDetails}` : ''}
                      <br />
                      <span className="font-semibold">{formatLogisticsSchedule(deliveryDateISO, deliveryTimeSlot)}</span>
                    </>
                  )}
                </span>
              </p>
            </div>
            {orderNotes && (
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-[11px] font-bold uppercase text-zinc-400 dark:text-zinc-500">Consignes atelier :</p>
                <p className="text-[12px] text-zinc-700 dark:text-zinc-300 italic mt-0.5 bg-zinc-50 dark:bg-zinc-800 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  « {orderNotes} »
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Center & Right Column: Articles Table & Payment (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          {/* Detailed Articles Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-2">
              <span className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100">
                Lignes d'articles et prestations ({cartLines.length})
              </span>
              <button
                type="button"
                onClick={() => setOrderStep(2)}
                className="text-[11.5px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-semibold"
              >
                + Ajouter / Modifier articles
              </button>
            </div>

            <Frame>
              <FramePanel className="p-0">
              <Table className="text-[12.5px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Article / Prestation</TableHead>
                    <TableHead>Traitement</TableHead>
                    <TableHead className="text-center">Quantité / Poids</TableHead>
                    <TableHead className="text-right">Tarif unitaire</TableHead>
                    <TableHead className="text-right">Sous-total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cartLines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-bold text-zinc-900 dark:text-zinc-100">
                        {line.name}
                        {line.color && (
                          <span className="block mt-0.5"><GarmentColorChip color={line.color} /></span>
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-400">{line.serviceType}</TableCell>
                      <TableCell className="text-center font-bold tabular-nums">
                        {line.pricingType === 'kilo'
                          ? `${line.quantity} kg`
                          : line.unitLabel === 'forfait'
                            ? `${line.quantity} forfait${line.quantity > 1 ? 's' : ''}`
                            : `${line.quantity} vêtement${line.quantity > 1 ? 's' : ''}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {formatFCFA(line.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {formatFCFA(line.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </FramePanel>
            </Frame>

            {/* Financial Breakdown */}
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-1.5 text-[13px]">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Sous-total articles</span>
                <span className="font-semibold tabular-nums">{formatFCFA(subtotal)}</span>
              </div>
              {expressFee > 0 && (
                <div className="flex justify-between text-amber-800 dark:text-amber-200 font-medium">
                  <span>Type de service express 24h (×2)</span>
                  <span className="tabular-nums">+{formatFCFA(expressFee)}</span>
                </div>
              )}
              {pendingPickupTask && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-300 font-medium">
                  <span>Ramassage à domicile</span>
                  <span className="tabular-nums">
                    {collectionFee > 0 ? `+${formatFCFA(collectionFee)}` : 'Offert'}
                  </span>
                </div>
              )}
              {wantsHomeDelivery && (
                <div className="flex justify-between text-blue-700 dark:text-blue-300 font-medium">
                  <span>Livraison à domicile</span>
                  <span className="tabular-nums">
                    {deliveryFee > 0 ? `+${formatFCFA(deliveryFee)}` : 'Offerte'}
                  </span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-blue-700 dark:text-blue-300 font-medium">
                  <span>Remise fidélité (−{discountPercent}%)</span>
                  <span className="tabular-nums">−{formatFCFA(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-950 dark:text-zinc-50 font-black text-[17px] pt-1.5 border-t border-zinc-200 dark:border-zinc-700">
                <span>TOTAL COMMANDE</span>
                <span className="tabular-nums">{formatFCFA(finalTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment & Cash Desk Section */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-zinc-500 dark:text-zinc-400" /> Modalité d'acompte & règlement
              </span>
              <span className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400">
                Poste de caisse comptoir
              </span>
            </div>

            {wantsHomeDelivery && (
              <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950 p-3">
                <p className="text-[12px] font-bold text-purple-900 dark:text-purple-100">
                  Règlement de cette livraison
                </p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-purple-700 dark:text-purple-300">
                  Le client peut tout payer maintenant, verser un acompte, ou régler le solde au
                  coursier lors de la remise.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositAmount(finalTotal)}
                    className="rounded-lg bg-purple-700 px-3 py-1.5 text-[11.5px] font-bold text-white transition-colors hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    Tout payer maintenant ({formatFCFA(finalTotal)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositAmount(0)}
                    className="rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-[11.5px] font-bold text-purple-800 dark:text-purple-200 transition-colors hover:bg-purple-100 dark:hover:bg-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    Tout régler à la livraison
                  </button>
                </div>
              </div>
            )}

            {/* Mode selection buttons */}
            <div className="grid grid-cols-4 gap-2 text-[12px] font-bold">
              <button
                type="button"
                onClick={() => setPaymentMethod('wave')}
                className={`py-2 rounded-xl border transition-all flex items-center justify-center gap-1 ${
                  paymentMethod === 'wave'
                    ? 'bg-orange-500 text-white border-orange-500 shadow-md ring-2 ring-orange-300'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span>Wave</span> <span>🟠</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('especes')}
                className={`py-2 rounded-xl border transition-all ${
                  paymentMethod === 'especes'
                    ? 'bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 border-[#09090b] dark:border-zinc-100 shadow-md ring-2 ring-zinc-400'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Espèces 💵
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('momo')}
                className={`py-2 rounded-xl border transition-all ${
                  paymentMethod === 'momo'
                    ? 'bg-amber-500 text-black dark:text-zinc-50 border-amber-500 shadow-md ring-2 ring-amber-300'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                MTN MoMo
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('om')}
                className={`py-2 rounded-xl border transition-all ${
                  paymentMethod === 'om'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-md ring-2 ring-orange-300'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Orange Money
              </button>
            </div>

            {/* Deposit amount input + remaining balance */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1">
                <label className="block text-[11px] font-bold uppercase text-zinc-400 dark:text-zinc-500 mb-1">
                  Acompte perçu immédiatement :
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-xl px-3 py-2 text-[15px] font-bold tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400 dark:text-zinc-500 font-bold">
                    FCFA
                  </span>
                </div>
              </div>

              <div className="flex-1 text-right bg-zinc-50 dark:bg-zinc-800 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                  {wantsHomeDelivery ? 'Reste à payer à la livraison :' : 'Reste à payer au retrait :'}
                </span>
                <span
                  className={`text-[16px] font-black tabular-nums ${
                    remaining === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-700 dark:text-purple-300'
                  }`}
                >
                  {formatFCFA(remaining)}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                  {remaining === 0
                    ? '✓ Soldé avant la remise'
                    : wantsHomeDelivery
                      ? 'À encaisser par le coursier'
                      : 'À encaisser au comptoir'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Actions Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOrderStep(2)}
            className="border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 text-[13px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Modifier articles</span>
          </button>

          <button
            type="button"
            onClick={() => setCancelConfirmOpen(true)}
            className="text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 text-[12.5px] font-semibold px-3 py-2 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Annuler</span>
          </button>
        </div>

        <ConfettiButton
          type="button"
          onClick={handleConfirmOrder}
          disabled={isSubmitting || cartLines.length === 0}
          options={{
            colors: isPressing
              ? ['#2563EB', '#3B82F6', '#60A5FA', '#F59E0B', '#10B981']
              : ['#0D9488', '#14B8A6', '#2DD4BF', '#F59E0B', '#10B981'],
            particleCount: 90,
            spread: 80,
          }}
          className={`w-full sm:w-auto font-black px-8 py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-[15px] cursor-pointer ${
            isSubmitting
              ? 'bg-zinc-400 text-white cursor-wait'
              : isPressing
              ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.99]'
              : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-[0.99]'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Enregistrement en cours...</span>
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              <span>Confirmer & Enregistrer la commande</span>
              <Sparkles className="w-4 h-4 ml-1 text-yellow-300 animate-pulse" />
            </>
          )}
        </ConfettiButton>
      </div>

      {/* Confirmation Dialog on Cancel */}
      {cancelConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl max-w-sm w-full p-5 text-center space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[16px] text-zinc-900 dark:text-zinc-100">Annuler cette commande ?</h3>
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
              Les articles ajoutés au panier seront retirés et vous reviendrez au choix du service.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelConfirmOpen(false)}
                className="flex-1 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold py-2 rounded-xl text-[13px]"
              >
                Continuer la saisie
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-[13px] shadow"
              >
                Oui, annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
