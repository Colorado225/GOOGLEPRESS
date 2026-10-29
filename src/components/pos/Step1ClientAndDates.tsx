import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CustomerSection } from './CustomerSection';
import { PickupOptionsSection } from './PickupOptionsSection';
import { LogisticsOptionsSection } from './LogisticsOptionsSection';
import { ArrowRight, UserCheck, Calendar, Clock, AlertCircle } from 'lucide-react';
import { isValidISODate, todayISO } from '../../lib/dates';
import { formatFCFA } from '../../data/demoData';
import { Badge } from '../common/DataTable';

export const Step1ClientAndDates: React.FC = () => {
  const {
    selectedCustomer,
    setOrderStep,
    selectedServiceCategory,
    showToast,
    orderFulfillmentMethod,
    deliveryAddress,
    deliveryDateISO,
    promisedDateISO,
  } = useApp();

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleContinue = () => {
    if (!selectedCustomer) {
      setValidationError('Veuillez sélectionner un client pour continuer.');
      return;
    }
    if (promisedDateISO !== null && (!isValidISODate(promisedDateISO) || promisedDateISO < todayISO())) {
      setValidationError('Choisissez une date de retrait libre valide, aujourd’hui ou plus tard.');
      return;
    }
    if (orderFulfillmentMethod === 'home_delivery') {
      if (!deliveryAddress.trim()) {
        setValidationError('Renseignez l’adresse de livraison pour continuer.');
        return;
      }
      if (!isValidISODate(deliveryDateISO) || deliveryDateISO < todayISO()) {
        setValidationError('Choisissez une date de livraison valide, aujourd’hui ou plus tard.');
        return;
      }
    }
    setValidationError(null);
    setOrderStep(2);
    showToast('Client, délais et mode de remise validés. Sélectionnez les articles.');
  };

  const isPressing = selectedServiceCategory === 'pressing';

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Step Header Intro */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
            <span>Étape 1 • Informations du client & Délais de retrait</span>
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Renseignez l'identité du déposant, la date de livraison souhaitée et les instructions particulières.
          </p>
        </div>
        <Badge
          variant={isPressing ? 'info' : 'teal'}
          className={`self-start px-3 py-1 text-[12px] sm:self-center ${isPressing ? 'bg-blue-50 dark:bg-blue-950' : 'bg-teal-50 dark:bg-teal-950'}`}
        >
          {isPressing ? '👔 Pressing' : '🛏️ Blanchisserie'}
        </Badge>
      </div>

      {/* Customer Selector Card */}
      <CustomerSection />

      {/* Dates, Pickup Options & Notes Card */}
      <PickupOptionsSection />

      {/* Origine éventuelle (ramassage) et mode de restitution */}
      <LogisticsOptionsSection />

      {/* Validation Error Message if any */}
      {validationError && (
        <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-[13px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Step 1 Actions Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-[12.5px] text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>
            {selectedCustomer ? (
              <>
                Client actif : <strong>{selectedCustomer.name}</strong> ({selectedCustomer.phone})
              </>
            ) : (
              <span className="text-amber-700 dark:text-amber-300 font-semibold">Aucun client sélectionné — choisissez ou créez un client ci-dessus</span>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          className={`w-full sm:w-auto font-bold px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-[13.5px] ${
            isPressing
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-teal-600 hover:bg-teal-700 text-white'
          }`}
        >
          <span>Continuer vers les articles</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
