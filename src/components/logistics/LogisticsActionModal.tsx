import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, PackageCheck, Truck, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ModalShell } from '../common/ModalShell';
import { formatFCFA } from '../../data/demoData';
import {
  LOGISTICS_ISSUE_REASON_LABELS,
  PAYMENT_METHOD_LABELS,
  formatLogisticsSchedule,
} from '../../lib/logistics';
import {
  formatPackageCount,
  getOrderStorageLabel,
  hasStructuredStorage,
} from '../../lib/storage';
import { DeliveryProofFields } from './DeliveryProofFields';
import type { DeliveryProofDraft } from '../../lib/deliveryProof';
import type { LogisticsIssueReason, LogisticsTask, PaymentMethod } from '../../types';

export type LogisticsActionRequest =
  | { type: 'complete_pickup'; task: LogisticsTask }
  | { type: 'complete_delivery'; task: LogisticsTask }
  | { type: 'fail'; task: LogisticsTask }
  | { type: 'cancel'; task: LogisticsTask };

interface LogisticsActionModalProps {
  action: LogisticsActionRequest;
  onClose: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['especes', 'wave', 'momo', 'om'];

export const LogisticsActionModal: React.FC<LogisticsActionModalProps> = ({ action, onClose }) => {
  const {
    orders,
    shopSettings,
    completePickupTask,
    completeDeliveryTask,
    failLogisticsTask,
    cancelLogisticsTask,
  } = useApp();

  const { task } = action;
  const order = useMemo(
    () => (task.orderId ? orders.find((o) => o.id === task.orderId) : undefined),
    [orders, task.orderId]
  );

  const [collectedBags, setCollectedBags] = useState(
    task.collectedBags ? String(task.collectedBags) : task.estimatedBags ? String(task.estimatedBags) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('especes');
  const [reason, setReason] = useState<LogisticsIssueReason>(
    action.type === 'cancel' ? 'customer_request' : 'customer_absent'
  );
  const [notes, setNotes] = useState('');
  const [proofDraft, setProofDraft] = useState<DeliveryProofDraft>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasProofDraft = Boolean(
    proofDraft.photoDataUrl ||
      proofDraft.signatureDataUrl ||
      proofDraft.codeEntered ||
      proofDraft.receiverName ||
      proofDraft.note
  );
  const isDirty = notes.trim() !== '' || collectedBags.trim() !== '' || hasProofDraft;

  const title =
    action.type === 'complete_pickup'
      ? 'Confirmer la collecte'
      : action.type === 'complete_delivery'
        ? 'Confirmer la livraison'
        : action.type === 'fail'
          ? 'Signaler un échec de tournée'
          : 'Annuler cette tournée ?';

  const subtitle = `${task.customerName} • ${formatLogisticsSchedule(task.scheduledDate, task.timeSlot)}`;
  const icon =
    action.type === 'complete_pickup' ? (
      <PackageCheck className="w-5 h-5 text-emerald-400" aria-hidden="true" />
    ) : action.type === 'complete_delivery' ? (
      <Truck className="w-5 h-5 text-emerald-400" aria-hidden="true" />
    ) : action.type === 'fail' ? (
      <AlertTriangle className="w-5 h-5 text-amber-400" aria-hidden="true" />
    ) : (
      <XCircle className="w-5 h-5 text-red-400" aria-hidden="true" />
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (action.type === 'complete_pickup' && collectedBags.trim()) {
      const bags = Number(collectedBags);
      if (!Number.isInteger(bags) || bags < 1 || bags > 99) {
        setError('Le nombre de sacs collectés doit être un entier entre 1 et 99, ou rester vide.');
        return;
      }
    }
    if ((action.type === 'fail' || action.type === 'cancel') && reason === 'other' && !notes.trim()) {
      setError('Précisez le motif dans la note lorsque « Autre motif » est choisi.');
      return;
    }

    setIsSubmitting(true);
    const result =
      action.type === 'complete_pickup'
        ? completePickupTask(task.id, collectedBags.trim() ? Number(collectedBags) : undefined)
        : action.type === 'complete_delivery'
          ? completeDeliveryTask(task.id, paymentMethod, proofDraft)
          : action.type === 'fail'
            ? failLogisticsTask(task.id, reason, notes || undefined)
            : cancelLogisticsTask(task.id, reason, notes || undefined);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  const labelClass = 'block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1';
  const inputClass =
    'w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100';

  return (
    <ModalShell title={title} subtitle={subtitle} icon={icon} onClose={onClose} isDirty={isDirty}>
      <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-[13px]">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-[12.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          <p>
            <strong className="text-zinc-950 dark:text-zinc-50">{task.customerName}</strong> • {task.customerPhone}
          </p>
          <p>
            {task.address}
            {task.addressDetails ? ` — ${task.addressDetails}` : ''}
          </p>
          {task.orderTicketNumber && <p>Commande liée : <strong>{task.orderTicketNumber}</strong></p>}
        </div>

        {action.type === 'complete_pickup' && (
          <>
            <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
              Le linge est bien entre les mains du coursier. La tournée passera en
              « collectée » ; aucune commande ni aucun montant ne seront créés avant le
              comptage des pièces à la boutique.
            </p>
            <div>
              <label htmlFor="logistics-collected-bags" className={labelClass}>
                Nombre de sacs réellement collectés
              </label>
              <input
                id="logistics-collected-bags"
                type="number"
                min={1}
                max={99}
                step={1}
                inputMode="numeric"
                value={collectedBags}
                onChange={(e) => {
                  setCollectedBags(e.target.value);
                  setError(null);
                }}
                placeholder="Non renseigné"
                className={inputClass}
              />
            </div>
          </>
        )}

        {action.type === 'complete_delivery' && (
          <>
            {order ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                    <span className="block text-zinc-500 dark:text-zinc-400">Total commande</span>
                    <strong className="text-[14px] tabular-nums text-zinc-950 dark:text-zinc-50">{formatFCFA(order.total)}</strong>
                  </div>
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
                    <span className="block text-zinc-500 dark:text-zinc-400">
                      {task.status === 'en_route' ? 'Dernier emplacement avant départ' : 'Emplacement à récupérer'}
                    </span>
                    <strong className="text-[14px] text-zinc-950 dark:text-zinc-50">
                      {getOrderStorageLabel(order) ?? 'Non renseigné'}
                      {hasStructuredStorage(order) ? ` • ${formatPackageCount(order)}` : ''}
                    </strong>
                  </div>
                </div>

                {order.remainingBalance > 0 ? (
                  <fieldset>
                    <legend className={labelClass}>
                      Solde à encaisser maintenant : {formatFCFA(order.remainingBalance)}
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map((method) => (
                        <button
                          key={method}
                          type="button"
                          aria-pressed={paymentMethod === method}
                          onClick={() => setPaymentMethod(method)}
                          className={`rounded-lg border px-3 py-2.5 font-bold transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${
                            paymentMethod === method
                              ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                              : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {PAYMENT_METHOD_LABELS[method]}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      La confirmation créditera la caisse une seule fois, soldera la commande
                      et la marquera comme livrée. Vérifiez la réception du paiement avec le client.
                    </p>
                  </fieldset>
                ) : (
                  <p className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-3 py-2.5 text-emerald-900 dark:text-emerald-100">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Commande déjà soldée : aucun montant n’est à encaisser par le coursier.</span>
                  </p>
                )}
                <DeliveryProofFields
                  value={proofDraft}
                  onChange={(next) => {
                    setProofDraft(next);
                    setError(null);
                  }}
                  settings={shopSettings.deliveryProof}
                  expectedCode={task.deliveryCode}
                  onError={setError}
                />
              </>
            ) : (
              <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2.5 font-medium text-red-700 dark:text-red-300">
                La commande liée est introuvable dans les données locales. La livraison ne peut pas être confirmée.
              </p>
            )}
          </>
        )}

        {(action.type === 'fail' || action.type === 'cancel') && (
          <>
            <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
              {action.type === 'fail'
                ? 'La tournée restera dans « À traiter » afin de pouvoir la reprogrammer. Pour une livraison, la commande reste prête à la boutique.'
                : 'La tournée quittera les files actives mais restera dans l’historique, avec possibilité de la reprogrammer.'}
            </p>
            <div>
              <label htmlFor="logistics-issue-reason" className={labelClass}>Motif *</label>
              <select
                id="logistics-issue-reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value as LogisticsIssueReason);
                  setError(null);
                }}
                className={inputClass}
              >
                {(Object.keys(LOGISTICS_ISSUE_REASON_LABELS) as LogisticsIssueReason[]).map((key) => (
                  <option key={key} value={key}>{LOGISTICS_ISSUE_REASON_LABELS[key]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="logistics-issue-notes" className={labelClass}>Note interne</label>
              <textarea
                id="logistics-issue-notes"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setError(null);
                }}
                rows={3}
                placeholder="Ce qui s’est passé et ce qui a été convenu avec le client…"
                className={inputClass}
              />
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-[12px] font-medium text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold px-4 py-2.5 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            Retour
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (action.type === 'complete_delivery' && !order)}
            className={`font-bold px-5 py-2.5 rounded-xl text-[13px] text-white shadow disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              action.type === 'fail'
                ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-600'
                : action.type === 'cancel'
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600'
                  : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-600'
            }`}
          >
            {action.type === 'complete_pickup'
              ? 'Confirmer la collecte'
              : action.type === 'complete_delivery'
                ? order && order.remainingBalance > 0
                  ? `Encaisser ${formatFCFA(order.remainingBalance)} & livrer`
                  : 'Confirmer la livraison'
                : action.type === 'fail'
                  ? 'Marquer en échec'
                  : 'Annuler la tournée'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
