import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatPromised, getPromisedDate, toISODate, todayISO } from '../../lib/dates';
import type { PickupOption } from '../../types';

export const PickupOptionsSection: React.FC = () => {
  const {
    pickupOption,
    setPickupOption,
    promisedDateISO,
    setPromisedDateISO,
    orderNotes,
    setOrderNotes,
  } = useApp();

  // Dates de retrait réelles, calculées depuis aujourd'hui (règles dans lib/dates.ts).
  const standardLabel = formatPromised(getPromisedDate('standard'));
  const expressLabel = formatPromised(getPromisedDate('express'));
  const delayedLabel = formatPromised(getPromisedDate('delayed'));
  const isCustom = promisedDateISO !== null;

  // Les trois options calculées effacent une éventuelle date libre.
  const selectOption = (option: PickupOption) => {
    setPickupOption(option);
    setPromisedDateISO(null);
  };

  // La date libre est toujours au tarif standard : seul le service
  // Express 24h vaut ×2. Cliquer la carte pré-remplit le standard (J+2),
  // libre à la caissière de choisir ensuite n'importe quel jour à venir.
  const selectCustom = () => {
    setPickupOption('standard');
    if (!promisedDateISO) {
      setPromisedDateISO(toISODate(getPromisedDate('standard')));
    }
  };

  const cardClass = (selected: boolean) =>
    `border-2 rounded-xl p-3 cursor-pointer transition-all flex flex-col justify-between ${
      selected
        ? 'border-black bg-zinc-50/80 dark:bg-zinc-800/80 shadow-xs'
        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900'
    }`;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-4 shadow-2xs">
      <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100 mb-2.5">3 • Retrait & consignes</h2>

      {/* 4 options de retrait : 3 délais calculés + date libre */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-[13px]">
        <label onClick={() => selectOption('standard')} className={cardClass(pickupOption === 'standard' && !isCustom)}>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="pickup"
              checked={pickupOption === 'standard' && !isCustom}
              onChange={() => selectOption('standard')}
              className="accent-black w-4 h-4 cursor-pointer"
            />
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{standardLabel}</span>
          </div>
          <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-1 pl-6">Standard 48h — inclus</p>
        </label>

        <label onClick={() => selectOption('express')} className={cardClass(pickupOption === 'express' && !isCustom)}>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="pickup"
              checked={pickupOption === 'express' && !isCustom}
              onChange={() => selectOption('express')}
              className="accent-black w-4 h-4 cursor-pointer"
            />
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{expressLabel}</span>
          </div>
          <p className="text-[11.5px] text-amber-700 dark:text-amber-300 font-semibold mt-1 pl-6">
            Express 24h — ×2
          </p>
        </label>

        <label onClick={() => selectOption('delayed')} className={cardClass(pickupOption === 'delayed' && !isCustom)}>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="pickup"
              checked={pickupOption === 'delayed' && !isCustom}
              onChange={() => selectOption('delayed')}
              className="accent-black w-4 h-4 cursor-pointer"
            />
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{delayedLabel}</span>
          </div>
          <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-1 pl-6">Différé samedi</p>
        </label>

        <label onClick={selectCustom} className={cardClass(isCustom)}>
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="pickup"
              checked={isCustom}
              onChange={selectCustom}
              className="accent-black w-4 h-4 cursor-pointer"
            />
            <span className="font-bold text-zinc-900 dark:text-zinc-100">Date libre</span>
          </div>
          <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-1 pl-6">
            N’importe quel jour à venir — tarif standard
          </p>
          <input
            type="date"
            aria-label="Date de retrait libre"
            value={promisedDateISO ?? ''}
            min={todayISO()}
            onChange={(e) => {
              setPickupOption('standard');
              setPromisedDateISO(e.target.value || null);
            }}
            className="mt-2 ml-6 w-[calc(100%-1.5rem)] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
        </label>
      </div>

      {/* Notes textarea */}
      <div className="mt-3">
        <label className="block text-[11.5px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
          Consignes spécifiques atelier & repassage
        </label>
        <textarea
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
          rows={2}
          placeholder="Ex: Tache de sauce sur boubou, bouton manche gauche fragile..."
          className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-[13px] text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 bg-zinc-50/40 dark:bg-zinc-800/40"
        />
      </div>
    </div>
  );
};
