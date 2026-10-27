import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatPromised, getPromisedDate } from '../../lib/dates';

export const PickupOptionsSection: React.FC = () => {
  const { pickupOption, setPickupOption, orderNotes, setOrderNotes } = useApp();

  // Dates de retrait réelles, calculées depuis aujourd'hui (règles dans lib/dates.ts).
  const standardLabel = formatPromised(getPromisedDate('standard'));
  const expressLabel = formatPromised(getPromisedDate('express'));
  const delayedLabel = formatPromised(getPromisedDate('delayed'));

  return (
    <div className="bg-white border border-zinc-200/90 rounded-xl p-4 shadow-2xs">
      <h2 className="font-bold text-[14.5px] text-zinc-900 mb-2.5">3 • Retrait & consignes</h2>

      {/* 3 Radio options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[13px]">
        <label
          onClick={() => setPickupOption('standard')}
          className={`border-2 rounded-xl p-3 cursor-pointer transition-all flex flex-col justify-between ${
            pickupOption === 'standard'
              ? 'border-black bg-zinc-50/80 shadow-xs'
              : 'border-zinc-200 hover:border-zinc-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="pickup"
              checked={pickupOption === 'standard'}
              onChange={() => setPickupOption('standard')}
              className="accent-black w-4 h-4 cursor-pointer"
            />
            <span className="font-bold text-zinc-900">{standardLabel}</span>
          </div>
          <p className="text-[11.5px] text-zinc-500 mt-1 pl-6">Standard 48h — inclus</p>
        </label>

        <label
          onClick={() => setPickupOption('express')}
          className={`border-2 rounded-xl p-3 cursor-pointer transition-all flex flex-col justify-between ${
            pickupOption === 'express'
              ? 'border-black bg-zinc-50/80 shadow-xs'
              : 'border-zinc-200 hover:border-zinc-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="pickup"
              checked={pickupOption === 'express'}
              onChange={() => setPickupOption('express')}
              className="accent-black w-4 h-4 cursor-pointer"
            />
            <span className="font-bold text-zinc-900">{expressLabel}</span>
          </div>
          <p className="text-[11.5px] text-amber-700 font-semibold mt-1 pl-6">
            Express +50 %
          </p>
        </label>

        <label
          onClick={() => setPickupOption('delayed')}
          className={`border-2 rounded-xl p-3 cursor-pointer transition-all flex flex-col justify-between ${
            pickupOption === 'delayed'
              ? 'border-black bg-zinc-50/80 shadow-xs'
              : 'border-zinc-200 hover:border-zinc-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <input
              type="radio"
              name="pickup"
              checked={pickupOption === 'delayed'}
              onChange={() => setPickupOption('delayed')}
              className="accent-black w-4 h-4 cursor-pointer"
            />
            <span className="font-bold text-zinc-900">{delayedLabel}</span>
          </div>
          <p className="text-[11.5px] text-zinc-500 mt-1 pl-6">Différé samedi</p>
        </label>
      </div>

      {/* Notes textarea */}
      <div className="mt-3">
        <label className="block text-[11.5px] font-bold text-zinc-500 uppercase tracking-wide mb-1">
          Consignes spécifiques atelier & repassage
        </label>
        <textarea
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
          rows={2}
          placeholder="Ex: Tache de sauce sur boubou, bouton manche gauche fragile..."
          className="w-full border border-zinc-200 rounded-lg p-2.5 text-[13px] text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-zinc-50/40"
        />
      </div>
    </div>
  );
};
