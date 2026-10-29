import { useEffect, useState } from 'react';
import type {
  Customer,
  FulfillmentMethod,
  LogisticsTask,
  LogisticsTimeSlot,
  OrderLine,
  PickupOption,
  ServiceCategory,
} from '../../types';
import { getPromisedDate, resolvePromisedDate, toISODate } from '../../lib/dates';
import { resolveOrderPickupOption } from '../../lib/pricing';
import {
  getDefaultDeliveryTimeSlot,
  LOGISTICS_TIME_SLOTS,
} from '../../lib/logistics';
import { loadPersistedState, persistState } from '../../lib/localPersistence';
import { POS_DRAFT_STORAGE_KEY } from '../../lib/sessionPersistence';

export { POS_DRAFT_STORAGE_KEY } from '../../lib/sessionPersistence';

export interface PosDraftDeps {
  /**
   * Clients lus au premier rendu pour les valeurs initiales (client
   * pré-sélectionné, adresse proposée) et pour restaurer le client du
   * brouillon sans conserver une copie obsolète de sa fiche.
   */
  customers: Customer[];
  /** Tournées courantes, pour résoudre le ramassage en attente. */
  logisticsTasks: LogisticsTask[];
  /** Lignes dont dépend la priorité Express effective de la commande. */
  cartLines: OrderLine[];
  /** Clé isolée par organisation, comme pour les autres données métier. */
  storageKey: (name: string) => string;
  /** Un espace réel démarre sans consigne ni acompte de démonstration. */
  liveWorkspace: boolean;
}

export interface PosDraftStore {
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer) => void;
  pickupOption: PickupOption;
  setPickupOption: (opt: PickupOption) => void;
  promisedDateISO: string | null;
  setPromisedDateISO: (iso: string | null) => void;
  orderFulfillmentMethod: FulfillmentMethod;
  setOrderFulfillmentMethod: (method: FulfillmentMethod) => void;
  deliveryAddress: string;
  setDeliveryAddress: (address: string) => void;
  deliveryAddressDetails: string;
  setDeliveryAddressDetails: (details: string) => void;
  deliveryDateISO: string;
  setDeliveryDateISO: (date: string) => void;
  deliveryTimeSlot: LogisticsTimeSlot;
  setDeliveryTimeSlot: (slot: LogisticsTimeSlot) => void;
  pendingPickupTask: LogisticsTask | null;
  pendingPickupTaskId: string | null;
  /** Écriture réservée aux fabriques d'actions (conversion de ramassage). */
  setPendingPickupTaskId: (taskId: string | null) => void;
  focusedLogisticsTaskId: string | null;
  setFocusedLogisticsTaskId: (taskId: string | null) => void;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  depositAmount: number;
  setDepositAmount: (amt: number) => void;
  paymentMethod: 'especes' | 'wave' | 'momo' | 'om';
  setPaymentMethod: (pm: 'especes' | 'wave' | 'momo' | 'om') => void;
  selectedServiceFilter: string;
  setSelectedServiceFilter: (srv: string) => void;
  selectedServiceCategory: ServiceCategory | null;
  setSelectedServiceCategory: (cat: ServiceCategory | null) => void;
  orderStep: 1 | 2 | 3 | 4;
  setOrderStep: (step: 1 | 2 | 3 | 4) => void;
  /** Remise à zéro du brouillon logistique (réservé aux actions). */
  resetLogisticsDraft: (option?: PickupOption) => void;
  /** Écritures brutes du créneau, pour la conversion de ramassage. */
  setDeliveryScheduleManual: (manual: boolean) => void;
  setDeliveryDateISOState: (date: string) => void;
  setDeliveryTimeSlotState: (slot: LogisticsTimeSlot) => void;
}

/** Instantané sérialisable de la commande en cours, hors panier. */
interface PosDraftSnapshot {
  selectedCustomerId: string | null;
  selectedServiceCategory: ServiceCategory | null;
  orderStep: 1 | 2 | 3 | 4;
  pickupOption: PickupOption;
  promisedDateISO: string | null;
  orderFulfillmentMethod: FulfillmentMethod;
  deliveryAddress: string;
  deliveryAddressDetails: string;
  deliveryDateISO: string;
  deliveryTimeSlot: LogisticsTimeSlot;
  deliveryScheduleManual: boolean;
  pendingPickupTaskId: string | null;
  orderNotes: string;
  selectedServiceFilter: string;
  paymentMethod: 'especes' | 'wave' | 'momo' | 'om';
  depositAmount: number;
}

