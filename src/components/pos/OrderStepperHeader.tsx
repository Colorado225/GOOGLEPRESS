import React from 'react';
import { useApp } from '../../context/AppContext';
import { Shirt, Waves, Check, ChevronRight, ArrowLeft } from 'lucide-react';

export const OrderStepperHeader: React.FC = () => {
  const {
    selectedServiceCategory,
    setSelectedServiceCategory,
    orderStep,
    setOrderStep,
    cartLines,
    selectedCustomer,
  } = useApp();

  const isPressing = selectedServiceCategory === 'pressing';
  const isBlanchisserie = selectedServiceCategory === 'blanchisserie';

  const steps = [
    { number: 1, label: 'Informations client & dates' },
    { number: 2, label: 'Articles & prestations' },
    { number: 3, label: 'Récapitulatif & validation' },
  ];

  const handleStepClick = (targetStep: 1 | 2 | 3) => {
    // Only allow navigation to Step 2 if customer selected
    if (targetStep >= 2 && !selectedCustomer) return;
    // Only allow navigation to Step 3 if cart has items
    if (targetStep === 3 && cartLines.length === 0) return;
    setOrderStep(targetStep);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-2xl p-4 mb-4 shadow-2xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Service badge and switch toggle */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedServiceCategory(null)}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 transition-colors"
            title="Revenir au choix de service"
            aria-label="Revenir au choix de service"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-[12px] font-bold flex items-center gap-1.5 border ${
                isPressing
                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  : 'bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
              }`}
            >
              {isPressing ? <Shirt className="w-3.5 h-3.5" /> : <Waves className="w-3.5 h-3.5" />}
              <span>{isPressing ? 'Service Pressing' : 'Service Blanchisserie'}</span>
            </span>

            {/* Quick Toggle pill between Pressing & Blanchisserie */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setSelectedServiceCategory('pressing')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  isPressing ? 'bg-blue-600 text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50'
                }`}
              >
                Pressing
              </button>
              <button
                type="button"
                onClick={() => setSelectedServiceCategory('blanchisserie')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  isBlanchisserie ? 'bg-teal-600 text-white shadow-2xs' : 'text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50'
                }`}
              >
                Blanchisserie
              </button>
            </div>
          </div>
        </div>

        {/* Right: Stepper indicators */}
        <div className="flex items-center gap-2 sm:gap-3 text-[12px]">
          {steps.map((st, idx) => {
            const isCurrent = orderStep === st.number;
            const isCompleted = orderStep > st.number;
            const isClickable = (st.number === 1) || (st.number === 2 && selectedCustomer) || (st.number === 3 && cartLines.length > 0);

            return (
              <React.Fragment key={st.number}>
                <button
                  type="button"
                  onClick={() => isClickable && handleStepClick(st.number as 1 | 2 | 3)}
                  disabled={!isClickable}
                  className={`flex items-center gap-1.5 font-medium transition-all ${
                    isCurrent
                      ? isPressing
                        ? 'text-blue-700 dark:text-blue-300 font-bold'
                        : 'text-teal-700 dark:text-teal-300 font-bold'
                      : isCompleted
                      ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                      : 'text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                      isCurrent
                        ? isPressing
                          ? 'bg-blue-600 text-white ring-2 ring-blue-200 dark:ring-blue-800 shadow-2xs'
                          : 'bg-teal-600 text-white ring-2 ring-teal-200 dark:ring-teal-800 shadow-2xs'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3 h-3" /> : st.number}
                  </span>
                  <span className="hidden sm:inline">{st.label}</span>
                </button>

                {idx < steps.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
