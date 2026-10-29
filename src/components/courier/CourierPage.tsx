import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Flag,
  MapPinned,
  Navigation,
  PackageCheck,
  Phone,
  Play,
  TriangleAlert,
  Truck,
  UserRound,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ModalShell } from '../common/ModalShell';
import { LogisticsActionModal, type LogisticsActionRequest } from '../logistics/LogisticsActionModal';
import { DestinationPickerModal } from '../logistics/DestinationPickerModal';
import {
  CourierTrackingControl,
  stopActiveCourierWatch,
} from '../logistics/CourierTrackingControl';
import { formatFCFA } from '../../data/demoData';
import { formatISODateLongFr, todayISO } from '../../lib/dates';
import {
  getCourierStops,
  getNextCourierStop,
  persistActiveCourierId,
  readStoredActiveCourierId,
  resolveActiveCourierId,
  summarizeCourierTour,
} from '../../lib/courierTour';
import { buildDeliveryItinerary } from '../../lib/deliveryRoute';
import { describeDeliveryProof, hasDeliveryProof } from '../../lib/deliveryProof';
import { formatLogisticsSchedule, getPhoneHref, sortCourierCandidates } from '../../lib/logistics';
import type { LogisticsTask } from '../../types';

/**
 * Écran coursier — mobile d'abord.
 *
 * Objectif : une main, dehors, parfois sous le soleil. Gros boutons, une seule
 * colonne, l'ordre réel des arrêts, et rien qui demande de réfléchir.
 *
 * L'identité du coursier est un choix local : les comptes de connexion ne sont
 * pas encore reliés aux fiches employés. Le dernier choix est mémorisé sur
 * l'appareil, et le sélecteur reste visible pour les tournées partagées.
 */

const primaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#09090b] px-4 py-3 text-[14px] font-bold text-white shadow transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100';
const successButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-[14px] font-bold text-white shadow transition-colors hover:bg-emerald-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500';
const secondaryButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-[14px] font-bold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100';
const dangerButton =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-3 text-[14px] font-bold text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950 focus:outline-none focus:ring-2 focus:ring-red-500';

