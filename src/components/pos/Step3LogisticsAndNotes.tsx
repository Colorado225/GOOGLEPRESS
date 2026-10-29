import React, { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatPromised, isValidISODate, resolvePromisedDate, todayISO } from '../../lib/dates';
import { resolveOrderPickupOption } from '../../lib/pricing';
import { LogisticsOptionsSection } from './LogisticsOptionsSection';
import { PickupOptionsSection } from './PickupOptionsSection';
import {
  OrderFlowActions,
  OrderStepIntro,
  OrderValidationMessage,
} from './OrderFlowUi';

/** Étape 3 : toutes les décisions atelier et logistique sont regroupées. */
export const Step3LogisticsAndNotes: React.FC = () => {
  const {
    cartLines,
    setOrderStep,
    pickupOption,
    promisedDateISO,
    orderFulfillmentMethod,
    deliveryAddress,
    deliveryDateISO,
    showToast,
  } = useApp();
  const [validationError, setValidationError] = useState<string | null>(null);
  const effectivePickupOption = resolveOrderPickupOption(cartLines, pickupOption);

  const handleContinue = () => {
    if (cartLines.length === 0) {
      setValidationError('Le panier est vide. Revenez aux articles pour composer la commande.');
      return;
    }
    if (
      effectivePickupOption !== 'express' &&
      promisedDateISO !== null &&
      (!isValidISODate(promisedDateISO) || promisedDateISO < todayISO())
    ) {
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
    setOrderStep(4);
    showToast('Retrait et consignes validés. Vérifiez le récapitulatif avant encaissement.');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <OrderStepIntro
        step={3}
        title="Retrait, livraison & consignes"
        description="Définissez la date promise, le mode de restitution et les consignes atelier. Le supplément Express ou livraison est immédiatement intégré au total."
        icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
        aside={
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 dark:border-blue-900 dark:bg-blue-950">
            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">Prêt promis</p>
            <p className="mt-0.5 text-[12.5px] font-black text-blue-950 dark:text-blue-100">
              {formatPromised(resolvePromisedDate(effectivePickupOption, promisedDateISO))}
            </p>
          </div>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <PickupOptionsSection />
        <LogisticsOptionsSection />
      </div>

      <OrderValidationMessage message={validationError} />
      <OrderFlowActions
        onBack={() => setOrderStep(2)}
        backLabel="Articles & prestations"
        onNext={handleContinue}
        nextLabel="Vérifier la commande"
        hint="Vous pourrez encore modifier chaque section depuis le récapitulatif"
      />
    </div>
  );
};
