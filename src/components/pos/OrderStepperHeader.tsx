import React from 'react';
import {
  CalendarClock,
  Check,
  CreditCard,
  LockKeyhole,
  Save,
  ShoppingBasket,
  UserRound,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { OrderStep } from '../../context/store/types';
import { isValidISODate, todayISO } from '../../lib/dates';

const STEPS: Array<{
  id: OrderStep;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  { id: 1, label: 'Client & service', description: 'Identité et tarification', icon: <UserRound className="h-4 w-4" /> },
  { id: 2, label: 'Articles', description: 'Panier et prestations', icon: <ShoppingBasket className="h-4 w-4" /> },
  { id: 3, label: 'Retrait & consignes', description: 'Délai et logistique', icon: <CalendarClock className="h-4 w-4" /> },
  { id: 4, label: 'Paiement', description: 'Contrôle et ticket', icon: <CreditCard className="h-4 w-4" /> },
];

/** Progression linéaire, avec retour libre et accès avant uniquement si les prérequis sont remplis. */
export const OrderStepperHeader: React.FC = () => {
  const {
    orderStep,
    setOrderStep,
    selectedServiceCategory,
    selectedCustomer,
    cartLines,
    promisedDateISO,
    orderFulfillmentMethod,
    deliveryAddress,
    deliveryDateISO,
  } = useApp();

  const clientStepValid = Boolean(selectedServiceCategory && selectedCustomer);
  const cartStepValid = clientStepValid && cartLines.length > 0;
  const scheduleValid =
    promisedDateISO === null ||
    (isValidISODate(promisedDateISO) && promisedDateISO >= todayISO());
  const deliveryValid =
    orderFulfillmentMethod !== 'home_delivery' ||
    (Boolean(deliveryAddress.trim()) &&
      isValidISODate(deliveryDateISO) &&
      deliveryDateISO >= todayISO());
  const reviewStepValid = cartStepValid && scheduleValid && deliveryValid;

  const furthestStep: OrderStep = reviewStepValid
    ? 4
    : cartStepValid
      ? 3
      : clientStepValid
        ? 2
        : 1;

  const navigate = (target: OrderStep) => {
    // La grille tarifaire ne se change plus en cours de panier : on retourne à l'étape 1,
    // où le choix de service est explicitement verrouillé tant que des articles sont présents.
    if (target <= furthestStep) setOrderStep(target);
  };

  return (
    <section
      aria-label="Progression de la prise de commande"
      className="overflow-hidden rounded-[22px] border border-zinc-200/90 bg-white shadow-[0_12px_35px_-28px_rgba(9,9,11,0.4)] dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-zinc-950 px-2 text-[12px] font-black text-white dark:bg-zinc-50 dark:text-zinc-950">
            {orderStep}/4
          </span>
          <div>
            <p className="text-[12.5px] font-black text-zinc-900 dark:text-zinc-100">
              {STEPS[orderStep - 1].label}
            </p>
            <p className="hidden text-[10.5px] text-zinc-500 sm:block dark:text-zinc-400">
              Réception guidée
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10.5px] font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <Save className="h-3 w-3" aria-hidden="true" />
          Brouillon sauvegardé
        </span>
      </div>

      <ol className="grid grid-cols-4 gap-1.5 p-2.5 sm:gap-2 sm:p-3">
        {STEPS.map((step) => {
          const isActive = orderStep === step.id;
          const isComplete = step.id < orderStep;
          const isReachable = step.id <= furthestStep;
          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                onClick={() => navigate(step.id)}
                disabled={!isReachable || isActive}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Étape ${step.id} : ${step.label}${isComplete ? ', terminée' : ''}`}
                className={`group flex h-full w-full min-w-0 items-center gap-2 rounded-xl border px-2 py-2.5 text-left transition-all sm:px-3 ${
                  isActive
                    ? 'border-zinc-950 bg-zinc-950 text-white shadow-md dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950'
                    : isComplete
                      ? 'border-blue-200 bg-blue-50 text-blue-900 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100 dark:hover:bg-blue-900'
                      : isReachable
                        ? 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
                        : 'cursor-not-allowed border-zinc-100 bg-zinc-50/70 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-600'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
                    isActive
                      ? 'bg-white/15 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                      : isComplete
                        ? 'bg-blue-600 text-white'
                        : isReachable
                          ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                          : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600'
                  }`}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : isReachable ? step.icon : <LockKeyhole className="h-3 w-3" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[10.5px] font-black leading-tight sm:text-[12px]">
                    <span className="sm:hidden">{step.id}. {step.id === 1 ? 'Client' : step.id === 2 ? 'Articles' : step.id === 3 ? 'Retrait' : 'Paiement'}</span>
                    <span className="hidden sm:inline">{step.id}. {step.label}</span>
                  </span>
                  <span className={`mt-0.5 hidden truncate text-[9.5px] lg:block ${isActive ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {step.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="h-1 bg-zinc-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-r-full transition-all duration-300 ${
            selectedServiceCategory === 'blanchisserie' ? 'bg-teal-500' : 'bg-blue-600'
          }`}
          style={{ width: `${orderStep * 25}%` }}
        />
      </div>
    </section>
  );
};
