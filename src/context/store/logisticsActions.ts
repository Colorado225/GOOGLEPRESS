import type { Dispatch, SetStateAction } from 'react';
import type {
  ActionResult,
  CashRegisterData,
  Customer,
  Employee,
  FulfillmentMethod,
  GeoPoint,
  LaundryOrder,
  LogisticsIssueReason,
  LogisticsTask,
  LogisticsTaskScheduleFormData,
  LogisticsTimeSlot,
  OrderLine,
  PaymentMethod,
  PickupOption,
  PickupTaskFormData,
  ServiceCategory,
  ShopSettings,
} from '../../types';
import {
  isValidISODate,
  nowDateTime,
  nowISODateTime,
  resolvePromisedDate,
  toISODate,
  todayISO,
} from '../../lib/dates';
import {
  PAYMENT_METHOD_LABELS,
  getDefaultDeliveryTimeSlot,
  normalizeLogisticsFee,
} from '../../lib/logistics';
import {
  buildDeliveryProof,
  normalizeDeliveryProofSettings,
  validateDeliveryProofDraft,
  type DeliveryProofDraft,
} from '../../lib/deliveryProof';
import { normalizeGeoPoint } from '../../lib/geo';
import type { CourierPositions } from '../../lib/courierPositions';
import { createLocalId as genId } from '../../lib/localPersistence';
import type { NotifyFn, ScreenId } from './types';

export interface LogisticsActionsDeps {
  logisticsTasks: LogisticsTask[];
  setLogisticsTasks: Dispatch<SetStateAction<LogisticsTask[]>>;
  orders: LaundryOrder[];
  setOrders: Dispatch<SetStateAction<LaundryOrder[]>>;
  customers: Customer[];
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  employees: Employee[];
  setCourierPositions: Dispatch<SetStateAction<CourierPositions>>;
  setCashRegister: Dispatch<SetStateAction<CashRegisterData>>;
  shopSettings: ShopSettings;
  activeHandoverOrder: LaundryOrder | null;
  setActiveHandoverOrder: (order: LaundryOrder | null) => void;
  // Brouillon POS, pour la conversion ramassage → commande.
  selectedCustomer: Customer | null;
  pickupOption: PickupOption;
  promisedDateISO: string | null;
  pendingPickupTaskId: string | null;
  setCartLines: Dispatch<SetStateAction<OrderLine[]>>;
  setDepositAmount: (amt: number) => void;
  setSelectedCustomer: (customer: Customer) => void;
  setOrderNotes: (notes: string) => void;
  setOrderFulfillmentMethod: (method: FulfillmentMethod) => void;
  setDeliveryAddress: (address: string) => void;
  setDeliveryAddressDetails: (details: string) => void;
  setDeliveryScheduleManual: (manual: boolean) => void;
  setDeliveryDateISOState: (date: string) => void;
  setDeliveryTimeSlotState: (slot: LogisticsTimeSlot) => void;
  setPendingPickupTaskId: (taskId: string | null) => void;
  setSelectedServiceCategory: (cat: ServiceCategory | null) => void;
  setOrderStep: (step: 1 | 2 | 3) => void;
  setActiveScreen: (screen: ScreenId) => void;
  setFocusedLogisticsTaskId: (taskId: string | null) => void;
  notify: NotifyFn;
}

