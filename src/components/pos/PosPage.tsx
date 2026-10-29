import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { resolveShopDisplayName } from '../../lib/shopIdentity';
import { OrderStepperHeader } from './OrderStepperHeader';
import { Step1ClientAndDates } from './Step1ClientAndDates';
import { Step2ArticlesAndServices } from './Step2ArticlesAndServices';
import { Step3LogisticsAndNotes } from './Step3LogisticsAndNotes';
import { Step3SummaryAndConfirm } from './Step3SummaryAndConfirm';
import { CustomerSection } from './CustomerSection';
import { ClothingCatalogSection } from './ClothingCatalogSection';
import { PickupOptionsSection } from './PickupOptionsSection';
import { LogisticsOptionsSection, PendingPickupBanner } from './LogisticsOptionsSection';
import { PromoBanner } from './PromoBanner';
import { OrderCartTicket } from './OrderCartTicket';
import { Tabs } from '../common/Tabs';
import { RotateCcw, Eye, ArrowLeft, LayoutGrid, Layers, Shirt, Waves, User, Clock } from 'lucide-react';

export const PosPage: React.FC = () => {
  const {
    orderStep,
    nextTicketNumber,
    clearCart,
    setPreviewTicket,
    orders,
    setActiveScreen,
    cartLines,
    workspace,
    shopSettings,
  } = useApp();

  // Mode: 'stepper' (new multi-step flow) or 'classic' (single-view all-in-one POS)
  const [viewMode, setViewMode] = useState<'stepper' | 'classic'>('stepper');
  // Vue directe : saisie découpée en onglets, dans l'ordre du workflow comptoir
  const [classicTab, setClassicTab] = useState<'client' | 'articles' | 'retrait'>('client');

  const handlePreviewCurrent = () => {
    if (orders.length > 0) {
      setPreviewTicket(orders[0]);
    }
  };

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-none">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveScreen('dashboard')}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 transition-colors"
              title="Retour au tableau de bord (F1)"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="mb-0.5 text-[9.5px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">Réception comptoir</p>
              <h1 className="text-[22px] font-black tracking-[-0.025em] text-zinc-950 dark:text-zinc-50">
                {viewMode === 'stepper' ? 'Nouvelle commande' : 'Réception comptoir classique'}
              </h1>
            </div>
          </div>
          <p className="ml-7 text-[12.5px] text-zinc-500 dark:text-zinc-400">
            {viewMode === 'stepper'
              ? 'Client & service → Articles → Retrait & consignes → Paiement'
              : 'Dépôt client au comptoir • ticket imprimé après validation'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-bold text-zinc-500 shadow-2xs md:inline-flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            Prochain ticket <strong className="ml-1.5 text-zinc-900 dark:text-zinc-100">#{String(nextTicketNumber).padStart(4, '0')}</strong>
          </span>
          {/* Mode toggle */}
          <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center text-[11.5px] font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('stepper')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'stepper'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold shadow-2xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
              title="Parcours guidé en 4 étapes"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Parcours guidé</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('classic')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'classic'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold shadow-2xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
              title="Vue directe tout-en-un"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>Vue directe</span>
            </button>
          </div>

          <button
            type="button"
            onClick={clearCart}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 text-[12.5px] font-semibold rounded-lg transition-colors shadow-2xs flex items-center gap-1.5"
            title="Vider le panier"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vider</span>
          </button>

          <button
            type="button"
            onClick={handlePreviewCurrent}
            className="bg-white dark:bg-zinc-900 border-2 border-dashed border-zinc-300 dark:border-zinc-600 hover:border-zinc-500 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 text-[12.5px] font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            title="Aperçu du dernier ticket généré"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dernier ticket</span>
          </button>
        </div>
      </div>

      <PendingPickupBanner />

      {/* Main Content Area */}
      {viewMode === 'stepper' ? (
        <div className="mx-auto max-w-[1600px] space-y-4">
          <OrderStepperHeader />

          {/* 1. Client et grille tarifaire */}
          {orderStep === 1 && <Step1ClientAndDates />}

          {/* 2. Articles, prestations et panier persistant */}
          {orderStep === 2 && <Step2ArticlesAndServices />}

          {/* 3. Date promise, restitution et consignes atelier */}
          {orderStep === 3 && <Step3LogisticsAndNotes />}

          {/* 4. Contrôle, encaissement et édition du ticket */}
          {orderStep === 4 && <Step3SummaryAndConfirm />}
        </div>
      ) : (
        /* Classic Single-View POS */
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            {/* Colonne de saisie en onglets : Client -> Articles -> Retrait.
                Les sections restent montées (masquées en CSS) pour conserver leur état de saisie
                pendant la navigation entre onglets ; le panier à droite reste toujours visible. */}
            <div className="lg:col-span-3 space-y-3">
              <Tabs
                ariaLabel="Sections de la réception comptoir"
                activeId={classicTab}
                onChange={setClassicTab}
                tabs={[
                  { id: 'client', label: 'Client', icon: <User className="w-4 h-4" aria-hidden="true" /> },
                  {
                    id: 'articles',
                    label: 'Articles',
                    icon: <Shirt className="w-4 h-4" aria-hidden="true" />,
                    badge: cartLines.length > 0 ? cartLines.length : undefined,
                  },
                  { id: 'retrait', label: 'Retrait & livraison', icon: <Clock className="w-4 h-4" aria-hidden="true" /> },
                ]}
              />
              <div className={classicTab === 'client' ? '' : 'hidden'}>
                <CustomerSection />
              </div>
              <div className={classicTab === 'articles' ? 'space-y-3' : 'hidden'}>
                <ClothingCatalogSection />
                <PromoBanner
                  brandName={resolveShopDisplayName(shopSettings, workspace)}
                  logoDataUrl={shopSettings.logoDataUrl}
                />
              </div>
              <div className={classicTab === 'retrait' ? 'space-y-3' : 'hidden'}>
                <PickupOptionsSection />
                <LogisticsOptionsSection />
              </div>
            </div>

            {/* Right Col (Ticket / Cart) */}
            <div className="lg:col-span-2">
              <OrderCartTicket />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
