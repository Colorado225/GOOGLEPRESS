import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatPromised, getPromisedDate, toISODate, todayISO } from '../../lib/dates';
import { isOrderLineExpress, resolveOrderPickupOption } from '../../lib/pricing';
import type { PickupOption } from '../../types';

export const PickupOptionsSection: React.FC = () => {
  const {
    pickupOption,
    setPickupOption,
    cartLines,
    promisedDateISO,
    setPromisedDateISO,
    orderNotes,
    setOrderNotes,
  } = useApp();

  const standardLabel = formatPromised(getPromisedDate('standard'));
  const expressLabel = formatPromised(getPromisedDate('express'));
  const delayedLabel = formatPromised(getPromisedDate('delayed'));
  const isCustom = promisedDateISO !== null;
  const expressLines = cartLines.filter((line) => isOrderLineExpress(line, pickupOption)).length;
  const normalLines = cartLines.length - expressLines;
  const hasExpressLines = expressLines > 0;
  const effectivePickupOption = resolveOrderPickupOption(cartLines, pickupOption);

  // Ces options ne pilotent que les commandes sans ligne Express. Elles ne
  // modifient jamais isExpress et ne peuvent donc pas changer les prix du panier.
  const selectOption = (option: Exclude<PickupOption, 'express'>) => {
    if (hasExpressLines) return;
    setPickupOption(option);
    setPromisedDateISO(null);
  };

  const selectCustom = () => {
    if (hasExpressLines) return;
    setPickupOption('standard');
    if (!promisedDateISO) {
      setPromisedDateISO(toISODate(getPromisedDate('standard')));
    }
  };

  const cardClass = (selected: boolean, disabled = false) =>
    `border-2 rounded-xl p-3 transition-all flex flex-col justify-between ${
      selected
        ? 'border-black bg-zinc-50/80 dark:bg-zinc-800/80 shadow-xs'
        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
    } ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600'}`;

  return (
    <section className="rounded-[22px] border border-zinc-200/90 bg-white p-4 shadow-2xs sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4">
        <h2 className="text-[14.5px] font-black text-zinc-900 dark:text-zinc-100">Délai de retrait & consignes atelier</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Le délai se règle article par article à l’étape 2. La priorité atelier suit automatiquement les lignes Express.
        </p>
      </div>

      {hasExpressLines && (
        <div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <strong>Priorité Express 24h :</strong> {expressLines} ligne{expressLines > 1 ? 's' : ''} Express
          {normalLines > 0 && (
            <> et {normalLines} ligne{normalLines > 1 ? 's' : ''} Normal, sans majoration sur {normalLines > 1 ? 'ces lignes' : 'cette ligne'}.</>
          )}
          {normalLines === 0 && '.'} Les options Standard, Différé et date libre restent désactivées tant qu’une ligne Express est présente.
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
        <label onClick={() => selectOption('standard')} className={cardClass(!hasExpressLines && effectivePickupOption === 'standard' && !isCustom, hasExpressLines)}>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="pickup"
              checked={!hasExpressLines && effectivePickupOption === 'standard' && !isCustom}
              disabled={hasExpressLines}
              onChange={() => selectOption('standard')}
              className="accent-black w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{standardLabel}</span>
          </div>
          <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-1 pl-6">Sans ligne Express — Standard 48h inclus</p>
        </label>

        <div aria-label="Priorité Express 24h" className={cardClass(hasExpressLines, !hasExpressLines)}>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="pickup"
              aria-label="Express 24h dérivé des articles"
              checked={hasExpressLines}
              readOnly
              disabled={!hasExpressLines}
              className="accent-black w-4 h-4"
            />
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{expressLabel}</span>
          </div>
          <p className="text-[11.5px] text-amber-700 dark:text-amber-300 font-semibold mt-1 pl-6">
            Au moins une ligne Express — ×2 sur ces lignes uniquement
          </p>
        </div>

        <label onClick={() => selectOption('delayed')} className={cardClass(!hasExpressLines && effectivePickupOption === 'delayed' && !isCustom, hasExpressLines)}>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="pickup"
              checked={!hasExpressLines && effectivePickupOption === 'delayed' && !isCustom}
              disabled={hasExpressLines}
              onChange={() => selectOption('delayed')}
              className="accent-black w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{delayedLabel}</span>
          </div>
          <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-1 pl-6">Différé samedi, sans ligne Express</p>
        </label>

        <label onClick={selectCustom} className={cardClass(!hasExpressLines && isCustom, hasExpressLines)}>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="pickup"
              checked={!hasExpressLines && isCustom}
              disabled={hasExpressLines}
              onChange={selectCustom}
              className="accent-black w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
            />
            <span className="font-bold text-zinc-900 dark:text-zinc-100">Date libre</span>
          </div>
          <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-1 pl-6">Disponible sans ligne Express</p>
          <input
            type="date"
            aria-label="Date de retrait libre"
            value={promisedDateISO ?? ''}
            min={todayISO()}
            disabled={hasExpressLines}
            onChange={(e) => {
              if (hasExpressLines) return;
              setPickupOption('standard');
              setPromisedDateISO(e.target.value || null);
            }}
            className="pos-field pos-field-compact ml-6 mt-2 w-[calc(100%-1.5rem)] disabled:cursor-not-allowed"
          />
        </label>
      </div>

      <div className="mt-3">
        <label htmlFor="pos-order-notes" className="pos-field-label">
          Consignes spécifiques atelier & repassage <span className="font-normal normal-case">(optionnel)</span>
        </label>
        <textarea
          id="pos-order-notes"
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
          rows={2}
          placeholder="Ex: Tache de sauce sur boubou, bouton manche gauche fragile..."
          className="pos-field"
        />
      </div>
    </section>
  );
};
