import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Eye,
  Hourglass,
  KeyRound,
  MapPin,
  Navigation,
  PackageCheck,
  Pencil,
  Phone,
  Play,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Truck,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ModalShell } from '../common/ModalShell';
import { DeliveryProofPanel } from './DeliveryProofPanel';
import { formatFCFA } from '../../data/demoData';
import {
  LOGISTICS_ISSUE_REASON_LABELS,
  LOGISTICS_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatLogisticsDateTime,
  formatLogisticsSchedule,
  getPhoneHref,
  sortCourierCandidates,
} from '../../lib/logistics';
import {
  formatPackageCount,
  getOrderStorageLabel,
  hasStructuredStorage,
} from '../../lib/storage';
import { buildDeliveryItinerary } from '../../lib/deliveryRoute';
import { describeDeliveryProof, hasDeliveryProof } from '../../lib/deliveryProof';
import type { LogisticsTask, OrderStatus } from '../../types';
import type { LogisticsActionRequest } from './LogisticsActionModal';

interface LogisticsTaskCardProps {
  task: LogisticsTask;
  onEdit: (task: LogisticsTask) => void;
  onAction: (action: LogisticsActionRequest) => void;
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Réceptionnée',
  washing: 'En lavage',
  ironing: 'En repassage / finition',
  ready: 'Prête',
  delivered: 'Déjà remise',
};

const STATUS_CLASSES: Record<LogisticsTask['status'], string> = {
  scheduled: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600',
  en_route: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  completed: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  failed: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  cancelled: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600',
};

const buttonBase =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100';
const primaryButton = `${buttonBase} bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-2xs`;
const successButton = `${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs`;
const secondaryButton = `${buttonBase} border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800`;
const warningButton = `${buttonBase} border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900`;
const dangerButton = `${buttonBase} border border-red-300 dark:border-red-700 bg-white dark:bg-zinc-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950`;