export interface LogisticsActions {
  createPickupTask: (data: PickupTaskFormData) => ActionResult & { task?: LogisticsTask };
  updateLogisticsTask: (taskId: string, data: LogisticsTaskScheduleFormData) => ActionResult;
  assignLogisticsTask: (taskId: string, employeeId: string) => ActionResult;
  startLogisticsTask: (taskId: string) => ActionResult;
  completePickupTask: (taskId: string, collectedBags?: number) => ActionResult;
  completeDeliveryTask: (
    taskId: string,
    paymentMethod: PaymentMethod,
    proof?: DeliveryProofDraft | null
  ) => ActionResult;
  markLogisticsTaskArrived: (taskId: string) => ActionResult;
  setLogisticsTaskDestination: (taskId: string, point: GeoPoint | null) => ActionResult;
  recordCourierPosition: (taskId: string, point: GeoPoint) => ActionResult;
  failLogisticsTask: (taskId: string, reason: LogisticsIssueReason, notes?: string) => ActionResult;
  cancelLogisticsTask: (taskId: string, reason: LogisticsIssueReason, notes?: string) => ActionResult;
  startOrderFromPickupTask: (taskId: string) => boolean;
  cancelPendingPickupConversion: () => void;
  focusLogisticsTask: (taskId: string) => void;
}

/**
 * Ramassage & livraison : programmation, assignation, départ, collecte,
 * livraison avec preuve de remise et encaissement du solde, échecs,
 * reprogrammations, point GPS et positions coursier, conversion d'un
 * ramassage collecté en commande POS.
 */
