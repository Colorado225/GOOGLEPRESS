import type { Employee, LaundryOrder, OrderStatus } from '../types';
import { toISODate } from './dates';
import { normalizeText } from './utils';

/**
 * Fonctions de calcul des rapports, traçables aux données frontend.
 *
 * Points d'honnêteté des mesures :
 * - Les commandes historiques stockent leurs horodatages au format texte
 *   "JJ/MM/AAAA HH:MM" (receivedAt, readyAt, deliveredAt) : ce sont les
 *   seules dates de commande exploitables de façon fiable.
 * - `promisedAt` est un libellé d'affichage ("Jeu. 29 • 17h") sans année :
 *   le retard n'est donc PAS recalculé depuis ce texte, il repose sur le
 *   drapeau métier `isLate` porté par la commande.
 * - Aucun historique de paiements datés n'existe dans le modèle : les
 *   rapports financiers n'inventent aucune série d'encaissements.
 */

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Reçue',
  washing: 'En lavage',
  ironing: 'Repassage / finition',
  ready: 'Prête',
  delivered: 'Livrée',
};

/** Parse "27/10/2026 08:30" (format de stockage des commandes). Null si illisible. */
export function parseStoredDateTime(value: string | undefined | null): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(
    Number(m[3]),
    Number(m[2]) - 1,
    Number(m[1]),
    m[4] ? Number(m[4]) : 12,
    m[5] ? Number(m[5]) : 0
  );
  return isNaN(d.getTime()) ? null : d;
}

/** Jour ISO de réception d'une commande, null si la date stockée est illisible. */
export function orderReceivedISO(order: LaundryOrder): string | null {
  const d = parseStoredDateTime(order.receivedAt);
  return d ? toISODate(d) : null;
}

/** Retard selon le drapeau métier de la commande (une commande livrée n'est plus "en retard"). */
export function isOrderLate(order: LaundryOrder): boolean {
  return order.isLate === true && order.status !== 'delivered';
}

/** "Terminée" pour le rapport d'activité = prête ou livrée (statuts réels du modèle). */
export function isOrderFinished(order: LaundryOrder): boolean {
  return order.status === 'ready' || order.status === 'delivered';
}

/**
 * Commandes affectées à un employé. La relation connue dans les données est
 * le champ texte `assignee` des commandes (prénom saisi à l'atelier, ex.
 * "Grâce") : le rapprochement se fait sur le premier prénom normalisé.
 */
export function getEmployeeAssignedOrders(
  orders: LaundryOrder[],
  employee: Employee
): LaundryOrder[] {
  const firstName = normalizeText(employee.fullName).split(' ')[0];
  if (!firstName) return [];
  return orders.filter((o) => {
    if (!o.assignee) return false;
    return normalizeText(o.assignee).split(' ')[0] === firstName;
  });
}

/**
 * Délai moyen réception → prêt/livré, en heures, uniquement sur les
 * commandes dont les deux horodatages sont lisibles. Null si aucun échantillon.
 */
export function computeAverageTurnaroundHours(
  orders: LaundryOrder[]
): { hours: number; sampleSize: number } | null {
  let totalMs = 0;
  let sampleSize = 0;
  for (const o of orders) {
    const start = parseStoredDateTime(o.receivedAt);
    const end = parseStoredDateTime(o.deliveredAt) ?? parseStoredDateTime(o.readyAt);
    if (start && end && end.getTime() >= start.getTime()) {
      totalMs += end.getTime() - start.getTime();
      sampleSize += 1;
    }
  }
  if (sampleSize === 0) return null;
  return { hours: totalMs / sampleSize / 3_600_000, sampleSize };
}

/** Libellé de durée explicite : "26 h", "2 j 4 h". */
export function formatDurationHours(hours: number): string {
  if (hours < 48) return `${Math.round(hours)} h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days} j ${rem} h` : `${days} j`;
}