const createDefaultSnapshot = (
  customers: Customer[],
  liveWorkspace: boolean
): PosDraftSnapshot => ({
  selectedCustomerId: customers[0]?.id ?? null,
  selectedServiceCategory: 'pressing',
  orderStep: 1,
  pickupOption: 'standard',
  promisedDateISO: null,
  orderFulfillmentMethod: 'counter_pickup',
  deliveryAddress: customers[0]?.address || '',
  deliveryAddressDetails: '',
  deliveryDateISO: toISODate(getPromisedDate('standard')),
  deliveryTimeSlot: '16:00-18:00',
  deliveryScheduleManual: false,
  pendingPickupTaskId: null,
  orderNotes: liveWorkspace
    ? ''
    : 'Consigne : tache de sauce graine sur boubou — détachage doux. Cliente prévient sur WhatsApp.',
  selectedServiceFilter: 'Lavage + Repassage',
  paymentMethod: 'wave',
  depositAmount: liveWorkspace ? 0 : 5000,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const readNullableString = (
  value: unknown,
  fallback: string | null
): string | null => {
  if (value === null) return null;
  return typeof value === 'string' ? value : fallback;
};

const readEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T =>
  typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;

const readNullableEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T | null
): T | null => {
  if (value === null) return null;
  return typeof value === 'string' && allowed.includes(value as T)
    ? (value as T)
    : fallback;
};

/**
 * Restaure un instantané tout en ignorant les champs absents ou d'un type
 * invalide. Un localStorage partiellement corrompu ne doit ni faire échouer
 * le montage du POS ni réintroduire des valeurs impossibles.
 */
const loadSnapshot = (key: string, fallback: PosDraftSnapshot): PosDraftSnapshot => {
  const saved = loadPersistedState<unknown>(key, null);
  if (!isRecord(saved)) return fallback;

  return {
    selectedCustomerId: readNullableString(
      saved.selectedCustomerId,
      fallback.selectedCustomerId
    ),
    selectedServiceCategory: readNullableEnum(
      saved.selectedServiceCategory,
      ['pressing', 'blanchisserie'] as const,
      fallback.selectedServiceCategory
    ),
    orderStep:
      saved.orderStep === 1 ||
      saved.orderStep === 2 ||
      saved.orderStep === 3 ||
      saved.orderStep === 4
        ? saved.orderStep
        : fallback.orderStep,
    pickupOption: readEnum(
      saved.pickupOption,
      ['standard', 'express', 'delayed'] as const,
      fallback.pickupOption
    ),
    promisedDateISO: readNullableString(
      saved.promisedDateISO,
      fallback.promisedDateISO
    ),
    orderFulfillmentMethod: readEnum(
      saved.orderFulfillmentMethod,
      ['counter_pickup', 'home_delivery'] as const,
      fallback.orderFulfillmentMethod
    ),
    deliveryAddress: readString(saved.deliveryAddress, fallback.deliveryAddress),
    deliveryAddressDetails: readString(
      saved.deliveryAddressDetails,
      fallback.deliveryAddressDetails
    ),
    deliveryDateISO: readString(saved.deliveryDateISO, fallback.deliveryDateISO),
    deliveryTimeSlot: readEnum(
      saved.deliveryTimeSlot,
      LOGISTICS_TIME_SLOTS.map((slot) => slot.id),
      fallback.deliveryTimeSlot
    ),
    deliveryScheduleManual:
      typeof saved.deliveryScheduleManual === 'boolean'
        ? saved.deliveryScheduleManual
        : fallback.deliveryScheduleManual,
    pendingPickupTaskId: readNullableString(
      saved.pendingPickupTaskId,
      fallback.pendingPickupTaskId
    ),
    orderNotes: readString(saved.orderNotes, fallback.orderNotes),
    selectedServiceFilter: readString(
      saved.selectedServiceFilter,
      fallback.selectedServiceFilter
    ),
    paymentMethod: readEnum(
      saved.paymentMethod,
      ['especes', 'wave', 'momo', 'om'] as const,
      fallback.paymentMethod
    ),
    depositAmount:
      typeof saved.depositAmount === 'number' && Number.isFinite(saved.depositAmount)
        ? Math.max(0, saved.depositAmount)
        : fallback.depositAmount,
  };
};

/**
 * Brouillon de la commande en cours de saisie au POS : client actif, option
 * de retrait, mode de restitution, adresse et créneau de livraison, acompte,
 * notes, étape du parcours guidé et ramassage en attente de conversion.
 *
 * Chaque changement est sauvegardé automatiquement dans le navigateur. Un
 * rechargement, une mise à jour du bundle ou une fermeture accidentelle ne
 * réinitialise donc plus la réception en cours. Le panier est persisté par
 * `useCartStore` sous sa propre clé, dans la même portée d'organisation.
 */
export const usePosDraft = ({
  customers,
  logisticsTasks,
  cartLines,
  storageKey,
  liveWorkspace,
}: PosDraftDeps): PosDraftStore => {
  const draftStorageKey = storageKey(POS_DRAFT_STORAGE_KEY);
  const [initialDraft] = useState<PosDraftSnapshot>(() =>
    loadSnapshot(draftStorageKey, createDefaultSnapshot(customers, liveWorkspace))
  );

  const [selectedServiceCategory, setSelectedServiceCategory] =
    useState<ServiceCategory | null>(initialDraft.selectedServiceCategory);
  const [orderStep, setOrderStep] = useState<1 | 2 | 3 | 4>(initialDraft.orderStep);

  // Seul l'identifiant est persisté : la fiche restaurée reste celle du
  // fichier clients, avec ses éventuels soldes et compteurs actualisés.
  const [selectedCustomer, setSelectedCustomerState] = useState<Customer | null>(() =>
    initialDraft.selectedCustomerId
      ? customers.find((customer) => customer.id === initialDraft.selectedCustomerId) ?? null
      : null
  );
  const [pickupOption, setPickupOption] = useState<PickupOption>(initialDraft.pickupOption);
  const [promisedDateISO, setPromisedDateISO] = useState<string | null>(
    initialDraft.promisedDateISO
  );

  const [orderFulfillmentMethod, setOrderFulfillmentMethod] =
    useState<FulfillmentMethod>(initialDraft.orderFulfillmentMethod);
  const [deliveryAddress, setDeliveryAddress] = useState<string>(
    initialDraft.deliveryAddress
  );
  const [deliveryAddressDetails, setDeliveryAddressDetails] = useState<string>(
    initialDraft.deliveryAddressDetails
  );
  const [deliveryDateISO, setDeliveryDateISOState] = useState<string>(
    initialDraft.deliveryDateISO
  );
  const [deliveryTimeSlot, setDeliveryTimeSlotState] = useState<LogisticsTimeSlot>(
    initialDraft.deliveryTimeSlot
  );
  const [deliveryScheduleManual, setDeliveryScheduleManual] = useState(
    initialDraft.deliveryScheduleManual
  );
  const [pendingPickupTaskId, setPendingPickupTaskId] = useState<string | null>(
    initialDraft.pendingPickupTaskId
  );
  const [focusedLogisticsTaskId, setFocusedLogisticsTaskId] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState<string>(initialDraft.orderNotes);
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>(
    initialDraft.selectedServiceFilter
  );
  const [paymentMethod, setPaymentMethod] = useState<'especes' | 'wave' | 'momo' | 'om'>(
    initialDraft.paymentMethod
  );
  const [depositAmount, setDepositAmount] = useState<number>(initialDraft.depositAmount);

  const pendingPickupTask = pendingPickupTaskId
    ? logisticsTasks.find((task) => task.id === pendingPickupTaskId) ?? null
    : null;

  // L'adresse proposée suit une nouvelle sélection de client. Cette logique
  // vit dans le setter plutôt que dans un effet de montage : ainsi, l'adresse
  // personnalisée restaurée après un rechargement n'est pas écrasée.
  const setSelectedCustomer = (customer: Customer) => {
    setSelectedCustomerState(customer);
    if (!pendingPickupTaskId) setDeliveryAddress(customer.address || '');
  };

  const setDeliveryDateISO = (date: string) => {
    setDeliveryScheduleManual(true);
    setDeliveryDateISOState(date);
  };
  const setDeliveryTimeSlot = (slot: LogisticsTimeSlot) => {
    setDeliveryScheduleManual(true);
    setDeliveryTimeSlotState(slot);
  };

  const resetLogisticsDraft = (option: PickupOption = pickupOption) => {
    setOrderFulfillmentMethod('counter_pickup');
    setDeliveryAddress(selectedCustomer?.address || '');
    setDeliveryAddressDetails('');
    setDeliveryScheduleManual(false);
    // Nouveau départ : la date libre éventuelle est oubliée, le créneau
    // proposé repart de l'option seule.
    setDeliveryDateISOState(toISODate(resolvePromisedDate(option, null)));
    setDeliveryTimeSlotState(getDefaultDeliveryTimeSlot(option));
    setPendingPickupTaskId(null);
    setPromisedDateISO(null);
  };

  // Tant que le créneau n'a pas été choisi manuellement, la livraison suit la
  // priorité effective des lignes (dont Express) ou la date libre d'une commande Normal.
  useEffect(() => {
    if (deliveryScheduleManual) return;
    const effectivePickupOption = resolveOrderPickupOption(cartLines, pickupOption);
    setDeliveryDateISOState(toISODate(resolvePromisedDate(effectivePickupOption, promisedDateISO)));
    setDeliveryTimeSlotState(getDefaultDeliveryTimeSlot(effectivePickupOption));
  }, [cartLines, pickupOption, promisedDateISO, deliveryScheduleManual]);

  // Sauvegarde unique et atomique du brouillon : tous les champs restaurés
  // appartiennent au même instantané et à la même organisation.
  useEffect(() => {
    const snapshot: PosDraftSnapshot = {
      selectedCustomerId: selectedCustomer?.id ?? null,
      selectedServiceCategory,
      orderStep,
      pickupOption,
      promisedDateISO,
      orderFulfillmentMethod,
      deliveryAddress,
      deliveryAddressDetails,
      deliveryDateISO,
      deliveryTimeSlot,
      deliveryScheduleManual,
      pendingPickupTaskId,
      orderNotes,
      selectedServiceFilter,
      paymentMethod,
      depositAmount,
    };
    persistState(draftStorageKey, snapshot);
  }, [
    draftStorageKey,
    selectedCustomer?.id,
    selectedServiceCategory,
    orderStep,
    pickupOption,
    promisedDateISO,
    orderFulfillmentMethod,
    deliveryAddress,
    deliveryAddressDetails,
    deliveryDateISO,
    deliveryTimeSlot,
    deliveryScheduleManual,
    pendingPickupTaskId,
    orderNotes,
    selectedServiceFilter,
    paymentMethod,
    depositAmount,
  ]);

  return {
    selectedCustomer,
    setSelectedCustomer,
    pickupOption,
    setPickupOption,
    promisedDateISO,
    setPromisedDateISO,
    orderFulfillmentMethod,
    setOrderFulfillmentMethod,
    deliveryAddress,
    setDeliveryAddress,
    deliveryAddressDetails,
    setDeliveryAddressDetails,
    deliveryDateISO,
    setDeliveryDateISO,
    deliveryTimeSlot,
    setDeliveryTimeSlot,
    pendingPickupTask,
    pendingPickupTaskId,
    setPendingPickupTaskId,
    focusedLogisticsTaskId,
    setFocusedLogisticsTaskId,
    orderNotes,
    setOrderNotes,
    depositAmount,
    setDepositAmount,
    paymentMethod,
    setPaymentMethod,
    selectedServiceFilter,
    setSelectedServiceFilter,
    selectedServiceCategory,
    setSelectedServiceCategory,
    orderStep,
    setOrderStep,
    resetLogisticsDraft,
    setDeliveryScheduleManual,
    setDeliveryDateISOState,
    setDeliveryTimeSlotState,
  };
};
