import React, { useEffect, useMemo, useState } from 'react';
import { PackagePlus, Scale } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import {
  formatPressingWeight,
  getPressingPricingMode,
  quotePressingWeightService,
} from '../../lib/pressing';
import type { PressingServiceType } from '../../types';

interface PressingWeightServiceSaleProps {
  service: PressingServiceType;
  isExpress: boolean;
}

/** Saisie au poids d'une prestation Pressing au kilo ou au forfait. */
export const PressingWeightServiceSale: React.FC<PressingWeightServiceSaleProps> = ({
  service,
  isExpress,
}) => {
  const { addCartItem, showToast } = useApp();
  const [weight, setWeight] = useState('');
  const mode = getPressingPricingMode(service);
  const numericWeight = Number(weight.replace(',', '.'));
  const result = useMemo(
    () => quotePressingWeightService(service, numericWeight),
    [service, numericWeight]
  );
  const quote = weight.trim() && numericWeight > 0 ? result.quote : null;

  useEffect(() => setWeight(''), [service.id]);

  const handleAdd = () => {
    if (!result.quote) {
      showToast(result.error ?? 'Indiquez un poids valide avant d’ajouter la prestation.');
      return;
    }
    for (const block of result.quote.blocks) {
      addCartItem(
        block.item,
        service.label,
        block.quantity,
        block.weightKg,
        {
          isExpress,
          ...(block.kind === 'forfait'
            ? { weightKg: block.weightKg, pricingBasis: 'forfait' as const }
            : {}),
        }
      );
    }
    setWeight('');
  };

  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
          {mode === 'forfait' ? <PackagePlus className="h-5 w-5" aria-hidden="true" /> : <Scale className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-black uppercase tracking-wide text-blue-600 dark:text-blue-400">
            {mode === 'forfait' ? 'Vente au forfait' : 'Vente au kilo'}
          </p>
          <h3 className="mt-0.5 text-[16px] font-black text-zinc-950 dark:text-zinc-50">{service.label}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {mode === 'forfait'
              ? `Forfait de ${formatPressingWeight(service.packageWeightKg ?? 0)} kg à ${formatFCFA(service.packagePrice ?? 0)}. ${
                  service.extraKiloPrice !== undefined
                    ? `Au-delà : ${formatFCFA(service.extraKiloPrice)}/kg.`
                    : 'Le dépassement du poids couvert n’est pas autorisé.'
                }`
              : `Tarif configuré : ${formatFCFA(service.kiloPrice ?? 0)}/kg.`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Poids du linge confié
          <span className="relative mt-1 block">
            <input
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.1}
              aria-label={`Poids en kilos pour ${service.label}`}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              placeholder="Ex. 2,5"
              className="pos-field pr-12 text-[16px] font-black tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-zinc-400">kg</span>
          </span>
        </label>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-[12.5px] font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          Ajouter la prestation au panier
        </button>
      </div>

      {weight.trim() && result.error && (
        <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11.5px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {result.error}
        </p>
      )}

      {quote && (
        <div aria-live="polite" className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[12px] dark:border-zinc-700 dark:bg-zinc-950/60">
          <p className="mb-2 font-bold text-zinc-800 dark:text-zinc-100">Calcul pour {formatPressingWeight(quote.weightKg)} kg</p>
          <div className="space-y-1.5">
            {quote.blocks.map((block) => (
              <div key={block.kind} className="flex items-center justify-between gap-3 text-zinc-600 dark:text-zinc-300">
                <span>
                  {block.kind === 'forfait'
                    ? `1 forfait (${formatPressingWeight(block.weightKg)} kg couverts par ce bloc)`
                    : `${formatPressingWeight(block.weightKg)} kg × ${formatFCFA(block.item.unitPrice)}/kg`}
                </span>
                <span className="shrink-0 font-bold tabular-nums">{formatFCFA(block.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-zinc-200 pt-2 font-black text-zinc-950 dark:border-zinc-700 dark:text-zinc-50">
            <span>Sous-total {isExpress ? 'avant Express' : 'Normal'}</span>
            <span className="tabular-nums">{formatFCFA(quote.total)}</span>
          </div>
          {isExpress && (
            <p className="mt-1 text-right text-[11px] font-bold text-amber-700 dark:text-amber-300">
              Avec Express 24h : {formatFCFA(quote.total * 2)}
            </p>
          )}
        </div>
      )}
    </section>
  );
};
