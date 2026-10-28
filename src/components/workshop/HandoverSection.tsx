import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { isHomeDeliveryOrder } from '../../lib/logistics';
import {
  formatPackageCount,
  getOrderStorageCode,
  getOrderStorageLabel,
  hasLegacyStorage,
  hasStructuredStorage,
} from '../../lib/storage';
import { DeliveryProofPanel } from '../logistics/DeliveryProofPanel';
import { StorageAssignmentModal } from './StorageAssignmentModal';
import { Check, Camera, CheckCircle2, ShieldCheck, Truck, Eye, Archive, AlertTriangle, MapPin } from 'lucide-react';

export const HandoverSection: React.FC = () => {
  const {
    activeHandoverOrder,
    orders,
    logisticsTasks,
    settleAndDeliverOrder,
    showToast,
    focusLogisticsTask,
    setPreviewTicket,
    focusStorageOrder,
  } = useApp();

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
  const [storageModalOpen, setStorageModalOpen] = useState(false);

  // Toujours relire la version courante de la commande : l’objet sélectionné
  // peut dater d’avant un encaissement ou une livraison.
  const order = activeHandoverOrder
    ? orders.find((o) => o.id === activeHandoverOrder.id) ?? activeHandoverOrder
    : null;

  if (!order) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-6 text-center text-zinc-500 dark:text-zinc-400 shadow-2xs">
        <p className="font-semibold text-[14px]">Aucune commande sélectionnée pour la remise</p>
        <p className="text-[12px] mt-1 text-zinc-400 dark:text-zinc-500">
          Choisissez une commande prête dans la liste ci-dessus, ou depuis l'onglet Production (colonne « Prêts à remettre »).
        </p>
      </div>
    );
  }

  if (isHomeDeliveryOrder(order)) {
    // La preuve vit sur la tournée, pas sur la commande : on la relit ici pour
    // que le comptoir puisse la montrer au client sans changer d'écran.
    const deliveryTask = order.deliveryTaskId
      ? logisticsTasks.find((task) => task.id === order.deliveryTaskId)
      : undefined;
    return (
      <div className="bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white" aria-hidden="true">
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100">
                {order.ticketNumber} est une livraison à domicile
              </h2>
              <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Elle ne doit pas être encaissée dans l’écran de remise comptoir. Ouvrez sa tournée
                pour démarrer la livraison puis confirmer la remise et le paiement éventuel.
              </p>
              <p className="mt-1 text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-200">
                Reste à encaisser : {formatFCFA(order.remainingBalance)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {order.deliveryTaskId && (
              <button
                type="button"
                onClick={() => focusLogisticsTask(order.deliveryTaskId as string)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Truck className="h-4 w-4" aria-hidden="true" /> Ouvrir dans Tournées
              </button>
            )}
            <button
              type="button"
              onClick={() => setPreviewTicket(order)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3.5 py-2 text-[12.5px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <Eye className="h-4 w-4" aria-hidden="true" /> Voir le ticket
            </button>
          </div>
        </div>

        <div className="mt-3">
          {deliveryTask ? (
            <DeliveryProofPanel task={deliveryTask} />
          ) : (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[12.5px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              Aucune tournée n’est rattachée à cette commande : la preuve de remise sera
              enregistrée depuis la tournée de livraison.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (order.status !== 'ready') {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-6 text-center text-zinc-500 dark:text-zinc-400 shadow-2xs">
        <p className="font-semibold text-[14px] text-zinc-800 dark:text-zinc-200">
          {order.ticketNumber} n’est plus en attente de remise comptoir
        </p>
        <p className="mx-auto mt-1 max-w-md text-[12.5px]">
          Son statut actuel ne permet plus un nouvel encaissement ici. Sélectionnez une autre
          commande prête dans la liste ci-dessus.
        </p>
        <button
          type="button"
          onClick={() => setPreviewTicket(order)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3.5 py-2 text-[12.5px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
        >
          <Eye className="h-4 w-4" aria-hidden="true" /> Voir le ticket
        </button>
      </div>
    );
  }

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSettle = (method: 'especes' | 'wave' | 'momo' | 'om') => {
    settleAndDeliverOrder(order.id, method);
  };

  const storageLabel = getOrderStorageLabel(order);
  const storageCode = getOrderStorageCode(order);
  const isStructuredStored = hasStructuredStorage(order);
  const isLegacyStored = hasLegacyStorage(order);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-4 shadow-2xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
        <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100">
          Remise en cours — {order.ticketNumber} • {order.customerName}{' '}
          <span className="font-normal text-zinc-500 dark:text-zinc-400 text-[12.5px]">{order.customerPhone}</span>
        </h2>
        {isStructuredStored ? (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 w-fit">
            <MapPin className="w-3 h-3" aria-hidden="true" /> À récupérer : {storageCode} • {formatPackageCount(order)}
          </span>
        ) : isLegacyStored ? (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1 w-fit">
            <MapPin className="w-3 h-3" aria-hidden="true" /> Repère noté : {storageLabel}
          </span>
        ) : (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1 w-fit">
            <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Emplacement non renseigné
          </span>
        )}
      </div>

      <div
        className={`mb-3 flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] sm:flex-row sm:items-center sm:justify-between ${
          isStructuredStored
            ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100'
            : isLegacyStored
              ? 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
              : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100'
        }`}
      >
        <div className="flex items-start gap-2">
          {isStructuredStored || isLegacyStored ? (
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <div>
            <p className="font-bold">
              {isStructuredStored
                ? `Récupérez les paquets en ${storageLabel}`
                : isLegacyStored
                  ? `Ancien repère : ${storageLabel}`
                  : 'Aucun casier n’a été enregistré pour cette commande'}
            </p>
            <p className="mt-0.5 leading-relaxed opacity-80">
              {isStructuredStored
                ? `${formatPackageCount(order)}${order.storedAt ? ` • rangée le ${order.storedAt}` : ''}${order.storageNotes ? ` • ${order.storageNotes}` : ''}`
                : isLegacyStored
                  ? 'Convertissez ce texte libre en emplacement configuré pour suivre les paquets et l’occupation.'
                  : 'Rangez-la maintenant pour que l’équipe la retrouve immédiatement à l’arrivée du client.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setStorageModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 dark:bg-zinc-100 px-2.5 py-1.5 text-[12px] font-bold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            {isStructuredStored ? 'Déplacer' : 'Ranger'}
          </button>
          <button
            type="button"
            onClick={() => focusStorageOrder(order.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white/70 dark:bg-zinc-900/70 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            Voir dans Rangement
          </button>
        </div>
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
                  ? 'border-zinc-300 dark:border-zinc-600 bg-zinc-50/60 dark:bg-zinc-800/60'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 opacity-60'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleCheck(line.id)}
                className="w-4 h-4 accent-black rounded cursor-pointer"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {line.quantity} × {line.name}
                </p>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11.5px] truncate">
                  Contrôlé ✓ • cintre + housse
                </p>
              </div>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums shrink-0">
                {formatFCFA(line.subtotal)}
              </span>
            </label>
          );
        })}
      </div>

      {/* Quality Control & Balance row */}
      <div className="flex flex-wrap items-center gap-2 mt-3 text-[12px] pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <span className="font-bold text-zinc-700 dark:text-zinc-300">Contrôle qualité :</span>
        <button
          type="button"
          onClick={() => setQcState((p) => ({ ...p, propre: !p.propre }))}
          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors ${
            qcState.propre ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          ✓ Propre
        </button>
        <button
          type="button"
          onClick={() => setQcState((p) => ({ ...p, repasse: !p.repasse }))}
          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors ${
            qcState.repasse ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          ✓ Repassé
        </button>
        <button
          type="button"
          onClick={() => setQcState((p) => ({ ...p, boutons: !p.boutons }))}
          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full transition-colors ${
            qcState.boutons ? 'bg-emerald-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
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
            qcState.photo ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          <Camera className="w-3 h-3" /> Photo {qcState.photo ? 'prise ✓' : 'avant/après'}
        </button>

        <span className="ml-auto font-bold text-zinc-800 dark:text-zinc-200 text-[12.5px] tabular-nums">
          Total {formatFCFA(order.total)} • Acompte {formatFCFA(order.depositPaid)} •{' '}
          <span className="text-purple-700 dark:text-purple-300 font-extrabold">
            Reste {formatFCFA(order.remainingBalance)}
          </span>
        </span>
      </div>

      {/* Payment methods row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[13px] font-bold">
        <button
          type="button"
          onClick={() => handleSettle('especes')}
          className="border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg py-2.5 transition-all text-zinc-800 dark:text-zinc-200 shadow-2xs"
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
          className="border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg py-2.5 transition-all text-zinc-800 dark:text-zinc-200 shadow-2xs"
        >
          MTN MoMo
        </button>
        <button
          type="button"
          onClick={() => handleSettle('om')}
          className="border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg py-2.5 transition-all text-zinc-800 dark:text-zinc-200 shadow-2xs"
        >
          Orange Money
        </button>
      </div>

      {storageModalOpen && (
        <StorageAssignmentModal
          key={`handover-storage-${order.id}`}
          order={order}
          mode="assign"
          onClose={() => setStorageModalOpen(false)}
        />
      )}
    </div>
  );
};
