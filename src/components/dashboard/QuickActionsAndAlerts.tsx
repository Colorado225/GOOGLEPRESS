import React from 'react';
import { useApp } from '../../context/AppContext';

export const QuickActionsAndAlerts: React.FC = () => {
  const { setActiveScreen, setClosingZModalOpen, notifyAllSms, setPreviewTicket, orders } = useApp();

  const handleTicketClick = (ticketNum: string) => {
    const found = orders.find((o) => o.ticketNumber === ticketNum);
    if (found) {
      setPreviewTicket(found);
    }
  };

  return (
    <div className="space-y-3">
      {/* Actions rapides */}
      <div className="bg-white border border-zinc-200/90 rounded-xl p-4 shadow-2xs">
        <h2 className="font-bold text-[14px] text-zinc-900 mb-2.5">Actions rapides</h2>
        <div className="grid grid-cols-2 gap-2 text-[12.5px] font-semibold text-zinc-800">
          <button
            onClick={() => setActiveScreen('pos')}
            className="border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 rounded-lg py-2.5 px-2 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>🧾</span> <span>Réception</span>
          </button>
          <button
            onClick={() => setActiveScreen('workshop')}
            className="border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 rounded-lg py-2.5 px-2 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>💰</span> <span>Encaisser</span>
          </button>
          <button
            onClick={notifyAllSms}
            className="border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 rounded-lg py-2.5 px-2 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>📲</span> <span>Relance SMS</span>
          </button>
          <button
            onClick={() => setClosingZModalOpen(true)}
            className="border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 rounded-lg py-2.5 px-2 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>📊</span> <span>Clôture Z</span>
          </button>
        </div>
      </div>

      {/* Retards prioritaires */}
      <div className="bg-white border border-zinc-200/90 rounded-xl p-4 shadow-2xs">
        <div className="flex justify-between items-center mb-2.5">
          <h2 className="font-bold text-[14px] text-zinc-900">Retards prioritaires</h2>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            6 tickets
          </span>
        </div>

        <div className="space-y-2 text-[12.5px]">
          {/* Item 1 */}
          <div
            onClick={() => handleTicketClick('#TK-2841')}
            className="flex justify-between items-center border border-zinc-200 hover:border-zinc-300 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-zinc-50 transition-colors"
          >
            <div>
              <p className="font-bold text-zinc-900">#TK-2841 • Yao Kouassi</p>
              <p className="text-zinc-500 text-[11.5px]">2 costumes • promis hier 17h</p>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
              J+1
            </span>
          </div>

          {/* Item 2 */}
          <div
            onClick={() => handleTicketClick('#TK-2836')}
            className="flex justify-between items-center border border-zinc-200 hover:border-zinc-300 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-zinc-50 transition-colors"
          >
            <div>
              <p className="font-bold text-zinc-900">#TK-2836 • Aïcha Koné</p>
              <p className="text-zinc-500 text-[11.5px]">Boubou bazin • 4 500 FCFA</p>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Jour J
            </span>
          </div>

          {/* Item 3 */}
          <div
            onClick={() => handleTicketClick('#TK-2831')}
            className="flex justify-between items-center border border-zinc-200 hover:border-zinc-300 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-zinc-50 transition-colors"
          >
            <div>
              <p className="font-bold text-zinc-900">#TK-2831 • Marc Yao</p>
              <p className="text-zinc-500 text-[11.5px]">Hôtel — 35 draps / housses</p>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Jour J
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
