import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ServiceTypeSelectionScreen } from './ServiceTypeSelectionScreen';
import { OrderStepperHeader } from './OrderStepperHeader';
import { Step1ClientAndDates } from './Step1ClientAndDates';
import { Step2ArticlesAndServices } from './Step2ArticlesAndServices';
import { Step3SummaryAndConfirm } from './Step3SummaryAndConfirm';
import { CustomerSection } from './CustomerSection';
import { ClothingCatalogSection } from './ClothingCatalogSection';
import { PickupOptionsSection } from './PickupOptionsSection';
import { PromoBanner } from './PromoBanner';
import { OrderCartTicket } from './OrderCartTicket';
import { RotateCcw, Eye, ArrowLeft, LayoutGrid, Layers, Shirt, Waves } from 'lucide-react';

export const PosPage: React.FC = () => {
  const {
    selectedServiceCategory,
    setSelectedServiceCategory,
    orderStep,
    setOrderStep,
    clearCart,
    setPreviewTicket,
    orders,
    setActiveScreen,
    cartLines,
  } = useApp();

  // Mode: 'stepper' (new multi-step flow) or 'classic' (single-view all-in-one POS)
  const [viewMode, setViewMode] = useState<'stepper' | 'classic'>('stepper');

  const handlePreviewCurrent = () => {
    if (orders.length > 0) {
      setPreviewTicket(orders[0]);
    }
  };

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-[1366px]">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveScreen('dashboard')}
              className="p-1 hover:bg-zinc-200 rounded-lg text-zinc-500 hover:text-black transition-colors"
              title="Retour au tableau de bord (F1)"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900">
              {viewMode === 'stepper'
                ? selectedServiceCategory
                  ? `Nouvelle commande • ${selectedServiceCategory === 'pressing' ? 'Pressing' : 'Blanchisserie'}`
                  : 'Nouvelle commande • Sélection du service'
                : 'Réception comptoir classique'}
            </h1>
          </div>
          <p className="text-[13px] text-zinc-500 ml-7">
            {viewMode === 'stepper'
              ? 'Parcours de commande guidé • Choix du service → Client & Délais → Articles → Validation'
              : 'Dépôt client au comptoir • ticket imprimé + SMS automatique'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="bg-zinc-100 p-1 rounded-xl border border-zinc-200 flex items-center text-[11.5px] font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('stepper')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'stepper'
                  ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
              title="Nouveau parcours en 3 étapes"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Parcours guidé</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('classic')}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'classic'
                  ? 'bg-white text-zinc-900 font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
              title="Vue directe tout-en-un"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-zinc-600" />
              <span>Vue directe</span>
            </button>
          </div>

          <button
            type="button"
            onClick={clearCart}
            className="bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 px-3 py-1.5 text-[12.5px] font-semibold rounded-lg transition-colors shadow-2xs flex items-center gap-1.5"
            title="Vider le panier"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vider</span>
          </button>

          <button
            type="button"
            onClick={handlePreviewCurrent}
            className="bg-white border-2 border-dashed border-zinc-300 hover:border-zinc-500 text-zinc-700 px-3 py-1.5 text-[12.5px] font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            title="Aperçu du dernier ticket généré"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dernier ticket</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'stepper' ? (
        <div>
          {/* Step 0: Service Selection (Pressing vs Blanchisserie) */}
          {!selectedServiceCategory ? (
            <ServiceTypeSelectionScreen />
          ) : (
            <div>
              {/* Stepper Header Bar with service toggle & step indicators */}
              <OrderStepperHeader />

              {/* Step 1: Customer identification & pickup dates */}
              {orderStep === 1 && <Step1ClientAndDates />}

              {/* Step 2: Articles catalog & live cart */}
              {orderStep === 2 && <Step2ArticlesAndServices />}

              {/* Step 3: Recap & Final submission */}
              {orderStep === 3 && <Step3SummaryAndConfirm />}
            </div>
          )}
        </div>
      ) : (
        /* Classic Single-View POS */
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            {/* Left Col (Client, Articles, Retrait, Promo) */}
            <div className="lg:col-span-3 space-y-3">
              <CustomerSection />
              <ClothingCatalogSection />
              <PickupOptionsSection />
              <PromoBanner />
            </div>

            {/* Right Col (Ticket / Cart) */}
            <div className="lg:col-span-2">
              <OrderCartTicket />
            </div>
          </div>
        </div>
      )}

      {/* Footer Info Banner */}
      <div className="bg-white border border-zinc-200/90 rounded-xl mt-4 px-4 py-2.5 text-[11.5px] text-zinc-500 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <p>
          PressingPro CI • Système d’encaissement & de gestion pressing conforme Côte d'Ivoire • Raccourcis : F1 Accueil, F2 Réception, F3 Atelier, F4 Caisse
        </p>
        <span className="font-semibold text-zinc-700">Abidjan, Cocody • Devise FCFA</span>
      </div>
    </div>
  );
};
