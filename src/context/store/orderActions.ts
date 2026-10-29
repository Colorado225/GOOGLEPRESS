import type { Dispatch, SetStateAction } from 'react';
import type {
  CashRegisterData,
  Customer,
  FulfillmentMethod,
  LaundryOrder,
  LogisticsTask,
  LogisticsTimeSlot,
  OrderLine,
  OrderStatus,
  PickupOption,
  ServiceCategory,
  ShopSettings,
} from '../../types';
import { fireOrderCelebration } from '../../registry/magicui/confetti';
import { calculateOrderTotals } from '../../lib/pricing';
import {
  formatPromised,
  getPromisedDate,
  isValidISODate,
  nowDateTime,
  nowISODateTime,
  todayISO,
} from '../../lib/dates';
import {
  PAYMENT_METHOD_LABELS,
  isHomeDeliveryOrder,
  normalizeLogisticsFee,
} from '../../lib/logistics';
import { generateDeliveryCode } from '../../lib/deliveryProof';
import { countOrdersInMonth, guardMonthlyOrderCount } from '../../lib/planAccess';
import type { SubscriptionPlanId } from '../../lib/subscription';
import { createLocalId as genId } from '../../lib/localPersistence';
import type { NotifyFn } from './types';

export interface OrderActionsDeps {
  orders: LaundryOrder[];
  setOrders: Dispatch<SetStateAction<LaundryOrder[]>>;
  cartLines: OrderLine[];
  selectedCustomer: Customer | null;
  pickupOption: PickupOption;
  orderFulfillmentMethod: FulfillmentMethod;
  deliveryAddress: string;
  deliveryAddressDetails: string;
  deliveryDateISO: string;
  deliveryTimeSlot: LogisticsTimeSlot;
  pendingPickupTask: LogisticsTask | null;
  pendingPickupTaskId: string | null;
  nextTicketNumber: number;
  setNextTicketNumber: Dispatch<SetStateAction<number>>;
  setLogisticsTasks: Dispatch<SetStateAction<LogisticsTask[]>>;
  setCashRegister: Dispatch<SetStateAction<CashRegisterData>>;
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  setPreviewTicket: (order: LaundryOrder | null) => void;
  paymentMethod: 'especes' | 'wave' | 'momo' | 'om';
  depositAmount: number;
  orderNotes: string;
  selectedServiceCategory: ServiceCategory | null;
  effectivePlanId: SubscriptionPlanId;
  shopSettings: ShopSettings;
  logisticsTasks: LogisticsTask[];
  activeHandoverOrder: LaundryOrder | null;
  setActiveHandoverOrder: (order: LaundryOrder | null) => void;
  clearCart: () => void;
  resetLogisticsDraft: (option?: PickupOption) => void;
  notify: NotifyFn;
}

export interface OrderActions {
  submitNewOrder: () => LaundryOrder | null;
  moveOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  settleAndDeliverOrder: (orderId: string, method: 'especes' | 'wave' | 'momo' | 'om') => void;
}

/**
 * Cycle de vie des commandes : enregistrement au POS (avec quota mensuel,
 * conversion de ramassage, livraison à domicile, acompte et aperçu du
 * ticket), transitions de production du Kanban et remise comptoir avec
 * encaissement du solde.
 */