export const createLogisticsActions = (deps: LogisticsActionsDeps): LogisticsActions => {
  const {
    logisticsTasks,
    setLogisticsTasks,
    orders,
    setOrders,
    customers,
    setCustomers,
    employees,
    setCourierPositions,
    setCashRegister,
    shopSettings,
    activeHandoverOrder,
    setActiveHandoverOrder,
    selectedCustomer,
    pickupOption,
    promisedDateISO,
    pendingPickupTaskId,
    setCartLines,
    setDepositAmount,
    setSelectedCustomer,
    setOrderNotes,
    setOrderFulfillmentMethod,
    setDeliveryAddress,
    setDeliveryAddressDetails,
    setDeliveryScheduleManual,
    setDeliveryDateISOState,
    setDeliveryTimeSlotState,
    setPendingPickupTaskId,
    setSelectedServiceCategory,
    setOrderStep,
    setActiveScreen,
    setFocusedLogisticsTaskId,
    notify,
  } = deps;

  const sanitizeBags = (value?: number): number | undefined => {
    if (value === undefined || !Number.isFinite(value)) return undefined;
    return Math.min(99, Math.max(1, Math.round(value)));
  };

  const resolveLogisticsEmployee = (
    employeeId?: string
  ): { employee?: Employee; error?: string } => {
    if (!employeeId) return {};
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return { error: 'Le coursier sélectionné est introuvable.' };
    if (employee.status !== 'active') {
      return { error: `${employee.fullName} n’est pas actif et ne peut pas recevoir cette tournée.` };
    }
    return { employee };
  };

  const patchLogisticsTask = (taskId: string, patch: Partial<LogisticsTask>) => {
    setLogisticsTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...patch, updatedAt: nowISODateTime() } : task
      )
    );
  };

  const createPickupTask = (
    data: PickupTaskFormData
  ): ActionResult & { task?: LogisticsTask } => {
    const address = data.address.trim();
    if (!address) return { ok: false, error: 'L’adresse de ramassage est obligatoire.' };
    if (!isValidISODate(data.scheduledDate) || data.scheduledDate < todayISO()) {
      return { ok: false, error: 'Choisissez une date de ramassage valide, aujourd’hui ou plus tard.' };
    }

    const { employee, error: employeeError } = resolveLogisticsEmployee(data.assignedEmployeeId);
    if (employeeError) return { ok: false, error: employeeError };

    let customer: Customer | undefined;
    if (data.customerMode === 'existing') {
      customer = customers.find((c) => c.id === data.customerId);
      if (!customer) return { ok: false, error: 'Sélectionnez un client existant.' };
    } else {
      const name = (data.newCustomerName ?? '').trim();
      const phone = (data.newCustomerPhone ?? '').trim();
      if (!name) return { ok: false, error: 'Le nom du nouveau client est obligatoire.' };
      if (!phone) return { ok: false, error: 'Le téléphone du nouveau client est obligatoire.' };
      const phoneDigits = phone.replace(/\D/g, '');
      const duplicate = customers.find((c) => c.phone.replace(/\D/g, '') === phoneDigits);
      if (duplicate) {
        return {
          ok: false,
          error: `Ce numéro appartient déjà à ${duplicate.name}. Sélectionnez ce client existant.`,
        };
      }
      customer = {
        id: genId('cust'),
        name,
        phone,
        address,
        depositsCount: 0,
        balance: 0,
        loyaltyDiscountPercent: 0,
      };
      setCustomers((prev) => [customer as Customer, ...prev]);
    }

    const now = nowISODateTime();
    const task: LogisticsTask = {
      id: genId('log'),
      kind: 'pickup',
      status: 'scheduled',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      address,
      addressDetails: data.addressDetails?.trim() || undefined,
      scheduledDate: data.scheduledDate,
      timeSlot: data.timeSlot,
      assignedEmployeeId: employee?.id,
      assignedEmployeeName: employee?.fullName,
      fee: normalizeLogisticsFee(shopSettings.pickupFee),
      estimatedBags: sanitizeBags(data.estimatedBags),
      instructions: data.instructions?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    setLogisticsTasks((prev) => [task, ...prev]);
    notify(`✓ Ramassage programmé pour ${customer.name}.`);
    return { ok: true, task };
  };

  const updateLogisticsTask = (
    taskId: string,
    data: LogisticsTaskScheduleFormData
  ): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (task.status === 'completed' || task.status === 'en_route') {
      return { ok: false, error: 'Une tournée en route ou terminée ne peut plus être modifiée.' };
    }

    const address = data.address.trim();
    if (!address) return { ok: false, error: 'L’adresse est obligatoire.' };
    if (!isValidISODate(data.scheduledDate) || data.scheduledDate < todayISO()) {
      return { ok: false, error: 'Choisissez une date valide, aujourd’hui ou plus tard.' };
    }

    const { employee, error: employeeError } = resolveLogisticsEmployee(data.assignedEmployeeId);
    if (employeeError) return { ok: false, error: employeeError };

    const linkedOrder = task.orderId ? orders.find((o) => o.id === task.orderId) : undefined;
    if (task.kind === 'delivery' && linkedOrder?.status === 'delivered') {
      return { ok: false, error: 'Cette commande est déjà livrée.' };
    }

    patchLogisticsTask(taskId, {
      address,
      addressDetails: data.addressDetails?.trim() || undefined,
      scheduledDate: data.scheduledDate,
      timeSlot: data.timeSlot,
      assignedEmployeeId: employee?.id,
      assignedEmployeeName: employee?.fullName,
      estimatedBags: task.kind === 'pickup' ? sanitizeBags(data.estimatedBags) : task.estimatedBags,
      instructions: data.instructions?.trim() || undefined,
      status: 'scheduled',
      issueReason: undefined,
      issueNotes: undefined,
      startedAt: undefined,
      arrivedAt: undefined,
      completedAt: undefined,
    });

    // Le ticket doit refléter la dernière adresse/créneau promis au client.
    if (task.kind === 'delivery' && task.orderId) {
      setOrders((prev) =>
        prev.map((order) =>
          order.id === task.orderId
            ? {
                ...order,
                deliveryAddress: address,
                deliveryAddressDetails: data.addressDetails?.trim() || undefined,
                deliveryDate: data.scheduledDate,
                deliveryTimeSlot: data.timeSlot,
              }
            : order
        )
      );
    }

    notify(task.status === 'scheduled' ? '✓ Tournée mise à jour.' : '✓ Tournée reprogrammée.');
    return { ok: true };
  };

  const assignLogisticsTask = (taskId: string, employeeId: string): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (task.status === 'completed' || task.status === 'cancelled') {
      return { ok: false, error: 'Cette tournée ne peut plus être assignée.' };
    }
    const { employee, error } = resolveLogisticsEmployee(employeeId || undefined);
    if (error) return { ok: false, error };
    patchLogisticsTask(taskId, {
      assignedEmployeeId: employee?.id,
      assignedEmployeeName: employee?.fullName,
    });
    notify(employee ? `✓ Tournée assignée à ${employee.fullName}.` : 'Coursier retiré de la tournée.');
    return { ok: true };
  };

  const startLogisticsTask = (taskId: string): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (task.status !== 'scheduled') {
      return { ok: false, error: 'Seule une tournée programmée peut démarrer.' };
    }
    if (!task.assignedEmployeeId) {
      return { ok: false, error: 'Assignez un coursier avant le départ.' };
    }
    const employee = employees.find((e) => e.id === task.assignedEmployeeId);
    if (!employee || employee.status !== 'active') {
      return { ok: false, error: 'Le coursier assigné n’est plus actif. Choisissez-en un autre.' };
    }
    if (task.kind === 'delivery') {
      const order = orders.find((o) => o.id === task.orderId);
      if (!order) return { ok: false, error: 'La commande liée à cette livraison est introuvable.' };
      if (order.status !== 'ready') {
        return { ok: false, error: 'Cette livraison ne peut partir que lorsque la commande est prête.' };
      }
    }

    patchLogisticsTask(taskId, {
      status: 'en_route',
      assignedEmployeeName: employee.fullName,
      startedAt: nowISODateTime(),
      arrivedAt: undefined,
      issueReason: undefined,
      issueNotes: undefined,
    });
    notify(`🚚 ${employee.fullName} est en route pour ${task.customerName}.`);
    return { ok: true };
  };

  const completePickupTask = (taskId: string, collectedBags?: number): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task || task.kind !== 'pickup') return { ok: false, error: 'Ce ramassage est introuvable.' };
    if (task.status !== 'en_route') {
      return { ok: false, error: 'Démarrez d’abord la tournée avant de confirmer la collecte.' };
    }
    patchLogisticsTask(taskId, {
      status: 'completed',
      collectedBags: sanitizeBags(collectedBags),
      completedAt: nowISODateTime(),
    });
    notify('✓ Linge collecté. Créez la commande après le comptage à la boutique.');
    return { ok: true };
  };

  /**
   * Jalon « arrivé sur place » : le coursier est chez le client mais la remise
   * n'est pas encore constatée. Il ne change pas le statut de la tournée — la
   * livraison reste « en route » jusqu'à la confirmation, avec une preuve.
   */
  const markLogisticsTaskArrived = (taskId: string): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (task.status !== 'en_route') {
      return { ok: false, error: 'Démarrez d’abord la tournée avant de signaler l’arrivée.' };
    }
    if (task.arrivedAt) {
      return { ok: false, error: 'L’arrivée est déjà enregistrée pour cette tournée.' };
    }
    patchLogisticsTask(taskId, { arrivedAt: nowISODateTime() });
    notify(`📍 Arrivée enregistrée chez ${task.customerName}.`);
    return { ok: true };
  };

  /** Point de livraison placé sur la carte, ou retiré (retour au texte seul). */
  const setLogisticsTaskDestination = (taskId: string, point: GeoPoint | null): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (point) {
      const normalized = normalizeGeoPoint(point);
      if (!normalized) {
        return { ok: false, error: 'Ce point est inutilisable : choisissez-en un autre sur la carte.' };
      }
      patchLogisticsTask(taskId, { destination: normalized });
      notify('✓ Point de livraison enregistré.');
      return { ok: true };
    }
    patchLogisticsTask(taskId, { destination: undefined });
    notify('Point de livraison retiré : l’itinéraire repartira de l’adresse.');
    return { ok: true };
  };

  /**
   * Enregistre une position envoyée par le téléphone du coursier. Refusée hors
   * tournée en route : une position ne doit pas être collectée pour une course
   * qui n'a pas commencé.
   */
  const recordCourierPosition = (taskId: string, point: GeoPoint): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (task.status !== 'en_route') {
      return { ok: false, error: 'La position ne peut être partagée que pendant une tournée en route.' };
    }
    const normalized = normalizeGeoPoint(point);
    if (!normalized) return { ok: false, error: 'Position inutilisable : mesure ignorée.' };
    setCourierPositions((prev) => ({ ...prev, [taskId]: { ...normalized, taskId } }));
    return { ok: true };
  };

  const completeDeliveryTask = (
    taskId: string,
    paymentMethodForBalance: PaymentMethod,
    proofDraft?: DeliveryProofDraft | null
  ): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task || task.kind !== 'delivery') return { ok: false, error: 'Cette livraison est introuvable.' };
    if (task.status !== 'en_route') {
      return { ok: false, error: 'Démarrez d’abord la tournée avant de confirmer la livraison.' };
    }
    const order = orders.find((o) => o.id === task.orderId);
    if (!order) return { ok: false, error: 'La commande liée à cette livraison est introuvable.' };
    if (order.status !== 'ready') {
      return { ok: false, error: 'La commande doit être prête et non encore remise pour être livrée.' };
    }

    // La preuve est contrôlée AVANT de toucher à la commande : une livraison
    // refusée pour preuve manquante ne doit ni solder le ticket ni créditer la
    // caisse. Le code n'est exigé que si la tournée en possède un.
    const proofErrors = validateDeliveryProofDraft(proofDraft, {
      settings: normalizeDeliveryProofSettings(shopSettings.deliveryProof),
      expectedCode: task.deliveryCode,
    });
    if (proofErrors.length > 0) {
      return { ok: false, error: proofErrors[0] };
    }

    const proof = buildDeliveryProof(proofDraft, {
      capturedAt: nowISODateTime(),
      capturedByEmployeeId: task.assignedEmployeeId,
      capturedByEmployeeName: task.assignedEmployeeName,
    });

    const balance = Math.max(0, order.remainingBalance);
    const deliveredAt = nowDateTime();

    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === order.id
          ? {
              ...ord,
              depositPaid: ord.total,
              remainingBalance: 0,
              status: 'delivered',
              deliveredAt,
              paymentMethod:
                balance > 0 && ord.depositPaid === 0 ? paymentMethodForBalance : ord.paymentMethod,
            }
          : ord
      )
    );

    patchLogisticsTask(taskId, {
      status: 'completed',
      completedAt: nowISODateTime(),
      // Livrer implique être arrivé : on comble le jalon s'il n'a pas été posé.
      arrivedAt: task.arrivedAt ?? nowISODateTime(),
      proof: proof ?? undefined,
      collectedAmount: balance,
      collectedPaymentMethod: balance > 0 ? paymentMethodForBalance : undefined,
    });

    if (balance > 0) {
      setCashRegister((reg) => ({
        ...reg,
        cashAmount: reg.cashAmount + (paymentMethodForBalance === 'especes' ? balance : 0),
        waveAmount: reg.waveAmount + (paymentMethodForBalance === 'wave' ? balance : 0),
        momoAmount:
          reg.momoAmount + (paymentMethodForBalance === 'momo' || paymentMethodForBalance === 'om' ? balance : 0),
        totalAmount: reg.totalAmount + balance,
      }));
      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === order.customerId
            ? { ...customer, balance: Math.max(0, customer.balance - balance) }
            : customer
        )
      );
    }

    if (activeHandoverOrder?.id === order.id) setActiveHandoverOrder(null);
    const proofSuffix = proof ? ' · preuve de remise enregistrée' : ' · sans preuve de remise';
    notify(
      balance > 0
        ? `✓ ${order.ticketNumber} livrée — ${balance.toLocaleString('fr-FR')} FCFA encaissés via ${PAYMENT_METHOD_LABELS[paymentMethodForBalance]}${proofSuffix}.`
        : `✓ ${order.ticketNumber} livrée — commande déjà soldée${proofSuffix}.`
    );
    return { ok: true };
  };

  const failLogisticsTask = (
    taskId: string,
    reason: LogisticsIssueReason,
    notes?: string
  ): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (task.status !== 'en_route') {
      return { ok: false, error: 'Seule une tournée en route peut être marquée en échec.' };
    }
    patchLogisticsTask(taskId, {
      status: 'failed',
      issueReason: reason,
      issueNotes: notes?.trim() || undefined,
      completedAt: undefined,
    });
    notify('Tournée en échec : elle reste visible dans « À traiter » pour reprogrammation.');
    return { ok: true };
  };

  const cancelLogisticsTask = (
    taskId: string,
    reason: LogisticsIssueReason,
    notes?: string
  ): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (task.status !== 'scheduled' && task.status !== 'failed') {
      return { ok: false, error: 'Seule une tournée programmée ou en échec peut être annulée.' };
    }
    patchLogisticsTask(taskId, {
      status: 'cancelled',
      issueReason: reason,
      issueNotes: notes?.trim() || undefined,
      completedAt: undefined,
    });
    notify('Tournée annulée. Elle pourra être reprogrammée depuis l’historique si besoin.');
    return { ok: true };
  };

  const startOrderFromPickupTask = (taskId: string): boolean => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task || task.kind !== 'pickup') {
      notify('Ce ramassage est introuvable.');
      return false;
    }
    if (task.status !== 'completed') {
      notify('Confirmez d’abord la collecte avant de compter et créer la commande.');
      return false;
    }
    if (task.orderId) {
      notify(`Ce ramassage est déjà converti en commande ${task.orderTicketNumber ?? ''}.`);
      return false;
    }
    const customer = customers.find((c) => c.id === task.customerId);
    if (!customer) {
      notify('La fiche client de ce ramassage est introuvable.');
      return false;
    }

    setCartLines([]);
    setDepositAmount(0);
    setSelectedCustomer(customer);
    // Les instructions de tournée restent sur la course ; les consignes
    // atelier sont saisies séparément après inspection des pièces.
    setOrderNotes('');
    setOrderFulfillmentMethod('counter_pickup');
    setDeliveryAddress(task.address);
    setDeliveryAddressDetails(task.addressDetails ?? '');
    setDeliveryScheduleManual(false);
    setDeliveryDateISOState(toISODate(resolvePromisedDate(pickupOption, promisedDateISO)));
    setDeliveryTimeSlotState(getDefaultDeliveryTimeSlot(pickupOption));
    setPendingPickupTaskId(task.id);
    setSelectedServiceCategory(null);
    setOrderStep(1);
    setActiveScreen('pos');
    notify('Ramassage chargé : comptez les pièces puis enregistrez la commande.');
    return true;
  };

  const cancelPendingPickupConversion = () => {
    if (!pendingPickupTaskId) return;
    setPendingPickupTaskId(null);
    setOrderFulfillmentMethod('counter_pickup');
    setDeliveryAddress(selectedCustomer?.address || '');
    setDeliveryAddressDetails('');
    notify('Ramassage détaché : la saisie redevient une commande comptoir.');
  };

  const focusLogisticsTask = (taskId: string) => {
    setFocusedLogisticsTaskId(taskId);
    setActiveScreen('workshop');
  };

  return {
    createPickupTask,
    updateLogisticsTask,
    assignLogisticsTask,
    startLogisticsTask,
    completePickupTask,
    completeDeliveryTask,
    markLogisticsTaskArrived,
    setLogisticsTaskDestination,
    recordCourierPosition,
    failLogisticsTask,
    cancelLogisticsTask,
    startOrderFromPickupTask,
    cancelPendingPickupConversion,
    focusLogisticsTask,
  };
};
