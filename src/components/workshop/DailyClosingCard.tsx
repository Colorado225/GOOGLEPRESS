import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { Printer, Lock, CheckCircle2 } from 'lucide-react';

export const DailyClosingCard: React.FC = () => {
  const { cashRegister, setClosingZModalOpen, showToast } = useApp();

  return (
    <div className="bg-[#09090b] border border-zinc-800 text-white rounded-xl p-4 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[14.5px] text-white tracking-tight">
            Caisse — clôture du jour
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> En équilibre
          </span>
        </div>
        <p className="text-[12px] text-zinc-400 mt-0.5">
          Poste 01 • Awa Koné • 27/10/2026
        </p>

        {/* 3 Payment modes breakdown */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
            <p className="text-[10.5px] text-zinc-400 uppercase tracking-wide font-medium">
              ESPÈCES
            </p>
            <p className="font-extrabold text-[14.5px] text-zinc-100 tabular-nums mt-0.5">
              {new Intl.NumberFormat('fr-FR').format(cashRegister.cashAmount)}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
            <p className="text-[10.5px] text-zinc-400 uppercase tracking-wide font-medium">
              WAVE
            </p>
            <p className="font-extrabold text-[14.5px] text-zinc-100 tabular-nums mt-0.5">
              {new Intl.NumberFormat('fr-FR').format(cashRegister.waveAmount)}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
            <p className="text-[10.5px] text-zinc-400 uppercase tracking-wide font-medium">
              MTN / OM
            </p>
            <p className="font-extrabold text-[14.5px] text-zinc-100 tabular-nums mt-0.5">
              {new Intl.NumberFormat('fr-FR').format(cashRegister.momoAmount)}
            </p>
          </div>
        </div>

        {/* Total encaissé */}
        <div className="flex justify-between items-baseline mt-3 pt-3 border-t border-zinc-800/80">
          <span className="text-[13px] text-zinc-300 font-medium">Total encaissé</span>
          <span className="font-black text-[18px] text-white tracking-tight tabular-nums">
            {formatFCFA(cashRegister.totalAmount)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
          <div
            className="h-1.5 bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: '92%' }}
          />
        </div>

        <p className="text-[11.5px] text-zinc-400 mt-1.5 tabular-nums flex items-center justify-between">
          <span>Fond de caisse {formatFCFA(cashRegister.floatAmount)}</span>
          <span className="text-emerald-400 font-bold">Écart 0 FCFA ✓</span>
        </p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-2">
        <button
          type="button"
          onClick={() => showToast('🖨 Impression du ticket récapitulatif & reçu de caisse en cours...')}
          className="bg-white hover:bg-zinc-100 text-black rounded-lg py-2.5 text-[13px] font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Ticket + Reçu</span>
        </button>
        <button
          type="button"
          onClick={() => setClosingZModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-[13px] font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Clôture Z</span>
        </button>
      </div>
    </div>
  );
};
