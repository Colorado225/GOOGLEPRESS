import type {
  Employee,
  FulfillmentMethod,
  LaundryOrder,
  LogisticsIssueReason,
  LogisticsTask,
  LogisticsTaskStatus,
  LogisticsTimeSlot,
  OrderOrigin,
  PaymentMethod,
  PickupOption,
} from '../types';
import { addDaysToISO, formatDateTime, formatISODateFr, todayISO } from './dates';
import { isDeliveryCode, normalizeDeliveryProof } from './deliveryProof';

/**
 * Règles et libellés du service ramassage & livraison.
 * Les tournées restent séparées du statut de production : une commande peut
 * être « prête » pendant que sa livraison est programmée, en route ou en échec.
 */

export const LOGISTICS_TASKS_STORAGE_KEY = 'pressingpro_logistics_tasks';

export const LOGISTICS_TIME_SLOTS: readonly { id: LogisticsTimeSlot; label: string }[] = [
  { id: '08:00-10:00', label: '08h – 10h' },
  { id: '10:00-12:00', label: '10h – 12h' },
  { id: '14:00-16:00', label: '14h – 16h' },
  { id: '16:00-18:00', label: '16h – 18h' },
  { id: '18:00-20:00', label: '18h – 20h' },
] as const;

export const getLogisticsTimeSlotLabel = (slot?: LogisticsTimeSlot): string =>
  LOGISTICS_TIME_SLOTS.find((s) => s.id === slot)?.label ?? 'Créneau non renseigné';

const slotIndex = (slot: LogisticsTimeSlot): number =>
  LOGISTICS_TIME_SLOTS.findIndex((s) => s.id === slot);

export const LOGISTICS_STATUS_LABELS: Record<LogisticsTaskStatus, string> = {
  scheduled: 'Programmé',
  en_route: 'En route',
  completed: 'Terminé',
  failed: 'Échec à reprogrammer',
  cancelled: 'Annulé',
};

export const LOGISTICS_ISSUE_REASON_LABELS: Record<LogisticsIssueReason, string> = {
  customer_absent: 'Client absent',
  customer_unreachable: 'Client injoignable',
  address_issue: 'Adresse introuvable ou incomplète',
  payment_unavailable: 'Paiement indisponible',
  customer_request: 'Report demandé par le client',
  other: 'Autre motif',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  especes: 'Espèces',
  wave: 'Wave',
  momo: 'MTN MoMo',
  om: 'Orange Money',
};

/** Anciennes commandes : aucun champ logistique = dépôt et retrait au comptoir. */
export const getOrderOrigin = (order: Pick<LaundryOrder, 'origin'>): OrderOrigin =>
  order.origin === 'home_pickup' ? 'home_pickup' : 'counter';

export const getOrderFulfillment = (
  order: Pick<LaundryOrder, 'fulfillmentMethod'>
): FulfillmentMethod =>
  order.fulfillmentMethod === 'home_delivery' ? 'home_delivery' : 'counter_pickup';

export const isHomePickupOrder = (order: Pick<LaundryOrder, 'origin'>): boolean =>
  getOrderOrigin(order) === 'home_pickup';

export const isHomeDeliveryOrder = (
  order: Pick<LaundryOrder, 'fulfillmentMethod'>
): boolean => getOrderFulfillment(order) === 'home_delivery';

export const getOrderLogisticsFeesTotal = (
  order: Pick<LaundryOrder, 'collectionFee' | 'deliveryFee'>
): number => Math.max(0, order.collectionFee ?? 0) + Math.max(0, order.deliveryFee ?? 0);

export const normalizeLogisticsFee = (fee: number | undefined | null): number =>
  Number.isFinite(fee) ? Math.max(0, Math.round(fee as number)) : 0;

/**
 * Une tâche demande encore une action si elle doit partir, est en route, a
 * échoué, ou si le linge ramassé attend son comptage/conversion en commande.
 */
export const isLogisticsTaskActionable = (task: LogisticsTask): boolean =>
  task.status === 'scheduled' ||
  task.status === 'en_route' ||
  task.status === 'failed' ||
  (task.kind === 'pickup' && task.status === 'completed' && !task.orderId);

export const compareLogisticsTasks = (a: LogisticsTask, b: LogisticsTask): number => {
  const byDate = a.scheduledDate.localeCompare(b.scheduledDate);
  if (byDate !== 0) return byDate;
  const bySlot = slotIndex(a.timeSlot) - slotIndex(b.timeSlot);
  if (bySlot !== 0) return bySlot;
  return a.createdAt.localeCompare(b.createdAt);
};

export const getDefaultDeliveryTimeSlot = (pickupOption: PickupOption): LogisticsTimeSlot => {
  switch (pickupOption) {
    case 'express':
      return '14:00-16:00';
    case 'delayed':
      return '10:00-12:00';
    case 'standard':
    default:
      return '16:00-18:00';
  }
};

/** « Aujourd’hui • 16h – 18h », « Demain • … », sinon date courte française. */
export function formatLogisticsSchedule(isoDate: string, slot?: LogisticsTimeSlot): string {
  const today = todayISO();
  const dayLabel =
    isoDate === today
      ? 'Aujourd’hui'
      : isoDate === addDaysToISO(today, 1)
        ? 'Demain'
        : formatISODateFr(isoDate, true);
  return `${dayLabel} • ${getLogisticsTimeSlotLabel(slot)}`;
}

/** Horodatage ISO → affichage français historique de l’application. */
export function formatLogisticsDateTime(isoDateTime?: string): string {
  if (!isoDateTime) return 'Non renseigné';
  const date = new Date(isoDateTime);
  return Number.isNaN(date.getTime()) ? 'Non renseigné' : formatDateTime(date);
}

export const getPhoneHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;

/**
 * Candidats à une tournée : employés actifs, personnel « Livraison »
 * proposé en premier, puis ordre alphabétique. N'exclut pas les autres
 * employés actifs, qui peuvent dépanner sur une course.
 */
export const sortCourierCandidates = (employees: Employee[]): Employee[] =>
  employees
    .filter((employee) => employee.status === 'active')
    .sort((a, b) => {
      const aIsCourier = a.position === 'Livraison' ? 0 : 1;
      const bIsCourier = b.position === 'Livraison' ? 0 : 1;
      if (aIsCourier !== bIsCourier) return aIsCourier - bIsCourier;
      return a.fullName.localeCompare(b.fullName, 'fr');
    });

/**
 * Relit une tournée venue du stockage local.
 *
 * Les preuves enregistrées avant l'ajout de cette fonctionnalité n'existent
 * pas ; celles qui existent peuvent être incomplètes. On conserve tout ce qui
 * est exploitable et on ignore le reste, sans jamais fabriquer de preuve.
 */
export const normalizeStoredLogisticsTask = (task: LogisticsTask): LogisticsTask => ({
  ...task,
  deliveryCode: isDeliveryCode(task.deliveryCode) ? task.deliveryCode : undefined,
  proof: normalizeDeliveryProof(task.proof),
});
