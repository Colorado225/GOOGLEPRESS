import React, { useMemo, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, Clock3, PackageCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ModalShell } from '../common/ModalShell';
import { SegmentedControl } from '../common/SegmentedControl';
import type { LaundryOrder, StorageLocation } from '../../types';
import {
  STORAGE_ZONE_DESCRIPTIONS,
  STORAGE_ZONE_LABELS,
  calculateStorageOccupancy,
  formatStorageLocation,
  getOrderPackageCount,
  getOrderStorageLabel,
  getSuggestedStorageLocation,
  getSuggestedStorageZone,
  hasStructuredStorage,
  sortStorageLocations,
  type StorageOccupancy,
} from '../../lib/storage';

export type StorageAssignmentMode = 'mark_ready' | 'assign';

interface StorageAssignmentModalProps {
  order: LaundryOrder;
  mode: StorageAssignmentMode;
  onClose: () => void;
}

type ReadyChoice = 'store_now' | 'store_later';

export const StorageAssignmentModal: React.FC<StorageAssignmentModalProps> = ({
  order,
  mode,
  onClose,
}) => {
  const {
    orders,
    logisticsTasks,
    storageLocations,
    markOrderReadyAndStore,
    assignOrderStorage,
  } = useApp();

  const currentOrder = orders.find((item) => item.id === order.id) ?? order;
  const selectableLocations = useMemo(
    () =>
      sortStorageLocations(storageLocations).filter(
        (location) =>
          location.isActive ||
          (mode === 'assign' && location.id === currentOrder.storageLocationId)
      ),
    [currentOrder.storageLocationId, mode, storageLocations]
  );
  const occupancyByLocation = useMemo(
    () => calculateStorageOccupancy(orders, logisticsTasks),
    [logisticsTasks, orders]
  );
  const suggestedZone = getSuggestedStorageZone(currentOrder);

  const occupancyExcludingCurrent = (location: StorageLocation): StorageOccupancy => {
    const base = occupancyByLocation.get(location.id) ?? {
      orderCount: 0,
      packageCount: 0,
      unknownPackageOrders: 0,
    };
    if (currentOrder.storageLocationId !== location.id || currentOrder.status !== 'ready') {
      return base;
    }
    const currentPackages = getOrderPackageCount(currentOrder);
    return {
      orderCount: Math.max(0, base.orderCount - 1),
      packageCount: Math.max(0, base.packageCount - (currentPackages ?? 0)),
      unknownPackageOrders: Math.max(
        0,
        base.unknownPackageOrders - (currentPackages ? 0 : 1)
      ),
    };
  };

  const initialLocationId = useMemo(() => {
    if (
      currentOrder.storageLocationId &&
      selectableLocations.some((location) => location.id === currentOrder.storageLocationId)
    ) {
      return currentOrder.storageLocationId;
    }
    return (
      getSuggestedStorageLocation(
        currentOrder,
        selectableLocations,
        occupancyByLocation
      )?.id ?? ''
    );
    // Le choix initial ne doit pas changer pendant que l'employé saisit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialPackageCount = String(getOrderPackageCount(currentOrder) ?? 1);
  const initialNotes = currentOrder.storageNotes ?? '';

  const initialReadyChoice: ReadyChoice =
    mode === 'mark_ready' && selectableLocations.length === 0 ? 'store_later' : 'store_now';
  const [readyChoice, setReadyChoice] = useState<ReadyChoice>(initialReadyChoice);
  const [locationId, setLocationId] = useState(initialLocationId);
  const [packageCount, setPackageCount] = useState(initialPackageCount);
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedLocation = selectableLocations.find((location) => location.id === locationId);
  const selectedOccupancy = selectedLocation
    ? occupancyExcludingCurrent(selectedLocation)
    : undefined;
  const parsedPackages = Number(packageCount);
  const exceedsCapacity = Boolean(
    selectedLocation &&
      selectedOccupancy &&
      Number.isInteger(parsedPackages) &&
      parsedPackages >= 1 &&
      selectedOccupancy.packageCount + parsedPackages > selectedLocation.capacityPackages
  );

  const storeLater = mode === 'mark_ready' && readyChoice === 'store_later';
  const isDirty =
    readyChoice !== initialReadyChoice ||
    locationId !== initialLocationId ||
    packageCount !== initialPackageCount ||
    notes !== initialNotes;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!storeLater) {
      if (!locationId) {
        setError('Choisissez l’emplacement où les paquets sont réellement rangés.');
        return;
      }
      if (!Number.isInteger(parsedPackages) || parsedPackages < 1 || parsedPackages > 999) {
        setError('Indiquez un nombre de paquets entier compris entre 1 et 999.');
        return;
      }
    }

    setIsSubmitting(true);
    const input = storeLater
      ? { packageCount: 1 }
      : { locationId, packageCount: parsedPackages, notes: notes || undefined };
    const result =
      mode === 'mark_ready'
        ? markOrderReadyAndStore(currentOrder.id, input)
        : assignOrderStorage(currentOrder.id, input);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  const labelClass = 'block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1';
  const inputClass =
    'w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 disabled:opacity-50';
  const articlesSummary = currentOrder.lines
    .map((line) => `${line.quantity}× ${line.name}${line.color ? ` (${line.color})` : ''}`)
    .join(', ');

  return (
    <ModalShell
      title={mode === 'mark_ready' ? 'Marquer prête et ranger' : 'Ranger la commande'}
      subtitle={`${currentOrder.ticketNumber} • ${currentOrder.customerName}`}
      icon={<Archive className="w-5 h-5 text-teal-400" aria-hidden="true" />}
      onClose={onClose}
      isDirty={isDirty}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} noValidate className="p-5 space-y-3.5 text-[13px]">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-[12.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          <p>
            <strong className="text-zinc-950 dark:text-zinc-50">{currentOrder.customerName}</strong>
            {' • '}promis le {currentOrder.promisedAt}
          </p>
          <p>{articlesSummary}</p>
          <p>
            Restitution :{' '}
            <strong>
              {(currentOrder.fulfillmentMethod ?? 'counter_pickup') === 'home_delivery'
                ? 'livraison à domicile'
                : 'retrait au comptoir'}
            </strong>
          </p>
          {getOrderStorageLabel(currentOrder) && (
            <p>
              Emplacement actuel : <strong>{getOrderStorageLabel(currentOrder)}</strong>
              {!hasStructuredStorage(currentOrder) && ' (texte libre à convertir)'}
            </p>
          )}
        </div>

        {mode === 'mark_ready' && (
          <div>
            <span className={labelClass}>Après la finition</span>
            <SegmentedControl
              ariaLabel="Ranger maintenant ou plus tard"
              options={[
                { id: 'store_now', label: 'Ranger maintenant' },
                { id: 'store_later', label: 'Prête, non rangée' },
              ]}
              value={readyChoice}
              onChange={(choice) => {
                setReadyChoice(choice);
                setError(null);
              }}
            />
            {storeLater && (
              <p className="mt-2 flex items-start gap-1.5 text-[12px] text-amber-700 dark:text-amber-300">
                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                La commande apparaîtra dans la file « À ranger » jusqu’à ce qu’un casier soit choisi.
              </p>
            )}
          </div>
        )}

        {!storeLater && (
          <>
            <div className="rounded-lg border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/60 px-3 py-2.5 text-[12.5px] text-teal-900 dark:text-teal-200">
              <p className="font-bold">Suggestion : {STORAGE_ZONE_LABELS[suggestedZone]}</p>
              <p className="mt-0.5 leading-relaxed">{STORAGE_ZONE_DESCRIPTIONS[suggestedZone]}</p>
              <p className="mt-1 leading-relaxed">
                Choisissez ensuite le code exact reporté sur l’étiquette physique du portant ou de l’étagère.
                Regroupez tous les paquets du ticket au même endroit ; en cas d’exception, précisez le second repère ci-dessous.
              </p>
            </div>

            <div>
              <label htmlFor="storage-location-select" className={labelClass}>
                Emplacement physique *
              </label>
              <select
                id="storage-location-select"
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                  setError(null);
                }}
                disabled={selectableLocations.length === 0}
                className={inputClass}
                required
              >
                <option value="">Choisir un emplacement…</option>
                {selectableLocations.map((location) => {
                  const occupancy = occupancyExcludingCurrent(location);
                  return (
                    <option key={location.id} value={location.id}>
                      {formatStorageLocation(location)} — {STORAGE_ZONE_LABELS[location.zone]} •{' '}
                      {occupancy.packageCount}
                      {occupancy.unknownPackageOrders > 0 ? '+' : ''}/{location.capacityPackages} paquets
                      {location.isActive ? '' : ' • désactivé (emplacement actuel)'}
                    </option>
                  );
                })}
              </select>
              {selectedLocation?.description && (
                <p className="mt-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                  {selectedLocation.description}
                </p>
              )}
              {selectedLocation && !selectedLocation.isActive && (
                <p className="mt-1 text-[11.5px] font-medium text-amber-700 dark:text-amber-300">
                  Cet emplacement est désactivé : il reste proposé uniquement parce que cette commande s’y trouve déjà.
                </p>
              )}
              {selectableLocations.length === 0 && (
                <p className="mt-1 text-[12px] font-medium text-red-600 dark:text-red-400">
                  Aucun emplacement actif. Créez-en un depuis Atelier → Rangement → Emplacements.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
              <div>
                <label htmlFor="storage-package-count" className={labelClass}>
                  Paquets / housses *
                </label>
                <input
                  id="storage-package-count"
                  type="number"
                  min={1}
                  max={999}
                  step={1}
                  inputMode="numeric"
                  value={packageCount}
                  onChange={(e) => {
                    setPackageCount(e.target.value);
                    setError(null);
                  }}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label htmlFor="storage-notes" className={labelClass}>
                  Repère de rangement
                </label>
                <input
                  id="storage-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex. housses bleues, paquet principal à gauche…"
                  className={inputClass}
                />
              </div>
            </div>

            {exceedsCapacity && selectedLocation && selectedOccupancy && (
              <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {selectedLocation.code} dépasserait sa capacité indicative (
                  {selectedOccupancy.packageCount + parsedPackages}/{selectedLocation.capacityPackages} paquets).
                  Vous pouvez confirmer si la place réelle suffit, ou choisir un autre emplacement.
                </span>
              </p>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 px-3 py-2 text-[12.5px] font-medium text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3.5 py-2 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (!storeLater && selectableLocations.length === 0)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 px-3.5 py-2 text-[13px] font-bold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            {storeLater ? (
              <Clock3 className="h-4 w-4" aria-hidden="true" />
            ) : mode === 'mark_ready' ? (
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            {mode === 'mark_ready'
              ? storeLater
                ? 'Marquer prête'
                : 'Marquer prête et ranger'
              : hasStructuredStorage(currentOrder)
                ? locationId === currentOrder.storageLocationId
                  ? 'Mettre à jour le rangement'
                  : 'Enregistrer le déplacement'
                : 'Ranger la commande'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
