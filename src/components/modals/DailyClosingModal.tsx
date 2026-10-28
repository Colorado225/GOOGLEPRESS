import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { formatDate } from '../../lib/dates';
import { X, Lock, CheckCircle2, Printer, ShieldAlert } from 'lucide-react';

export const DailyClosingModal: React.FC = () => {
  const { closingZModalOpen, setClosingZModalOpen, cashRegister, showToast } = useApp();
  const [countedCash, setCountedCash] = useState(
    (cashRegister.cashAmount + cashRegister.floatAmount).toString()
  );
  const [closed, setClosed] = useState(false);

  if (!closingZModalOpen) return null;

  const totalTheoriqueEspeces = cashRegister.cashAmount + cashRegister.floatAmount;
  const countedNum = parseInt(countedCash.replace(/\D/g, ''), 10) || 0;
  const variance = countedNum - totalTheoriqueEspeces;

  const handleValidateZ = () => {
    setClosed(true);
    showToast('🔒 Clôture Z effectuée avec succès ! Rapport de caisse archivé.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-[15px]">Clôture de caisse journalière (Z)</h3>
          </div>
          <button
            onClick={() => setClosingZModalOpen(false)}
            className="text-zinc-400 dark:text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-[13px]">
          <div className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3.5 space-y-2">
            <p className="font-bold text-zinc-900 dark:text-zinc-100 text-[13.5px]">Récapitulatif des encaissements</p>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-700 text-[12.5px]">
              <div className="flex justify-between py-1 text-zinc-600 dark:text-zinc-400">
                <span>Espèces encaissées</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {formatFCFA(cashRegister.cashAmount)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-zinc-600 dark:text-zinc-400">
                <span>Wave Money 🟠</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {formatFCFA(cashRegister.waveAmount)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-zinc-600 dark:text-zinc-400">
                <span>MTN MoMo / Orange Money</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {formatFCFA(cashRegister.momoAmount)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 text-zinc-900 dark:text-zinc-100 font-bold border-t border-zinc-300 dark:border-zinc-600">
                <span>Total chiffre d'affaires</span>
                <span className="text-[14px] tabular-nums">{formatFCFA(cashRegister.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Physical Cash Count */}
          <div className="space-y-2">
            <label className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
              Comptage physique espèces (avec fond de caisse {formatFCFA(cashRegister.floatAmount)}) :
            </label>
            <div className="relative">
              <input
                type="number"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-[15px] font-bold text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 font-bold text-xs">
                FCFA
              </span>
            </div>
            <div className="flex justify-between text-[11.5px] px-1">
              <span className="text-zinc-500 dark:text-zinc-400">
                Théorique : {formatFCFA(totalTheoriqueEspeces)}
              </span>
              <span
                className={`font-bold ${
                  variance === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : variance > 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                Écart : {formatFCFA(variance)} {variance === 0 && '✓ Parfait'}
              </span>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-blue-50/70 dark:bg-blue-950/70 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900">
            ℹ La clôture Z verrouille la journée comptable du {formatDate(new Date())} et prépare le fond de roulement pour le lendemain.
          </p>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setClosingZModalOpen(false)}
              className="flex-1 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-lg py-2.5 transition-colors"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleValidateZ}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg py-2.5 shadow transition-colors flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Valider le rapport Z</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