export const CourierPage: React.FC = () => {
  const {
    employees,
    logisticsTasks,
    orders,
    shopSettings,
    startLogisticsTask,
    markLogisticsTaskArrived,
    showToast,
  } = useApp();

  const [courierId, setCourierId] = useState<string | null>(() =>
    resolveActiveCourierId(employees, readStoredActiveCourierId())
  );
  const [actionRequest, setActionRequest] = useState<LogisticsActionRequest | null>(null);
  const [destinationTask, setDestinationTask] = useState<LogisticsTask | null>(null);
  const [endOpen, setEndOpen] = useState(false);

  const today = todayISO();
  // Personnel « Livraison » d’abord : le coursier se trouve en tête de liste.
  const activeEmployees = useMemo(() => sortCourierCandidates(employees), [employees]);
  // Le coursier mémorisé peut avoir été désactivé depuis le dernier passage.
  const resolvedCourierId = resolveActiveCourierId(employees, courierId);
  const courier = activeEmployees.find((employee) => employee.id === resolvedCourierId);

  const stops = useMemo(
    () => getCourierStops(logisticsTasks, resolvedCourierId, today),
    [logisticsTasks, resolvedCourierId, today]
  );
  const summary = useMemo(() => summarizeCourierTour(stops, orders), [stops, orders]);
  const nextStop = getNextCourierStop(stops);
  const enRouteStop = stops.find((task) => task.status === 'en_route');
  const gps = shopSettings.deliveryGps;
  const tourFinished = summary.total > 0 && summary.pending === 0 && summary.enRoute === 0;

  const selectCourier = (employeeId: string) => {
    setCourierId(employeeId);
    persistActiveCourierId(employeeId);
  };

  const handleStart = (task: LogisticsTask) => {
    const result = startLogisticsTask(task.id);
    if (!result.ok) showToast(result.error);
  };

  const handleArrived = (task: LogisticsTask) => {
    const result = markLogisticsTaskArrived(task.id);
    if (!result.ok) showToast(result.error);
  };

  const finishTour = () => {
    stopActiveCourierWatch();
    setEndOpen(false);
    showToast('✓ Tournée terminée — le partage de position est arrêté.');
  };

  return (
    <div className="flex-1 p-3 sm:p-5 max-w-3xl w-full mx-auto">
      {/* En-tête */}
      <div className="mb-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-[18px] font-extrabold text-zinc-950 dark:text-zinc-50">
              <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              Ma tournée
            </h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-zinc-500 dark:text-zinc-400">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {formatISODateLongFr(today)}
            </p>
          </div>

          {activeEmployees.length > 1 ? (
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-400">
              <UserRound className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Coursier</span>
              <select
                value={resolvedCourierId ?? ''}
                onChange={(event) => selectCourier(event.target.value)}
                className="min-h-10 rounded-lg border border-zinc-300 bg-white px-2.5 text-[13px] font-bold text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            courier && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-[12.5px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                {courier.fullName}
              </span>
            )
          )}
        </div>

        {courier && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                À faire
              </span>
              <strong className="text-[16px] tabular-nums text-zinc-950 dark:text-zinc-50">
                {summary.pending + summary.failed}
              </strong>
            </div>
            <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                En route
              </span>
              <strong className="text-[16px] tabular-nums text-blue-700 dark:text-blue-300">
                {summary.enRoute}
              </strong>
            </div>
            <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Terminées
              </span>
              <strong className="text-[16px] tabular-nums text-emerald-700 dark:text-emerald-300">
                {summary.done}
              </strong>
            </div>
            <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Encaissé
              </span>
              <strong className="text-[14px] tabular-nums text-zinc-950 dark:text-zinc-50">
                {formatFCFA(summary.collectedXof)}
              </strong>
            </div>
          </div>
        )}

        {courier && summary.dueXof > 0 && (
          <p className="mt-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-[12.5px] font-semibold text-purple-900 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-100">
            Reste à encaisser sur cette tournée : {formatFCFA(summary.dueXof)}
          </p>
        )}
      </div>

      {/* Bandeau position */}
      <div className="mb-3 rounded-2xl border border-blue-200 bg-blue-50 p-3.5 text-[12.5px] text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
        {!gps.enabled ? (
          <p className="flex items-start gap-1.5">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            La carte est désactivée pour l’établissement. Les arrêts restent utilisables, sans
            point sur la carte ni heure d’arrivée.
          </p>
        ) : !gps.trackPositions ? (
          <p className="flex items-start gap-1.5">
            <MapPinned className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Le partage de position est désactivé. Le responsable peut l’autoriser dans Paramètres →
            Ramassage &amp; livraison.
          </p>
        ) : enRouteStop ? (
          <div className="space-y-1.5">
            <p className="font-semibold">
              Course en cours vers {enRouteStop.customerName} — partagez votre position pour que le
              comptoir suive l’arrivée.
            </p>
            <CourierTrackingControl taskId={enRouteStop.id} allowed={gps.trackPositions} />
          </div>
        ) : (
          <p className="flex items-start gap-1.5">
            <MapPinned className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Démarrez une course pour pouvoir partager votre position. Aucune position n’est envoyée
            tant que vous ne l’avez pas demandé.
          </p>
        )}
      </div>

      {/* Tournée terminée */}
      {tourFinished && (
        <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
          <p className="flex items-center gap-2 text-[14.5px] font-extrabold text-emerald-900 dark:text-emerald-100">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            Tournée terminée
          </p>
          <p className="mt-1 text-[12.5px] text-emerald-900/80 dark:text-emerald-100/80">
            {summary.done} arrêt(s) traité(s) · {formatFCFA(summary.collectedXof)} encaissés ·{' '}
            {summary.proofs} preuve(s) de remise enregistrée(s).
          </p>
          <button type="button" onClick={() => setEndOpen(true)} className={`${primaryButton} mt-3 w-full`}>
            <Flag className="h-4 w-4" aria-hidden="true" />
            Terminer la tournée
          </button>
        </div>
      )}

      {/* Arrêts */}
      {!courier ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-200">
            Aucun employé actif
          </p>
          <p className="mt-1 text-[12.5px] text-zinc-500 dark:text-zinc-400">
            Ajoutez un coursier dans Personnel, puis assignez-lui des tournées.
          </p>
        </div>
      ) : stops.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-200">
            Aucune tournée pour {courier.fullName} aujourd’hui
          </p>
          <p className="mt-1 text-[12.5px] text-zinc-500 dark:text-zinc-400">
            Les ramassages et livraisons assignés apparaîtront ici, dans l’ordre des créneaux.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {stops.map((task, index) => {
            const order = task.orderId ? orders.find((item) => item.id === task.orderId) : undefined;
            const itinerary = buildDeliveryItinerary(task);
            const isPickup = task.kind === 'pickup';
            const due = !isPickup && task.status !== 'completed' ? Math.max(0, order?.remainingBalance ?? 0) : 0;
            const isNext = nextStop?.id === task.id;

            return (
              <article
                key={task.id}
                aria-label={`${isPickup ? 'Ramassage' : 'Livraison'} ${index + 1} — ${task.customerName}`}
                className={`rounded-2xl border bg-white p-4 shadow-2xs dark:bg-zinc-900 ${
                  isNext
                    ? 'border-blue-400 ring-2 ring-blue-200 dark:border-blue-600 dark:ring-blue-900'
                    : 'border-zinc-200 dark:border-zinc-700'
                }`}
              >
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
                    {isPickup ? 'Ramassage' : 'Livraison'} {index + 1}
                  </span>
                  <span className="rounded-full border border-zinc-300 px-2.5 py-1 text-[11px] font-bold text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
                    {formatLogisticsSchedule(task.scheduledDate, task.timeSlot)}
                  </span>
                  {task.orderTicketNumber && (
                    <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-950">
                      {task.orderTicketNumber}
                    </span>
                  )}
                  {task.status === 'completed' && (
                    <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white">
                      Terminée
                    </span>
                  )}
                  {task.status === 'failed' && (
                    <span className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">
                      Échec
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[17px] font-extrabold leading-tight text-zinc-950 dark:text-zinc-50">
                  {task.customerName}
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-zinc-600 dark:text-zinc-400">
                  {task.address}
                  {task.addressDetails ? ` — ${task.addressDetails}` : ''}
                </p>

                {due > 0 && (
                  <p className="mt-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-[13px] font-semibold text-purple-900 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-100">
                    À encaisser : <strong className="tabular-nums">{formatFCFA(due)}</strong>
                  </p>
                )}

                {task.status === 'completed' && (
                  <p className="mt-2 text-[12.5px] text-zinc-600 dark:text-zinc-400">
                    {isPickup
                      ? 'Linge collecté — comptage à la boutique.'
                      : hasDeliveryProof(task.proof)
                        ? `Preuve : ${describeDeliveryProof(task.proof).join(' • ')}`
                        : 'Livrée, sans preuve enregistrée.'}
                  </p>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {itinerary && task.status !== 'completed' ? (
                    <a
                      href={itinerary.googleMaps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${secondaryButton} border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100 dark:hover:bg-blue-900`}
                    >
                      <Navigation className="h-4 w-4" aria-hidden="true" />
                      Itinéraire
                    </a>
                  ) : (
                    <span />
                  )}
                  <a href={getPhoneHref(task.customerPhone)} className={secondaryButton}>
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Appeler
                  </a>
                </div>

                {task.status === 'scheduled' && (
                  <button type="button" onClick={() => handleStart(task)} className={`${primaryButton} mt-2 w-full`}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Démarrer
                  </button>
                )}

                {task.status === 'en_route' && (
                  <div className="mt-2 space-y-2">
                    {!task.arrivedAt && (
                      <button
                        type="button"
                        onClick={() => handleArrived(task)}
                        className={`${secondaryButton} w-full`}
                      >
                        <MapPinned className="h-4 w-4" aria-hidden="true" />
                        Arrivé sur place
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setActionRequest({
                          type: isPickup ? 'complete_pickup' : 'complete_delivery',
                          task,
                        })
                      }
                      className={`${successButton} w-full`}
                    >
                      {isPickup ? (
                        <PackageCheck className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Truck className="h-4 w-4" aria-hidden="true" />
                      )}
                      {isPickup ? 'Confirmer la collecte' : 'Confirmer la livraison'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionRequest({ type: 'fail', task })}
                      className={`${dangerButton} w-full`}
                    >
                      <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                      Signaler un échec
                    </button>
                  </div>
                )}

                {!isPickup && task.status !== 'completed' && task.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => setDestinationTask(task)}
                    className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 text-[12.5px] font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    <MapPinned className="h-4 w-4" aria-hidden="true" />
                    {task.destination ? 'Modifier le point de livraison' : 'Placer le point de livraison'}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {actionRequest && (
        <LogisticsActionModal action={actionRequest} onClose={() => setActionRequest(null)} />
      )}

      {destinationTask && (
        <DestinationPickerModal task={destinationTask} onClose={() => setDestinationTask(null)} />
      )}

      {endOpen && (
        <ModalShell
          title="Terminer la tournée ?"
          subtitle={`${summary.done} arrêt(s) traité(s)`}
          icon={<Flag className="h-5 w-5 text-emerald-400" aria-hidden="true" />}
          onClose={() => setEndOpen(false)}
        >
          <div className="space-y-3 p-5 text-[13px]">
            <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
              Le partage de position s’arrête immédiatement. Les commandes restent consultables dans
              l’ERP, et les livraisons déjà confirmées gardent leur preuve.
            </p>
            <ul className="space-y-1 rounded-lg border border-zinc-200 px-3 py-2 text-[12.5px] dark:border-zinc-700">
              <li>
                Arrêts traités : <strong>{summary.done}</strong>
              </li>
              <li>
                Encaissé : <strong className="tabular-nums">{formatFCFA(summary.collectedXof)}</strong>
              </li>
              <li>
                Preuves de remise : <strong>{summary.proofs}</strong>
              </li>
              {summary.failed > 0 && (
                <li className="text-red-700 dark:text-red-300">
                  Échecs à reprogrammer : <strong>{summary.failed}</strong>
                </li>
              )}
            </ul>
            <div className="flex flex-col-reverse justify-end gap-2 pt-1 sm:flex-row">
              <button
                type="button"
                onClick={() => setEndOpen(false)}
                className="rounded-xl border border-zinc-300 px-4 py-2.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                Continuer
              </button>
              <button
                type="button"
                onClick={finishTour}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-[13px] font-bold text-white shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                Terminer
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};
