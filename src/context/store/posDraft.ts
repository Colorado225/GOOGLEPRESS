import { useEffect, useState } from 'react';
import type {
  Customer,
  FulfillmentMethod,
  LogisticsTask,
  LogisticsTimeSlot,
  PickupOption,
  ServiceCategory,
} from '../../types';
import { getPromisedDate, toISODate } from '../../lib/dates';
import { getDefaultDeliveryTimeSlot } from '../../lib/logistics';

export interface PosDraftDeps {
  /**
   * Clients lus au premier rendu pour les valeurs initiales (client
   * pré-sélectionné, adresse proposée). Identique au code d'origine, qui
   * lisait le même état au même moment.
   */
  customers: Customer[];
  /** Tournées courantes, pour résoudre le ramassage en attente. */
  logisticsTasks: LogisticsTask[];
}

export interface PosDraftStore {
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer) => void;
  pickupOption: PickupOption;
  setPickupOption: (opt: PickupOption) => void;
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
  orderStep: 1 | 2 | 3;
  setOrderStep: (step: 1 | 2 | 3) => void;
  /** Remise à zéro du brouillon logistique (réservé aux actions). */
  resetLogisticsDraft: (option?: PickupOption) => void;
  /** Écritures brutes du créneau, pour la conversion de ramassage. */
  setDeliveryScheduleManual: (manual: boolean) => void;
  setDeliveryDateISOState: (date: string) => void;
  setDeliveryTimeSlotState: (slot: LogisticsTimeSlot) => void;
}

/**
 * Brouillon de la commande en cours de saisie au POS : client actif, option
 * de retrait, mode de restitution, adresse et créneau de livraison, acompte,
 * notes, étape du parcours guidé et ramassage en attente de conversion.
 *
 * L'adresse proposée suit le client sélectionné ; le créneau suit la date
 * promise tant qu'il n'a pas été choisi manuellement.
 */
export const usePosDraft = ({ customers, logisticsTasks }: PosDraftDeps): PosDraftStore => {
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<ServiceCategory | null>('pressing');
  const [orderStep, setOrderStep] = useState<1 | 2 | 3>(1);

  // Aucun repli fictif : sur un espace réel sans client, la sélection est
  // vide et le POS invite à créer le premier dossier.
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    customers[0] ?? null
  );
  const [pickupOption, setPickupOption] = useState<PickupOption>('standard');

  // Brouillon logistique du POS : mode de restitution et, si livraison,
  // adresse/créneau saisis avant l'enregistrement de la commande.
  const [orderFulfillmentMethod, setOrderFulfillmentMethod] =
    useState<FulfillmentMethod>('counter_pickup');
  const [deliveryAddress, setDeliveryAddress] = useState<string>(
    customers[0]?.address || ''
  );
  const [deliveryAddressDetails, setDeliveryAddressDetails] = useState<string>('');
  const [deliveryDateISO, setDeliveryDateISOState] = useState<string>(() =>
    toISODate(getPromisedDate('standard'))
  );
  const [deliveryTimeSlot, setDeliveryTimeSlotState] =
    useState<LogisticsTimeSlot>('16:00-18:00');
  const [deliveryScheduleManual, setDeliveryScheduleManual] = useState(false);
  const [pendingPickupTaskId, setPendingPickupTaskId] = useState<string | null>(null);
  const [focusedLogisticsTaskId, setFocusedLogisticsTaskId] = useState<string | null>(null);

  const pendingPickupTask = pendingPickupTaskId
    ? logisticsTasks.find((task) => task.id === pendingPickupTaskId) ?? null
    : null;

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
    setDeliveryDateISOState(toISODate(getPromisedDate(option)));
    setDeliveryTimeSlotState(getDefaultDeliveryTimeSlot(option));
    setPendingPickupTaskId(null);
  };

  // L'adresse proposée suit le client sélectionné, sauf pendant la conversion
  // d'un ramassage où l'adresse de collecte fait foi par défaut.
  useEffect(() => {
    if (!pendingPickupTaskId) setDeliveryAddress(selectedCustomer?.address || '');
  }, [selectedCustomer?.id, pendingPickupTaskId]);

  // Tant que le créneau n'a pas été choisi manuellement, la livraison suit la
  // date promise par l'option standard/express/différé.
  useEffect(() => {
    if (deliveryScheduleManual) return;
    setDeliveryDateISOState(toISODate(getPromisedDate(pickupOption)));
    setDeliveryTimeSlotState(getDefaultDeliveryTimeSlot(pickupOption));
  }, [pickupOption, deliveryScheduleManual]);

  const [orderNotes, setOrderNotes] = useState<string>(
    'Consigne : tache de sauce graine sur boubou — détachage doux. Cliente prévient sur WhatsApp.'
  );
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('Lavage + Repassage');
  const [paymentMethod, setPaymentMethod] = useState<'especes' | 'wave' | 'momo' | 'om'>('wave');
  const [depositAmount, setDepositAmount] = useState<number>(5000);

  return {
    selectedCustomer,
    setSelectedCustomer,
    pickupOption,
    setPickupOption,
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
