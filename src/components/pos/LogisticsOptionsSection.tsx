import React from 'react';
import { Calendar, Clock, MapPin, PackageCheck, Store, Truck, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { resolvePromisedDate, toISODate, todayISO } from '../../lib/dates';
import {
  LOGISTICS_TIME_SLOTS,
  formatLogisticsSchedule,
  getLogisticsTimeSlotLabel,
} from '../../lib/logistics';
import type { LogisticsTimeSlot } from '../../types';

/**
 * Bandeau visible dans tout le POS lorsqu'un linge ramassé à domicile est en
 * cours de comptage/conversion. Détacher ne supprime pas la tournée : elle
 * reste « collectée » dans l'onglet Tournées et pourra être reprise.
 */
export const PendingPickupBanner: React.FC = () => {
  const { pendingPickupTask, cancelPendingPickupConversion } = useApp();
  if (!pendingPickupTask) return null;

  return (
    <section
      aria-live="polite"
      className="mb-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 px-3.5 py-3 shadow-2xs"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white" aria-hidden="true">
            <PackageCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-[13.5px] text-emerald-950 dark:text-emerald-100">
              Ramassage collecté à convertir — {pendingPickupTask.customerName}
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-emerald-900 dark:text-emerald-200">
              {formatLogisticsSchedule(pendingPickupTask.scheduledDate, pendingPickupTask.timeSlot)} •{' '}
              {pendingPickupTask.address}
              {pendingPickupTask.addressDetails ? ` (${pendingPickupTask.addressDetails})` : ''}
            </p>
            <p className="text-[12px] font-semibold text-emerald-800 dark:text-emerald-300">
              Comptez les pièces reçues : frais de ramassage{' '}
              {pendingPickupTask.fee > 0 ? formatFCFA(pendingPickupTask.fee) : 'offert'} ajouté au total.
              {pendingPickupTask.collectedBags
                ? ` ${pendingPickupTask.collectedBags} sac(s) collecté(s).`
                : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={cancelPendingPickupConversion}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-zinc-900 px-3 py-2 text-[12px] font-bold text-emerald-800 dark:text-emerald-300 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Détacher le ramassage
        </button>
      </div>
    </section>
  );
};

/**
 * Choix du mode de restitution dans le POS : retrait comptoir (comportement
 * historique) ou livraison à domicile avec adresse et créneau de tournée.
 */
export const LogisticsOptionsSection: React.FC = () => {
  const {
    pendingPickupTask,
    shopSettings,
    pickupOption,
    promisedDateISO,
    orderFulfillmentMethod,
    setOrderFulfillmentMethod,
    deliveryAddress,
    setDeliveryAddress,
    deliveryAddressDetails,
    setDeliveryAddressDetails,
    deliveryDateISO,
    setDeliveryDateISO,
    deliveryTimeSlot,
    setDeliveryTimeSlot,
  } = useApp();

  const wantsHomeDelivery = orderFulfillmentMethod === 'home_delivery';
  const promisedISO = toISODate(resolvePromisedDate(pickupOption, promisedDateISO));
  const isBeforeProductionPromise = wantsHomeDelivery && deliveryDateISO < promisedISO;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-4 shadow-2xs">
      <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100 mb-2.5 flex items-center gap-2">
        <Truck className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span>4 • Ramassage & mode de remise</span>
      </h2>

      {pendingPickupTask ? (
        <p className="mb-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-3 py-2 text-[12px] leading-relaxed text-emerald-900 dark:text-emerald-100">
          Origine : <strong>linge collecté à domicile</strong>. Frais de ramassage appliqués :{' '}
          <strong>{pendingPickupTask.fee > 0 ? formatFCFA(pendingPickupTask.fee) : 'offert'}</strong>.
        </p>
      ) : (
        <p className="mb-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          Origine : <strong className="text-zinc-900 dark:text-zinc-100">dépôt au comptoir</strong>. Pour un
          ramassage, créez d’abord la demande dans <strong className="text-zinc-900 dark:text-zinc-100">Production &amp; remises → Tournées</strong> ;
          après la collecte, le comptage se fera ici.
        </p>
      )}

      <fieldset>
        <legend className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Comment le linge sera-t-il restitué ?
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
          <label
            className={`border-2 rounded-xl p-3 cursor-pointer transition-all ${
              !wantsHomeDelivery
                ? 'border-black dark:border-zinc-100 bg-zinc-50/80 dark:bg-zinc-800/80 shadow-xs'
                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="fulfillment-method"
                checked={!wantsHomeDelivery}
                onChange={() => setOrderFulfillmentMethod('counter_pickup')}
                className="accent-black w-4 h-4 cursor-pointer"
              />
              <Store className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
              <span className="font-bold text-zinc-900 dark:text-zinc-100">Retrait au comptoir</span>
            </span>
            <span className="mt-1 block pl-6 text-[11.5px] text-zinc-500 dark:text-zinc-400">
              Le client revient chercher son linge — inclus.
            </span>
          </label>

          <label
            className={`border-2 rounded-xl p-3 cursor-pointer transition-all ${
              wantsHomeDelivery
                ? 'border-black dark:border-zinc-100 bg-zinc-50/80 dark:bg-zinc-800/80 shadow-xs'
                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="fulfillment-method"
                checked={wantsHomeDelivery}
                onChange={() => setOrderFulfillmentMethod('home_delivery')}
                className="accent-black w-4 h-4 cursor-pointer"
              />
              <Truck className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
              <span className="font-bold text-zinc-900 dark:text-zinc-100">Livraison à domicile</span>
            </span>
            <span className="mt-1 block pl-6 text-[11.5px] font-semibold text-zinc-600 dark:text-zinc-400">
              {shopSettings.deliveryFee > 0
                ? `+ ${formatFCFA(shopSettings.deliveryFee)} ajoutés au total`
                : 'Course offerte selon le paramètre actuel'}
            </span>
          </label>
        </div>
      </fieldset>

      {wantsHomeDelivery && (
        <div className="mt-3 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <div>
            <label htmlFor="pos-delivery-address" className="mb-1 block text-[11.5px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Adresse de livraison <span aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
              <input
                id="pos-delivery-address"
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                required
                placeholder="Quartier, rue, repère principal…"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 py-2 pl-9 pr-3 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="pos-delivery-details" className="mb-1 block text-[11.5px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Précisions pour le coursier <span className="font-normal normal-case">(optionnel)</span>
            </label>
            <input
              id="pos-delivery-details"
              type="text"
              value={deliveryAddressDetails}
              onChange={(e) => setDeliveryAddressDetails(e.target.value)}
              placeholder="Étage, portail, gardien, point de repère…"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="pos-delivery-date" className="mb-1 block text-[11.5px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Date souhaitée <span aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                <input
                  id="pos-delivery-date"
                  type="date"
                  value={deliveryDateISO}
                  min={todayISO()}
                  onChange={(e) => setDeliveryDateISO(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 py-2 pl-9 pr-3 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="pos-delivery-slot" className="mb-1 block text-[11.5px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Créneau de tournée <span aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                <select
                  id="pos-delivery-slot"
                  value={deliveryTimeSlot}
                  onChange={(e) => setDeliveryTimeSlot(e.target.value as LogisticsTimeSlot)}
                  className="w-full appearance-none rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 py-2 pl-9 pr-3 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  {LOGISTICS_TIME_SLOTS.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <p className="text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Livraison prévue : <strong className="text-zinc-900 dark:text-zinc-100">{formatLogisticsSchedule(deliveryDateISO, deliveryTimeSlot)}</strong>.
            Le coursier sera assigné dans les Tournées. Tout solde restant sera encaissé à la livraison
            (espèces, Wave, MTN MoMo ou Orange Money).
          </p>

          {isBeforeProductionPromise && (
            <p className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-[12px] leading-relaxed text-amber-800 dark:text-amber-200">
              Ce créneau ({getLogisticsTimeSlotLabel(deliveryTimeSlot)}) est antérieur à la date promise
              de production. La tournée restera bloquée tant que la commande ne sera pas prête.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