export const createOrderActions = (deps: OrderActionsDeps): OrderActions => {
  const {
    orders,
    setOrders,
    cartLines,
    selectedCustomer,
    pickupOption,
    orderFulfillmentMethod,
    deliveryAddress,
    deliveryAddressDetails,
    deliveryDateISO,
    deliveryTimeSlot,
    pendingPickupTask,
    pendingPickupTaskId,
    nextTicketNumber,
    setNextTicketNumber,
    setLogisticsTasks,
    setCashRegister,
    setCustomers,
    setPreviewTicket,
    paymentMethod,
    depositAmount,
    orderNotes,
    selectedServiceCategory,
    effectivePlanId,
    shopSettings,
    logisticsTasks,
    activeHandoverOrder,
    setActiveHandoverOrder,
    clearCart,
    resetLogisticsDraft,
    notify,
  } = deps;

  const submitNewOrder = (): LaundryOrder | null => {
    const monthlyGuard = guardMonthlyOrderCount(
      countOrdersInMonth(orders),
      effectivePlanId
    );
    if (!monthlyGuard.allowed) {
      notify(monthlyGuard.message);
      return null;
    }
    if (cartLines.length === 0) {
      notify('Le panier est vide. Veuillez ajouter au moins un vêtement ou linge.');
      return null;
    }

    // Sur un espace réel vide, aucun client fictif n'est pré-sélectionné :
    // la commande ne peut pas être enregistrée sans dossier client.
    const customer = selectedCustomer;
    if (!customer) {
      notify('Sélectionnez ou créez un client avant d’enregistrer la commande.');
      return null;
    }

    // Conversion d'un ramassage : la course doit être collectée, non encore
    // convertie, et appartenir au client actuellement sélectionné.
    const sourcePickupTask = pendingPickupTask;
    if (pendingPickupTaskId) {
      if (
        !sourcePickupTask ||
        sourcePickupTask.kind !== 'pickup' ||
        sourcePickupTask.status !== 'completed' ||
        sourcePickupTask.orderId ||
        sourcePickupTask.customerId !== customer.id
      ) {
        notify('Ce ramassage ne peut pas être converti pour le client sélectionné.');
        return null;
      }
    }

    const wantsHomeDelivery = orderFulfillmentMethod === 'home_delivery';
    const cleanDeliveryAddress = deliveryAddress.trim();
    const cleanDeliveryDetails = deliveryAddressDetails.trim();
    if (wantsHomeDelivery) {
      if (!cleanDeliveryAddress) {
        notify('Renseignez l’adresse de livraison avant d’enregistrer la commande.');
        return null;
      }
      if (!isValidISODate(deliveryDateISO) || deliveryDateISO < todayISO()) {
        notify('Choisissez une date de livraison valide, aujourd’hui ou plus tard.');
        return null;
      }
    }

    const collectionFee = sourcePickupTask ? normalizeLogisticsFee(sourcePickupTask.fee) : 0;
    const deliveryFee = wantsHomeDelivery
      ? normalizeLogisticsFee(shopSettings.deliveryFee)
      : 0;

    const { subtotal, expressFee, discountAmount: discount, total, deposit, remaining } =
      calculateOrderTotals(cartLines, {
        pickupOption,
        loyaltyDiscountPercent: customer.loyaltyDiscountPercent,
        depositAmount,
        collectionFee,
        deliveryFee,
      });

    const nextTicketNum = `#TK-${nextTicketNumber}`;
    const promised = formatPromised(getPromisedDate(pickupOption));
    const orderId = genId('ord');
    const nowIso = nowISODateTime();

    const deliveryTask: LogisticsTask | null = wantsHomeDelivery
      ? {
          id: genId('log'),
          kind: 'delivery',
          status: 'scheduled',
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          address: cleanDeliveryAddress,
          addressDetails: cleanDeliveryDetails || undefined,
          scheduledDate: deliveryDateISO,
          timeSlot: deliveryTimeSlot,
          orderId,
          orderTicketNumber: nextTicketNum,
          // Code communiqué au client, saisi par le coursier à la remise.
          deliveryCode: generateDeliveryCode(),
          fee: deliveryFee,
          createdAt: nowIso,
          updatedAt: nowIso,
        }
      : null;

    const newOrder: LaundryOrder = {
      id: orderId,
      ticketNumber: nextTicketNum,
      serviceCategory: selectedServiceCategory || 'pressing',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      lines: [...cartLines],
      subtotal,
      serviceFees: expressFee,
      discount,
      total,
      depositPaid: deposit,
      remainingBalance: remaining,
      paymentMethod,
      status: 'received',
      receivedAt: nowDateTime(),
      promisedAt: promised,
      notes: orderNotes,
      smsSent: false,
      origin: sourcePickupTask ? 'home_pickup' : 'counter',
      fulfillmentMethod: orderFulfillmentMethod,
      collectionTaskId: sourcePickupTask?.id,
      collectionFee,
      collectionAddress: sourcePickupTask?.address,
      collectionAddressDetails: sourcePickupTask?.addressDetails,
      collectionDate: sourcePickupTask?.scheduledDate,
      collectionTimeSlot: sourcePickupTask?.timeSlot,
      deliveryTaskId: deliveryTask?.id,
      deliveryFee,
      deliveryAddress: wantsHomeDelivery ? cleanDeliveryAddress : undefined,
      deliveryAddressDetails: wantsHomeDelivery
        ? cleanDeliveryDetails || undefined
        : undefined,
      deliveryDate: wantsHomeDelivery ? deliveryDateISO : undefined,
      deliveryTimeSlot: wantsHomeDelivery ? deliveryTimeSlot : undefined,
    };

    setOrders((prev) => [newOrder, ...prev]);
    setLogisticsTasks((prev) => {
      const linked = sourcePickupTask
        ? prev.map((task) =>
            task.id === sourcePickupTask.id
              ? {
                  ...task,
                  orderId,
                  orderTicketNumber: nextTicketNum,
                  updatedAt: nowISODateTime(),
                }
              : task
          )
        : prev;
      return deliveryTask ? [deliveryTask, ...linked] : linked;
    });
    setNextTicketNumber((n) => n + 1);

    // Update cash register if deposit received
    if (deposit > 0) {
      setCashRegister((prev) => {
        const cashInc = paymentMethod === 'especes' ? deposit : 0;
        const waveInc = paymentMethod === 'wave' ? deposit : 0;
        const momoInc = paymentMethod === 'momo' || paymentMethod === 'om' ? deposit : 0;
        return {
          ...prev,
          cashAmount: prev.cashAmount + cashInc,
          waveAmount: prev.waveAmount + waveInc,
          momoAmount: prev.momoAmount + momoInc,
          totalAmount: prev.totalAmount + deposit,
        };
      });
    }

    // Update customer deposits
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? { ...c, depositsCount: c.depositsCount + 1, balance: c.balance + remaining }
          : c
      )
    );

    // Trigger festive celebratory confetti
    try {
      fireOrderCelebration(newOrder.serviceCategory);
    } catch (e) {
      console.warn('Confetti trigger error', e);
    }

    // Open ticket preview
    setPreviewTicket(newOrder);
    clearCart();
    resetLogisticsDraft();
    notify(
      wantsHomeDelivery
        ? `✓ Commande ${newOrder.ticketNumber} enregistrée — livraison à programmer dans Tournées.`
        : `✓ Commande ${newOrder.ticketNumber} enregistrée avec succès! 🎉`
    );
    return newOrder;
  };

  const moveOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // La remise finale passe toujours par un encaissement contrôlé : comptoir
    // pour un retrait, confirmation de tournée pour une livraison à domicile.
    if (newStatus === 'delivered') {
      notify(
        isHomeDeliveryOrder(order)
          ? 'Confirmez la livraison depuis l’onglet Tournées pour encaisser le solde une seule fois.'
          : 'Utilisez l’onglet Remises pour encaisser puis remettre la commande au comptoir.'
      );
      return;
    }
    if (order.status === 'delivered') {
      notify('Cette commande est déjà remise : son statut de production ne peut plus changer.');
      return;
    }
    const activeDelivery = logisticsTasks.find(
      (task) => task.kind === 'delivery' && task.orderId === order.id && task.status === 'en_route'
    );
    if (activeDelivery) {
      notify('Cette commande est déjà en route : terminez ou signalez la livraison dans Tournées avant tout retour en production.');
      return;
    }
    if (
      newStatus === 'ready' &&
      order.status !== 'ready' &&
      shopSettings.storageAssignmentRequired
    ) {
      notify('Règle du propriétaire : choisissez un casier pour marquer cette commande prête.');
      return;
    }

    const now = nowDateTime();
    const leavingReady = order.status === 'ready' && newStatus !== 'ready';
    const clearedStorageFields = {
      rackLocation: undefined,
      storageLocationId: undefined,
      storageLocationCode: undefined,
      storageLocationLabel: undefined,
      storagePackageCount: undefined,
      storageNotes: undefined,
      storedAt: undefined,
    };
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            status: newStatus,
            readyAt: newStatus === 'ready' ? now : leavingReady ? undefined : ord.readyAt,
            // Entrée en « Prêt » : la commande n'est pas encore marquée comme
            // notifiée localement (le champ historique ne prouve aucun SMS).
            smsSent: newStatus === 'ready' && ord.status !== 'ready' ? false : ord.smsSent,
            deliveredAt: ord.deliveredAt,
            // Une commande qui repart en production n'occupe plus le rayon des
            // prêts ; une nouvelle arrivée en « Prêt » repart non rangée.
            ...(leavingReady || (newStatus === 'ready' && ord.status !== 'ready')
              ? clearedStorageFields
              : {}),
          };
        }
        return ord;
      })
    );
    notify(
      leavingReady
        ? `${order.ticketNumber} retourne en production — son emplacement est libéré.`
        : newStatus === 'ready'
          ? `✓ ${order.ticketNumber} est prête — pensez à la ranger dans l’onglet Rangement.`
          : 'Statut mis à jour'
    );
  };

  const settleAndDeliverOrder = (orderId: string, method: 'especes' | 'wave' | 'momo' | 'om') => {
    // Lecture de la commande AVANT toute mise à jour d'état : les updaters
    // React doivent rester des fonctions pures. L'ancienne version appelait
    // setCashRegister à l'intérieur de l'updater de setOrders, ce qui pouvait
    // créditer la caisse deux fois (ex. double invocation en mode Strict).
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    if (isHomeDeliveryOrder(order)) {
      notify('Cette commande est en livraison à domicile : terminez-la depuis l’onglet Tournées.');
      return;
    }
    if (order.status !== 'ready') {
      notify('Seule une commande prête peut être remise au comptoir.');
      return;
    }
    const balance = order.remainingBalance;
    const deliveredAt = nowDateTime();

    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId
          ? { ...ord, depositPaid: ord.total, remainingBalance: 0, status: 'delivered', deliveredAt }
          : ord
      )
    );

    if (balance > 0) {
      setCashRegister((reg) => ({
        ...reg,
        cashAmount: reg.cashAmount + (method === 'especes' ? balance : 0),
        waveAmount: reg.waveAmount + (method === 'wave' ? balance : 0),
        momoAmount: reg.momoAmount + (method === 'momo' || method === 'om' ? balance : 0),
        totalAmount: reg.totalAmount + balance,
      }));
      // Le reste à payer avait été ajouté au solde dû du client à la création
      // de la commande : on le déduit maintenant qu'il est encaissé.
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === order.customerId ? { ...c, balance: Math.max(0, c.balance - balance) } : c
        )
      );
    }

    if (activeHandoverOrder?.id === orderId) setActiveHandoverOrder(null);
    notify(`✓ Commande remise au client et solde encaissé via ${PAYMENT_METHOD_LABELS[method]}!`);
  };

  return { submitNewOrder, moveOrderStatus, settleAndDeliverOrder };
};
