import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { Check, Camera, CheckCircle2, ShieldCheck } from 'lucide-react';

export const HandoverSection: React.FC = () => {
  const { activeHandoverOrder, settleAndDeliverOrder, showToast } = useApp();

  const [checkedItems, setCheckedItems] = useState<{ [id: string]: boolean }>({
    'l4': true,
    'l5': true,
  });

  const [qcState, setQcState] = useState({
    propre: true,
    repasse: true,
    boutons: true,
    photo: false,
  });

  const order = activeHandoverOrder;

  if (!order) {
    return (
      <div className="bg-white border border-zinc-200/90 rounded-xl p-6 text-center text-zinc-500 shadow-2xs">
        <p className="font-semibold text-[14px]">Aucune commande sélectionnée pour la remise</p>
        <p className="text-[12px] mt-1 text-zinc-400">
          Sélectionnez une commande dans la colonne « Prêts à remettre » ci-dessus.
        </p>
      </div>
    );
  }

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSettle = (method: 'especes' | 'wave' | 'momo' | 'om') => {
    settleAndDeliverOrder(order.id, method);
  };

  return (
    <div className="bg-white border border-zinc-200/90 rounded-xl p-4 shadow-2xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
        <h2 className="font-bold text-[14.5px] text-zinc-900">
          Remise en cours — {order.ticketNumber} • {order.customerName}{' '}
          <span className="font-normal text-zinc-500 text-[12.5px]">{order.customerPhone}</span>
        </h2>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
          <CheckCircle2 className="w-3 h-3" /> Sac retrouvé : {order.rackLocation || 'Étagère B-04'} ✓
        </span>
      </div>

      {/* Item Checkboxes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
        {order.lines.map((line) => {
          const isChecked = checkedItems[line.id] ?? true;
          return (
            <label
              key={line.id}
              onClick={() => toggleCheck(line.id)}
              className={`border rounded-lg p-3 flex gap-3 items-center cursor-pointer transition-all ${
                isChecked
                  ? 'border-zinc-300 bg-zinc-50/60'
                  : 'border-zinc-200 bg-white opacity-60'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleCheck(line.id)}
                className="w-4 h-4 accent-black rounded cursor-pointer"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-zinc-900 truncate">
                  {line.quantity} × {line.name}
                </p>
                <p className="text-zinc-500 text-[11.5px] truncate">
                  Contrôlé ✓ • cintre + housse
                </p>
              </div>
              <span className="font-bold text-zinc-900 tabular-nums shrink-0">
                {formatFCFA(line.subtotal)}
              </span>
            </label>
          );
        })}
      </div>

      {/* Quality Control & Balance row */}
      <div className="flex flex-wrap items-center gap-2 mt-3 text-[12px] pt-3 border-t border-zinc-100">
        <span className="font-bold text-zinc-700">Contrôle qualité :</span>
        <button
          type="button"
          onClick={() => setQcState((p) => ({ ...p, propre: !p.propre }))}
          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors ${
            qcState.propre ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-600'
          }`}
        >
          ✓ Propre
        </button>
        <button
          type="button"
          onClick={() => setQcState((p) => ({ ...p, repasse: !p.repasse }))}
          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors ${
            qcState.repasse ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-600'
          }`}
        >
          ✓ Repassé
        </button>
        <button
          type="button"
          onClick={() => setQcState((p) => ({ ...p, boutons: !p.boutons }))}
          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors ${
            qcState.boutons ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-600'
          }`}
        >
          ✓ Boutons
        </button>
        <button
          type="button"
          onClick={() => {
            setQcState((p) => ({ ...p, photo: !p.photo }));
            showToast('📷 Photo avant/après enregistrée pour la fiche client');
          }}
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
            qcState.photo ? 'bg-blue-600 text-white' : 'bg-zinc-200 text-zinc-700'
          }`}
        >
          <Camera className="w-3 h-3" /> Photo {qcState.photo ? 'prise ✓' : 'avant/après'}
        </button>

        <span className="ml-auto font-bold text-zinc-800 text-[12.5px] tabular-nums">
          Total {formatFCFA(order.total)} • Acompte {formatFCFA(order.depositPaid)} •{' '}
          <span className="text-purple-700 font-extrabold">
            Reste {formatFCFA(order.remainingBalance)}
          </span>
        </span>
      </div>

      {/* Payment methods row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[13px] font-bold">
        <button
          type="button"
          onClick={() => handleSettle('especes')}
          className="border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 rounded-lg py-2.5 transition-all text-zinc-800 shadow-2xs"
        >
          💵 Espèces
        </button>
        <button
          type="button"
          onClick={() => handleSettle('wave')}
          className="rounded-lg py-2.5 bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all flex items-center justify-center gap-1"
        >
          <span>Wave {order.remainingBalance > 0 ? formatFCFA(order.remainingBalance) : ''}</span> <span>🟠</span>
        </button>
        <button
          type="button"
          onClick={() => handleSettle('momo')}
          className="border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 rounded-lg py-2.5 transition-all text-zinc-800 shadow-2xs"
        >
          MTN MoMo
        </button>
        <button
          type="button"
          onClick={() => handleSettle('om')}
          className="border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 rounded-lg py-2.5 transition-all text-zinc-800 shadow-2xs"
        >
          Orange Money
        </button>
      </div>
    </div>
  );
};
