import type { Dispatch, SetStateAction } from 'react';
import type {
  ActionResult,
  LaundryOrder,
  LogisticsTask,
  ShopSettings,
  StorageAssignmentInput,
  StorageLocation,
  StorageLocationFormData,
  StorageLocationSeriesInput,
} from '../../types';
import {
  buildStorageLocationSeries,
  calculateStorageOccupancy,
  formatStorageLocation,
  getOrderPackageCount,
  getOrderStorageCode,
  hasStorageLocation,
  isValidStorageCode,
  normalizeStorageCode,
  sanitizePackageCount,
  wouldExceedKnownStorageCapacity,
} from '../../lib/storage';
import { guardStorageLocationCount } from '../../lib/planAccess';
import type { SubscriptionPlanId } from '../../lib/subscription';
import { nowDateTime, nowISODateTime } from '../../lib/dates';
import { createLocalId as genId } from '../../lib/localPersistence';
import type { NotifyFn, StoragePanelView, WorkshopTab } from './types';

export interface StorageActionsDeps {
  storageLocations: StorageLocation[];
  setStorageLocations: Dispatch<SetStateAction<StorageLocation[]>>;
  orders: LaundryOrder[];
  setOrders: Dispatch<SetStateAction<LaundryOrder[]>>;
  logisticsTasks: LogisticsTask[];
  shopSettings: ShopSettings;
  effectivePlanId: SubscriptionPlanId;
  setFocusedStorageOrderId: (orderId: string | null) => void;
  setStoragePanelViewRequest: Dispatch<SetStateAction<StoragePanelView | null>>;
  requestWorkshopTab: (tab: WorkshopTab) => void;
  notify: NotifyFn;
}

export interface StorageActions {
  createStorageLocation: (
    data: StorageLocationFormData
  ) => ActionResult & { location?: StorageLocation };
  createStorageLocationSeries: (
    input: StorageLocationSeriesInput
  ) => ActionResult & { locations?: StorageLocation[] };
  updateStorageLocation: (id: string, data: StorageLocationFormData) => ActionResult;
  deleteStorageLocation: (id: string) => ActionResult;
  setStorageLocationActive: (id: string, isActive: boolean) => void;
  markOrderReadyAndStore: (orderId: string, input: StorageAssignmentInput) => ActionResult;
  assignOrderStorage: (orderId: string, input: StorageAssignmentInput) => ActionResult;
  clearOrderStorage: (orderId: string) => ActionResult;
  focusStorageOrder: (orderId: string) => void;
  clearStoragePanelViewRequest: () => void;
  openStorageLocationsConfig: () => void;
}

/**
 * Rangement atelier : plan des emplacements (création unitaire ou en série,
 * plafonnée par la formule), affectation des commandes prêtes avec contrôle
 * de capacité, et navigation vers le panneau Rangement.
 */
