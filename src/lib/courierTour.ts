import type { Employee, LaundryOrder, LogisticsTask } from '../types';
import { LOGISTICS_TIME_SLOTS } from './logistics';
import { hasDeliveryProof } from './deliveryProof';

/**
 * Écran coursier : quelles tournées montrer, dans quel ordre, et quel
 * récapitulatif en fin de journée.
 *
 * Fonctions pures pour que l'ordre des arrêts et les totaux se testent sans
 * navigateur. L'identité du coursier est locale (aucun lien entre le compte de
 * connexion et la fiche employé aujourd'hui) : on retient le dernier choix.
 */

export const ACTIVE_COURIER_STORAGE_KEY = 'pressingpro_active_courier';

/** Dernier coursier choisi sur cet appareil, s'il existe encore. */
export const readStoredActiveCourierId = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = localStorage.getItem(ACTIVE_COURIER_STORAGE_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
};

export const persistActiveCourierId = (employeeId: string): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_COURIER_STORAGE_KEY, employeeId);
  } catch {
    // Stockage plein ou navigation privée : le choix vaut pour la session.
  }
};

/**
 * Coursier par défaut : le choix mémorisé s'il est encore actif, sinon un
 * employé dont le poste mentionne la livraison, sinon le premier employé actif.
 */
export const resolveActiveCourierId = (
  employees: readonly Employee[],
  storedId?: string | null
): string | null => {
  const active = employees.filter((employee) => employee.status === 'active');
  if (storedId && active.some((employee) => employee.id === storedId)) return storedId;
  const delivery = active.find((employee) =>
    employee.position.toLocaleLowerCase('fr').includes('livraison')
  );
  return (delivery ?? active[0])?.id ?? null;
};

const slotRank = (task: LogisticsTask): number => {
  const index = LOGISTICS_TIME_SLOTS.findIndex((slot) => slot.id === task.timeSlot);
  return index === -1 ? LOGISTICS_TIME_SLOTS.length : index;
};

/**
 * Arrêts d'un coursier pour une journée, dans l'ordre de la tournée.
 *
 * Les tournées annulées disparaissent ; les tournées terminées restent, en fin
 * de liste, pour que le coursier voie ce qu'il a déjà fait. Une course en échec
 * reste visible : elle doit être reprogrammée, pas oubliée.
 */
export const getCourierStops = (
  tasks: readonly LogisticsTask[],
  courierId: string | null,
  dateISO: string
): LogisticsTask[] => {
  if (!courierId) return [];
  return tasks
    .filter(
      (task) =>
        task.assignedEmployeeId === courierId &&
        task.scheduledDate === dateISO &&
        task.status !== 'cancelled'
    )
    .sort((a, b) => {
      const doneA = a.status === 'completed' ? 1 : 0;
      const doneB = b.status === 'completed' ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      const bySlot = slotRank(a) - slotRank(b);
      if (bySlot !== 0) return bySlot;
      return a.createdAt.localeCompare(b.createdAt);
    });
};

export interface CourierTourSummary {
  total: number;
  /** Courses pas encore démarrées. */
  pending: number;
  /** Courses en route. */
  enRoute: number;
  /** Courses terminées. */
  done: number;
  /** Courses en échec, à reprogrammer côté comptoir. */
  failed: number;
  /** Montant déjà encaissé par le coursier dans la journée. */
  collectedXof: number;
  /** Reste à encaisser sur les livraisons non terminées. */
  dueXof: number;
  /** Livraisons terminées avec au moins une preuve enregistrée. */
  proofs: number;
}

export const summarizeCourierTour = (
  stops: readonly LogisticsTask[],
  orders: readonly LaundryOrder[] = []
): CourierTourSummary => {
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const summary: CourierTourSummary = {
    total: stops.length,
    pending: 0,
    enRoute: 0,
    done: 0,
    failed: 0,
    collectedXof: 0,
    dueXof: 0,
    proofs: 0,
  };

  for (const task of stops) {
    if (task.status === 'scheduled') summary.pending += 1;
    if (task.status === 'en_route') summary.enRoute += 1;
    if (task.status === 'failed') summary.failed += 1;
    if (task.status === 'completed') {
      summary.done += 1;
      if (task.kind === 'delivery') {
        summary.collectedXof += Math.max(0, task.collectedAmount ?? 0);
        if (hasDeliveryProof(task.proof)) summary.proofs += 1;
      }
    } else if (task.kind === 'delivery' && task.orderId) {
      const order = orderById.get(task.orderId);
      if (order) summary.dueXof += Math.max(0, order.remainingBalance);
    }
  }

  return summary;
};

/** Prochaine course à traiter (en route d'abord, puis programmée, puis échec). */
export const getNextCourierStop = (stops: readonly LogisticsTask[]): LogisticsTask | null => {
  const rank = (task: LogisticsTask): number => {
    if (task.status === 'en_route') return 0;
    if (task.status === 'scheduled') return 1;
    if (task.status === 'failed') return 2;
    return 3;
  };
  return (
    [...stops]
      .filter((task) => task.status !== 'completed')
      .sort((a, b) => rank(a) - rank(b))[0] ?? null
  );
};