export const LogisticsTaskCard: React.FC<LogisticsTaskCardProps> = ({ task, onEdit, onAction }) => {
  const {
    orders,
    employees,
    assignLogisticsTask,
    startLogisticsTask,
    markLogisticsTaskArrived,
    startOrderFromPickupTask,
    setPreviewTicket,
    focusedLogisticsTaskId,
    showToast,
  } = useApp();

  const [proofOpen, setProofOpen] = useState(false);
  const order = useMemo(
    () => (task.orderId ? orders.find((o) => o.id === task.orderId) : undefined),
    [orders, task.orderId]
  );
  const courierCandidates = useMemo(() => sortCourierCandidates(employees), [employees]);
  const currentAssigneeUnavailable =
    task.assignedEmployeeId &&
    !courierCandidates.some((employee) => employee.id === task.assignedEmployeeId);

  const isPickup = task.kind === 'pickup';
  const pickupAwaitingConversion =
    isPickup && task.status === 'completed' && !task.orderId;
  const deliveryReady = !isPickup && order?.status === 'ready';
  const canShowStart = task.status === 'scheduled' && (isPickup || deliveryReady);

  const handleAssign = (employeeId: string) => {
    const result = assignLogisticsTask(task.id, employeeId);
    if (!result.ok) showToast(result.error);
  };

  const handleStart = () => {
    const result = startLogisticsTask(task.id);
    if (!result.ok) showToast(result.error);
  };

  const handleArrived = () => {
    const result = markLogisticsTaskArrived(task.id);
    if (!result.ok) showToast(result.error);
  };

  const itinerary = buildDeliveryItinerary(task);
  // Liens utiles tant que la tournée est ouverte ; le code disparaît une fois
  // la livraison confirmée (il ne sert qu'avant la remise).
  const showItineraryLinks =
    Boolean(itinerary) && task.status !== 'completed' && task.status !== 'cancelled';
  const showDeliveryCode = !isPickup && Boolean(task.deliveryCode) && task.status !== 'completed';

  const feeLabel = task.fee > 0 ? formatFCFA(task.fee) : 'Offerte';

  return (
    <article
      id={`logistics-task-${task.id}`}
      tabIndex={-1}
      aria-label={`${isPickup ? 'Ramassage' : 'Livraison'} pour ${task.customerName}, ${LOGISTICS_STATUS_LABELS[task.status]}`}
      className={`scroll-mt-24 rounded-xl border bg-white dark:bg-zinc-900 p-3.5 shadow-2xs outline-none transition-shadow ${
        focusedLogisticsTaskId === task.id
          ? 'border-blue-500 ring-2 ring-blue-300 dark:ring-blue-700'
          : 'border-zinc-200 dark:border-zinc-700'
      } ${isPickup ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-blue-500'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black text-white ${
              isPickup ? 'bg-emerald-600' : 'bg-blue-600'
            }`}
          >
            {isPickup ? (
              <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isPickup ? 'Ramassage' : 'Livraison'}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_CLASSES[task.status]}`}>
            {pickupAwaitingConversion ? 'Collecté — à compter' : LOGISTICS_STATUS_LABELS[task.status]}
          </span>
          {task.orderTicketNumber && (
            <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-950">
              {task.orderTicketNumber}
            </span>
          )}
        </div>
        <p className="inline-flex items-center gap-1.5 text-[12px] font-bold text-zinc-800 dark:text-zinc-200">
          <CalendarClock className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
          {formatLogisticsSchedule(task.scheduledDate, task.timeSlot)}
        </p>
      </div>

      <div className="mt-3 grid gap-2 text-[12.5px] sm:grid-cols-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-extrabold text-zinc-950 dark:text-zinc-50">{task.customerName}</p>
          <a
            href={getPhoneHref(task.customerPhone)}
            className="mt-0.5 inline-flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            {task.customerPhone}
          </a>
        </div>
        <p className="flex items-start gap-1.5 text-zinc-700 dark:text-zinc-300">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
          <span>
            <span className="font-semibold">{task.address}</span>
            {task.addressDetails && <span className="block text-zinc-500 dark:text-zinc-400">{task.addressDetails}</span>}
          </span>
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-2.5 text-[12px] lg:grid-cols-4">
        <div>
          <dt className="text-zinc-500 dark:text-zinc-400">Frais de course</dt>
          <dd className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{feeLabel}</dd>
        </div>
        {isPickup ? (
          <>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Sacs annoncés</dt>
              <dd className="font-bold text-zinc-900 dark:text-zinc-100">{task.estimatedBags ?? 'Non renseigné'}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Sacs collectés</dt>
              <dd className="font-bold text-zinc-900 dark:text-zinc-100">{task.collectedBags ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Commande</dt>
              <dd className="font-bold text-zinc-900 dark:text-zinc-100">
                {task.orderTicketNumber ?? (task.status === 'completed' ? 'À créer après comptage' : 'Pas encore collecté')}
              </dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Production</dt>
              <dd className="font-bold text-zinc-900 dark:text-zinc-100">
                {order ? ORDER_STATUS_LABELS[order.status] : 'Commande introuvable'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">
                {task.status === 'en_route' || task.status === 'completed'
                  ? 'Dernier emplacement'
                  : 'Emplacement'}
              </dt>
              <dd className="font-bold text-zinc-900 dark:text-zinc-100">
                {order
                  ? `${getOrderStorageLabel(order) ?? 'Non renseigné'}${hasStructuredStorage(order) ? ` • ${formatPackageCount(order)}` : ''}`
                  : 'Non renseigné'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">À encaisser</dt>
              <dd className={`font-bold tabular-nums ${order && order.remainingBalance > 0 ? 'text-purple-700 dark:text-purple-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {order ? (order.remainingBalance > 0 ? formatFCFA(order.remainingBalance) : 'Soldé') : '—'}
              </dd>
            </div>
          </>
        )}
      </dl>

      {!isPickup && order && (
        <p className="mt-2 line-clamp-2 text-[12px] text-zinc-600 dark:text-zinc-400">
          <span className="font-bold text-zinc-800 dark:text-zinc-200">Articles :</span>{' '}
          {order.lines.map((line) => `${line.quantity}× ${line.name}`).join(' • ')}
        </p>
      )}

      {task.instructions && (
        <p className="mt-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-2.5 py-2 text-[12px] italic text-zinc-600 dark:text-zinc-400">
          « {task.instructions} »
        </p>
      )}

      {(showItineraryLinks || showDeliveryCode) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {showItineraryLinks && itinerary && (
            <>
              <a
                href={itinerary.googleMaps}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-[12px] font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                Itinéraire
              </a>
              <a
                href={itinerary.waze}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-[12px] font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                Waze
              </a>
            </>
          )}
          {showDeliveryCode && task.deliveryCode && (
            <span className="ml-auto inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Code de remise
              <strong className="tabular-nums tracking-[0.3em]">{task.deliveryCode}</strong>
              <span className="font-normal opacity-80">à communiquer au client</span>
            </span>
          )}
        </div>
      )}

      {task.arrivedAt && (
        <p className="mt-2 text-[12px] text-zinc-600 dark:text-zinc-400">
          Arrivé sur place le{' '}
          <strong className="text-zinc-900 dark:text-zinc-100">{formatLogisticsDateTime(task.arrivedAt)}</strong>
        </p>
      )}

      {pickupAwaitingConversion && (
        <p className="mt-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-2 text-[12px] font-medium text-emerald-800 dark:text-emerald-200">
          Linge arrivé à la boutique : comptez les pièces dans le POS pour créer le ticket et appliquer le frais de ramassage.
        </p>
      )}

      {!isPickup && task.status === 'scheduled' && order && order.status !== 'ready' && order.status !== 'delivered' && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-2.5 py-2 text-[12px] font-medium text-amber-800 dark:text-amber-200">
          <Hourglass className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          En attente de production : le départ sera possible dès que la commande passera en « Prête ».
        </p>
      )}

      {!isPickup && (!order || order.status === 'delivered') && task.status !== 'completed' && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-2.5 py-2 text-[12px] font-medium text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {order
            ? 'La commande est déjà marquée comme remise : cette tournée ne doit plus partir.'
            : 'La commande liée est introuvable dans ce navigateur : cette tournée ne peut pas partir.'}
        </p>
      )}

      {(task.status === 'failed' || task.status === 'cancelled') && task.issueReason && (
        <p className="mt-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-2.5 py-2 text-[12px] text-red-700 dark:text-red-300">
          <strong>{LOGISTICS_ISSUE_REASON_LABELS[task.issueReason]}</strong>
          {task.issueNotes ? ` — ${task.issueNotes}` : ''}
        </p>
      )}

      {!isPickup && task.status === 'completed' && (
        <p
          className={`mt-2 rounded-lg border px-2.5 py-2 text-[12px] ${
            hasDeliveryProof(task.proof)
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
              : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
          }`}
        >
          {hasDeliveryProof(task.proof) ? (
            <>
              <strong>Preuve de remise :</strong> {describeDeliveryProof(task.proof).join(' • ')}
            </>
          ) : (
            'Remise confirmée par le coursier, sans preuve enregistrée.'
          )}
        </p>
      )}

      {task.status === 'completed' && (
        <p className="mt-2 text-[12px] text-zinc-600 dark:text-zinc-400">
          Terminée le <strong className="text-zinc-900 dark:text-zinc-100">{formatLogisticsDateTime(task.completedAt)}</strong>
          {!isPickup && task.collectedAmount !== undefined && (
            <>
              {' '}• Encaissé :{' '}
              <strong className="tabular-nums text-zinc-900 dark:text-zinc-100">
                {task.collectedAmount > 0
                  ? `${formatFCFA(task.collectedAmount)}${task.collectedPaymentMethod ? ` (${PAYMENT_METHOD_LABELS[task.collectedPaymentMethod]})` : ''}`
                  : '0 FCFA (déjà soldé)'}
              </strong>
            </>
          )}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1 lg:max-w-xs">
          {task.status === 'scheduled' || task.status === 'failed' ? (
            <label htmlFor={`logistics-assignee-${task.id}`} className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Coursier / employé
            </label>
          ) : (
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Coursier / employé
            </span>
          )}
          {task.status === 'scheduled' || task.status === 'failed' ? (
            <select
              id={`logistics-assignee-${task.id}`}
              value={task.assignedEmployeeId ?? ''}
              onChange={(e) => handleAssign(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-2 text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <option value="">À assigner</option>
              {currentAssigneeUnavailable && task.assignedEmployeeId && (
                <option value={task.assignedEmployeeId} disabled>
                  {task.assignedEmployeeName ?? 'Employé assigné'} (indisponible)
                </option>
              )}
              {courierCandidates.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName} — {employee.position}
                </option>
              ))}
            </select>
          ) : (
            <p className="py-1 text-[12.5px] font-bold text-zinc-800 dark:text-zinc-200">
              {task.assignedEmployeeName ?? 'Non assigné'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 lg:justify-end">
          {(task.status === 'scheduled' || task.status === 'failed' || task.status === 'cancelled') && (
            <button type="button" onClick={() => onEdit(task)} className={secondaryButton}>
              {task.status === 'scheduled' ? <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
              {task.status === 'scheduled' ? 'Modifier' : 'Reprogrammer'}
            </button>
          )}

          {canShowStart && (
            <button type="button" onClick={handleStart} className={primaryButton}>
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Démarrer
            </button>
          )}

          {task.status === 'en_route' && isPickup && (
            <button type="button" onClick={() => onAction({ type: 'complete_pickup', task })} className={successButton}>
              <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Confirmer la collecte
            </button>
          )}

          {task.status === 'en_route' && !isPickup && (
            <button type="button" onClick={() => onAction({ type: 'complete_delivery', task })} className={successButton}>
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              Confirmer la livraison
            </button>
          )}

          {task.status === 'en_route' && !task.arrivedAt && (
            <button type="button" onClick={handleArrived} className={secondaryButton}>
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Arrivé sur place
            </button>
          )}

          {task.status === 'en_route' && (
            <button type="button" onClick={() => onAction({ type: 'fail', task })} className={warningButton}>
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Signaler un échec
            </button>
          )}

          {(task.status === 'scheduled' || task.status === 'failed') && (
            <button type="button" onClick={() => onAction({ type: 'cancel', task })} className={dangerButton}>
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Annuler
            </button>
          )}

          {pickupAwaitingConversion && (
            <button type="button" onClick={() => startOrderFromPickupTask(task.id)} className={successButton}>
              <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
              Compter &amp; créer la commande
            </button>
          )}

          {!isPickup && task.status === 'completed' && (
            <button type="button" onClick={() => setProofOpen(true)} className={secondaryButton}>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Preuve de remise
            </button>
          )}

          {task.status === 'completed' && order && (
            <button type="button" onClick={() => setPreviewTicket(order)} className={secondaryButton}>
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Voir le ticket
            </button>
          )}

          {!isPickup && task.status !== 'completed' && order && (
            <button type="button" onClick={() => setPreviewTicket(order)} className={secondaryButton}>
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Ticket
            </button>
          )}
        </div>
      </div>

      {proofOpen && (
        <ModalShell
          title="Preuve de remise"
          subtitle={`${task.orderTicketNumber ?? 'Livraison'} • ${task.customerName}`}
          icon={<ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />}
          onClose={() => setProofOpen(false)}
          maxWidthClass="max-w-lg"
        >
          <div className="space-y-3 p-5 text-[13px]">
            <DeliveryProofPanel task={task} />
            <p className="text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Cette fiche est en lecture seule : elle reflète ce qui a été enregistré au moment de
              la livraison. Adresse : {task.address}
              {task.addressDetails ? ` — ${task.addressDetails}` : ''}.
            </p>
          </div>
        </ModalShell>
      )}
    </article>
  );
};