export const createStorageActions = (deps: StorageActionsDeps): StorageActions => {
  const {
    storageLocations,
    setStorageLocations,
    orders,
    setOrders,
    logisticsTasks,
    shopSettings,
    effectivePlanId,
    setFocusedStorageOrderId,
    setStoragePanelViewRequest,
    requestWorkshopTab,
    notify,
  } = deps;

  const validateStorageLocationData = (
    data: StorageLocationFormData,
    excludeId?: string
  ): { normalized?: StorageLocationFormData; error?: string } => {
    const code = normalizeStorageCode(data.code);
    const label = data.label.trim();
    const capacityPackages = Number(data.capacityPackages);
    if (!isValidStorageCode(code)) {
      return {
        error: 'Le code doit contenir 2 à 16 lettres/chiffres, séparés si besoin par des tirets (ex. A-01).',
      };
    }
    if (!label) return { error: 'Le libellé de l’emplacement est obligatoire.' };
    if (!Number.isInteger(capacityPackages) || capacityPackages < 1 || capacityPackages > 999) {
      return { error: 'La capacité doit être comprise entre 1 et 999 paquets.' };
    }
    if (
      storageLocations.some(
        (location) =>
          location.id !== excludeId && normalizeStorageCode(location.code) === code
      )
    ) {
      return { error: `Un emplacement portant déjà le code ${code} existe.` };
    }
    return {
      normalized: {
        code,
        label,
        zone: data.zone,
        capacityPackages,
        description: data.description?.trim() || undefined,
        isActive: data.isActive,
      },
    };
  };

  const createStorageLocation = (
    data: StorageLocationFormData
  ): ActionResult & { location?: StorageLocation } => {
    const guard = guardStorageLocationCount(storageLocations.length, 1, effectivePlanId);
    if (!guard.allowed) return { ok: false, error: guard.message };
    const { normalized, error } = validateStorageLocationData(data);
    if (!normalized || error) return { ok: false, error: error ?? 'Emplacement invalide.' };
    const now = nowISODateTime();
    const location: StorageLocation = {
      ...normalized,
      id: genId('storage'),
      createdAt: now,
      updatedAt: now,
    };
    setStorageLocations((prev) => [...prev, location]);
    notify(`✓ Emplacement ajouté : ${formatStorageLocation(location)}`);
    return { ok: true, location };
  };

  const createStorageLocationSeries = (
    input: StorageLocationSeriesInput
  ): ActionResult & { locations?: StorageLocation[] } => {
    const { locations: drafts, error } = buildStorageLocationSeries(input, storageLocations);
    if (error || drafts.length === 0) {
      return { ok: false, error: error ?? 'Aucun emplacement à créer.' };
    }

    const guard = guardStorageLocationCount(storageLocations.length, drafts.length, effectivePlanId);
    if (!guard.allowed) return { ok: false, error: guard.message };

    const now = nowISODateTime();
    const locations: StorageLocation[] = drafts.map((draft, index) => ({
      ...draft,
      id: `${genId('storage')}-${index}`,
      createdAt: now,
      updatedAt: now,
    }));
    setStorageLocations((prev) => [...prev, ...locations]);
    notify(
      `✓ Série créée : ${locations.length} emplacement(s), de ${locations[0].code} à ${locations[locations.length - 1].code}.`
    );
    return { ok: true, locations };
  };

  const updateStorageLocation = (id: string, data: StorageLocationFormData): ActionResult => {
    const current = storageLocations.find((location) => location.id === id);
    if (!current) return { ok: false, error: 'Emplacement introuvable.' };
    const { normalized, error } = validateStorageLocationData(data, id);
    if (!normalized || error) return { ok: false, error: error ?? 'Emplacement invalide.' };

    const updated: StorageLocation = {
      ...current,
      ...normalized,
      updatedAt: nowISODateTime(),
    };
    setStorageLocations((prev) => prev.map((location) => (location.id === id ? updated : location)));
    // Les écrans de remise lisent un instantané code/libellé : il est
    // resynchronisé pour les commandes encore physiquement rangées. Les
    // commandes déjà remises conservent leur historique tel qu'imprimé.
    setOrders((prev) =>
      prev.map((order) =>
        order.storageLocationId === id && order.status === 'ready'
          ? {
              ...order,
              storageLocationCode: updated.code,
              storageLocationLabel: updated.label,
              rackLocation: formatStorageLocation(updated),
            }
          : order
      )
    );
    notify(`✓ Emplacement mis à jour : ${formatStorageLocation(updated)}`);
    return { ok: true };
  };

  const deleteStorageLocation = (id: string): ActionResult => {
    const location = storageLocations.find((item) => item.id === id);
    if (!location) return { ok: false, error: 'Emplacement introuvable.' };
    const isReferenced = orders.some((order) => {
      if (order.storageLocationId === id) return true;
      const referencedCode = normalizeStorageCode(getOrderStorageCode(order) ?? '');
      return referencedCode !== '' && referencedCode === location.code;
    });
    if (isReferenced) {
      return {
        ok: false,
        error:
          'Cet emplacement est déjà cité par au moins une commande : désactivez-le pour conserver l’historique.',
      };
    }
    setStorageLocations((prev) => prev.filter((item) => item.id !== id));
    notify(`✓ Emplacement supprimé : ${formatStorageLocation(location)}`);
    return { ok: true };
  };

  const setStorageLocationActive = (id: string, isActive: boolean) => {
    const location = storageLocations.find((item) => item.id === id);
    if (!location) return;
    setStorageLocations((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isActive, updatedAt: nowISODateTime() } : item
      )
    );
    const currentOrders = orders.filter(
      (order) => order.storageLocationId === id && order.status === 'ready'
    ).length;
    notify(
      isActive
        ? `✓ Emplacement réactivé : ${formatStorageLocation(location)}`
        : `Emplacement désactivé pour les nouveaux rangements${currentOrders ? ` — ${currentOrders} commande(s) déjà placée(s) restent visibles.` : '.'}`
    );
  };

  const isOrderOutForDelivery = (orderId: string): boolean =>
    logisticsTasks.some(
      (task) => task.kind === 'delivery' && task.orderId === orderId && task.status === 'en_route'
    );

  const resolveStorageAssignment = (
    input: StorageAssignmentInput,
    required: boolean,
    existingLocationId?: string,
    orderId?: string
  ): {
    location?: StorageLocation;
    packageCount?: number;
    notes?: string;
    error?: string;
  } => {
    if (!input.locationId) {
      return required ? { error: 'Choisissez l’emplacement où les paquets sont rangés.' } : {};
    }
    const location = storageLocations.find((item) => item.id === input.locationId);
    if (!location) return { error: 'L’emplacement sélectionné est introuvable.' };
    // Un emplacement désactivé reste modifiable pour une commande qui s'y
    // trouve déjà (correction du nombre de paquets), mais ne reçoit plus de
    // nouvelle commande.
    if (!location.isActive && location.id !== existingLocationId) {
      return { error: 'Cet emplacement est désactivé : choisissez-en un autre.' };
    }
    const packageCount = sanitizePackageCount(input.packageCount);
    if (!packageCount) {
      return { error: 'Indiquez un nombre de paquets entier compris entre 1 et 999.' };
    }

    if (!shopSettings.storageAllowCapacityOverflow) {
      const occupancy = calculateStorageOccupancy(orders, logisticsTasks).get(location.id) ?? {
        orderCount: 0,
        packageCount: 0,
        unknownPackageOrders: 0,
      };
      const adjustedOccupancy = { ...occupancy };
      const currentOrder = orderId ? orders.find((item) => item.id === orderId) : undefined;
      if (
        currentOrder &&
        currentOrder.storageLocationId === location.id &&
        currentOrder.status === 'ready' &&
        !isOrderOutForDelivery(currentOrder.id)
      ) {
        const currentPackages = getOrderPackageCount(currentOrder);
        if (currentPackages) {
          adjustedOccupancy.packageCount = Math.max(
            0,
            adjustedOccupancy.packageCount - currentPackages
          );
        } else {
          adjustedOccupancy.unknownPackageOrders = Math.max(
            0,
            adjustedOccupancy.unknownPackageOrders - 1
          );
        }
      }
      if (wouldExceedKnownStorageCapacity(location, adjustedOccupancy, packageCount)) {
        return {
          error: `${location.code} est plein (${adjustedOccupancy.packageCount}/${location.capacityPackages} paquets connus) : choisissez un autre emplacement ou augmentez sa capacité.`,
        };
      }
    }

    return {
      location,
      packageCount,
      notes: input.notes?.trim() || undefined,
    };
  };

  const clearStorageFields = () => ({
    rackLocation: undefined,
    storageLocationId: undefined,
    storageLocationCode: undefined,
    storageLocationLabel: undefined,
    storagePackageCount: undefined,
    storageNotes: undefined,
    storedAt: undefined,
  });

  const markOrderReadyAndStore = (
    orderId: string,
    input: StorageAssignmentInput
  ): ActionResult => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, error: 'Commande introuvable.' };
    if (order.status === 'delivered') {
      return { ok: false, error: 'Cette commande est déjà remise.' };
    }
    if (order.status === 'ready') {
      return {
        ok: false,
        error: 'Cette commande est déjà prête : utilisez Ranger/Déplacer pour changer son emplacement.',
      };
    }
    if (isOrderOutForDelivery(orderId)) {
      return { ok: false, error: 'Cette commande est déjà en cours de livraison.' };
    }
    const { location, packageCount, notes, error } = resolveStorageAssignment(
      input,
      shopSettings.storageAssignmentRequired,
      undefined,
      orderId
    );
    if (error) return { ok: false, error };

    const now = nowDateTime();
    setOrders((prev) =>
      prev.map((item) =>
        item.id === orderId
          ? {
              ...item,
              status: 'ready',
              readyAt: now,
              smsSent: false,
              ...(location
                ? {
                    rackLocation: formatStorageLocation(location),
                    storageLocationId: location.id,
                    storageLocationCode: location.code,
                    storageLocationLabel: location.label,
                    storagePackageCount: packageCount,
                    storageNotes: notes,
                    storedAt: now,
                  }
                : clearStorageFields()),
            }
          : item
      )
    );
    notify(
      location
        ? `✓ ${order.ticketNumber} prête et rangée en ${location.code}.`
        : `✓ ${order.ticketNumber} prête — à ranger depuis l’onglet Rangement.`
    );
    return { ok: true };
  };

  const assignOrderStorage = (orderId: string, input: StorageAssignmentInput): ActionResult => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, error: 'Commande introuvable.' };
    if (order.status !== 'ready') {
      return { ok: false, error: 'Seules les commandes prêtes se rangent dans la zone d’attente des retraits.' };
    }
    if (isOrderOutForDelivery(orderId)) {
      return { ok: false, error: 'Cette commande est avec le livreur : elle ne peut pas être rangée en atelier.' };
    }
    const { location, packageCount, notes, error } = resolveStorageAssignment(
      input,
      true,
      order.storageLocationId,
      orderId
    );
    if (error || !location) return { ok: false, error: error ?? 'Emplacement invalide.' };

    const now = nowDateTime();
    const isSameLocation = order.storageLocationId === location.id;
    setOrders((prev) =>
      prev.map((item) =>
        item.id === orderId
          ? {
              ...item,
              rackLocation: formatStorageLocation(location),
              storageLocationId: location.id,
              storageLocationCode: location.code,
              storageLocationLabel: location.label,
              storagePackageCount: packageCount,
              storageNotes: notes,
              // Une correction sur place (paquets/repère) ne doit pas faire
              // repartir à zéro l'ancienneté du rangement.
              storedAt: isSameLocation ? item.storedAt ?? now : now,
            }
          : item
      )
    );
    notify(
      isSameLocation
        ? `✓ Rangement de ${order.ticketNumber} mis à jour en ${location.code}.`
        : `✓ ${order.ticketNumber} rangée en ${location.code}.`
    );
    return { ok: true };
  };

  const clearOrderStorage = (orderId: string): ActionResult => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, error: 'Commande introuvable.' };
    if (order.status !== 'ready') {
      return { ok: false, error: 'Cette commande n’est pas dans la zone des commandes prêtes.' };
    }
    if (isOrderOutForDelivery(orderId)) {
      return { ok: false, error: 'Cette commande est déjà en cours de livraison.' };
    }
    if (!hasStorageLocation(order)) {
      return { ok: false, error: 'Cette commande n’a déjà aucun emplacement renseigné.' };
    }
    setOrders((prev) =>
      prev.map((item) => (item.id === orderId ? { ...item, ...clearStorageFields() } : item))
    );
    notify(`${order.ticketNumber} marquée non rangée — choisissez son nouvel emplacement.`);
    return { ok: true };
  };

  const focusStorageOrder = (orderId: string) => {
    setFocusedStorageOrderId(orderId);
    requestWorkshopTab('storage');
  };

  const clearStoragePanelViewRequest = () => setStoragePanelViewRequest(null);
  const openStorageLocationsConfig = () => {
    setStoragePanelViewRequest('locations');
    requestWorkshopTab('storage');
  };

  return {
    createStorageLocation,
    createStorageLocationSeries,
    updateStorageLocation,
    deleteStorageLocation,
    setStorageLocationActive,
    markOrderReadyAndStore,
    assignOrderStorage,
    clearOrderStorage,
    focusStorageOrder,
    clearStoragePanelViewRequest,
    openStorageLocationsConfig,
  };
};
