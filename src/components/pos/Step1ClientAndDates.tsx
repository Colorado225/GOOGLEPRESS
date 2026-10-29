import React, { useState } from 'react';
import { Check, LockKeyhole, Shirt, UserRound, Waves } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ServiceCategory } from '../../types';
import { CustomerSection } from './CustomerSection';
import {
  OrderFlowActions,
  OrderSecureHint,
  OrderStepIntro,
  OrderValidationMessage,
} from './OrderFlowUi';

const SERVICES: Array<{
  id: ServiceCategory;
  name: string;
  caption: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'pressing',
    name: 'Pressing',
    caption: 'Tarification à la pièce',
    description: 'Vêtements, costumes et textiles délicats. Nettoyage à sec, lavage ou repassage.',
    icon: <Shirt className="h-5 w-5" aria-hidden="true" />,
  },
  {
    id: 'blanchisserie',
    name: 'Blanchisserie',
    caption: 'Forfaits et volumes',
    description: 'Linge de maison et lots professionnels, comptés par pièce, kilo ou forfait.',
    icon: <Waves className="h-5 w-5" aria-hidden="true" />,
  },
];

/** Étape 1 : le client et la grille tarifaire sont validés avant tout article. */
export const Step1ClientAndDates: React.FC = () => {
  const {
    selectedCustomer,
    setOrderStep,
    selectedServiceCategory,
    setSelectedServiceCategory,
    cartLines,
    pendingPickupTask,
    showToast,
  } = useApp();
  const [validationError, setValidationError] = useState<string | null>(null);
  const serviceLocked = cartLines.length > 0 || Boolean(pendingPickupTask);

  const selectService = (category: ServiceCategory) => {
    if (serviceLocked) return;
    setSelectedServiceCategory(category);
    setValidationError(null);
  };

  const handleContinue = () => {
    if (!selectedCustomer) {
      setValidationError('Sélectionnez un client existant ou créez sa fiche pour continuer.');
      return;
    }
    if (!selectedServiceCategory) {
      setValidationError('Choisissez Pressing ou Blanchisserie pour appliquer la bonne grille tarifaire.');
      return;
    }
    setValidationError(null);
    setOrderStep(2);
    showToast('Client et service validés. Composez maintenant le panier.');
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <OrderStepIntro
        step={1}
        title="Client & service"
        description="Commencez par le déposant et l’univers de tarification. Le bon catalogue et les bonnes prestations seront ensuite proposés automatiquement."
        icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
        aside={
          <OrderSecureHint>
            {selectedServiceCategory === 'blanchisserie'
              ? 'Grille Blanchisserie'
              : selectedServiceCategory === 'pressing'
                ? 'Grille Pressing'
                : 'Service à choisir'}
          </OrderSecureHint>
        }
      />

      <section aria-labelledby="service-choice-title" className="rounded-[22px] border border-zinc-200/90 bg-white p-4 shadow-2xs sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 id="service-choice-title" className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">
              Quel service souhaite le client ?
            </h3>
            <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
              Ce choix détermine les articles et les tarifs de toute la commande.
            </p>
          </div>
          {serviceLocked && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              Service verrouillé
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SERVICES.map((service) => {
            const selected = selectedServiceCategory === service.id;
            const pressing = service.id === 'pressing';
            return (
              <button
                key={service.id}
                type="button"
                aria-pressed={selected}
                aria-label={`Choisir ${service.name}`}
                disabled={serviceLocked}
                onClick={() => selectService(service.id)}
                className={`group relative flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all focus:outline-none focus:ring-4 ${
                  selected
                    ? pressing
                      ? 'border-blue-600 bg-blue-50/70 shadow-[0_12px_28px_-22px_rgba(37,99,235,0.8)] focus:ring-blue-600/15 dark:border-blue-500 dark:bg-blue-950/50'
                      : 'border-teal-600 bg-teal-50/70 shadow-[0_12px_28px_-22px_rgba(13,148,136,0.8)] focus:ring-teal-600/15 dark:border-teal-500 dark:bg-teal-950/50'
                    : 'border-zinc-200 bg-zinc-50/40 hover:border-zinc-300 hover:bg-zinc-50 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950/30 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60'
                }`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  selected
                    ? pressing
                      ? 'bg-blue-600 text-white'
                      : 'bg-teal-600 text-white'
                    : 'bg-white text-zinc-500 shadow-sm dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {service.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-black text-zinc-950 dark:text-zinc-50">{service.name}</span>
                    {selected && (
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white ${pressing ? 'bg-blue-600' : 'bg-teal-600'}`}>
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className={`mt-0.5 block text-[11px] font-black uppercase tracking-wide ${pressing ? 'text-blue-700 dark:text-blue-300' : 'text-teal-700 dark:text-teal-300'}`}>
                    {service.caption}
                  </span>
                  <span className="mt-1.5 block text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {service.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {cartLines.length > 0 && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold leading-relaxed text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Le service ne peut pas être changé tant que le panier contient {cartLines.length} référence{cartLines.length > 1 ? 's' : ''}. Cela évite de mélanger deux grilles de prix dans une même commande.
          </p>
        )}
      </section>

      <CustomerSection />
      <OrderValidationMessage message={validationError} />
      <OrderFlowActions
        onNext={handleContinue}
        nextLabel="Choisir les articles"
        hint={selectedCustomer ? `Commande pour ${selectedCustomer.name}` : 'Un client est requis pour enregistrer la commande'}
      />
    </div>
  );
}
