import type { LogisticsTaskStatus, OrderStatus } from '../types';

/**
 * Règles pures du suivi de commande synchronisé.
 *
 * La production et la logistique restent deux machines à états distinctes :
 * une commande peut être « prête » pendant que sa livraison est programmée,
 * en route ou en échec. La remise finale ne fait pas partie des transitions
 * génériques de production : elle reste réservée à l'encaissement comptoir
 * ou à la confirmation d'une tournée.
 */

export const ORDER_STATUS_SEQUENCE: readonly OrderStatus[] = [
  'received',
  'washing',
  'ironing',
  'ready',
  'delivered',
] as const;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Réceptionnée',
  washing: 'En lavage',
  ironing: 'En repassage / finition',
  ready: 'Prête',
  delivered: 'Remise / livrée',
};

export const ORDER_TRACKING_STEP_LABELS: Record<OrderStatus, string> = {
  received: 'Reçue',
  washing: 'Lavage',
  ironing: 'Repassage',
  ready: 'Prête',
  delivered: 'Remise',
};

export const PRODUCTION_STAFF_ROLES = [
  'organization_owner',
  'shop_manager',
  'cashier',
  'workshop',
] as const;

export type OrderEventVisibility = 'customer' | 'internal';

export interface OrderEventLike {
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  payload?: unknown;
}

export interface MembershipScopeLike {
  organization_id: string;
  shop_id: string | null;
  role: string;
  status: string;
}

export interface OrderScopeLike {
  organization_id: string;
  shop_id: string;
}

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' &&
  (ORDER_STATUS_SEQUENCE as readonly string[]).includes(value);

export const getOrderStatusRank = (status: OrderStatus): number =>
  ORDER_STATUS_SEQUENCE.indexOf(status) + 1;

export const getAdjacentOrderStatuses = (
  status: OrderStatus
): { previous?: OrderStatus; next?: OrderStatus } => {
  const index = ORDER_STATUS_SEQUENCE.indexOf(status);
  return {
    previous: index > 0 ? ORDER_STATUS_SEQUENCE[index - 1] : undefined,
    next: index >= 0 && index < ORDER_STATUS_SEQUENCE.length - 1
      ? ORDER_STATUS_SEQUENCE[index + 1]
      : undefined,
  };
};

/**
 * Vrai uniquement pour un déplacement de production d'une étape, en avant
 * ou en arrière. `delivered` est volontairement exclu des deux côtés.
 */
export const canTransitionProductionStatus = (
  current: OrderStatus,
  target: OrderStatus
): boolean => {
  if (current === 'delivered' || target === 'delivered' || current === target) {
    return false;
  }
  return Math.abs(getOrderStatusRank(target) - getOrderStatusRank(current)) === 1;
};

export const getProductionTransitionTargets = (
  status: OrderStatus
): { previous?: OrderStatus; next?: OrderStatus } => {
  if (status === 'delivered') return {};
  const adjacent = getAdjacentOrderStatuses(status);
  return {
    previous: adjacent.previous,
    next: adjacent.next === 'delivered' ? undefined : adjacent.next,
  };
};

export const getOrderProgressPercent = (status: OrderStatus): number =>
  getOrderStatusRank(status) * 20;

export const getOrderEventNote = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const note = (payload as { note?: unknown }).note;
  if (typeof note !== 'string') return null;
  const trimmed = note.trim();
  return trimmed ? trimmed : null;
};

export const getOrderEventLabel = (event: OrderEventLike): string => {
  if (event.event_type === 'order.created') return 'Commande reçue';
  if (event.event_type === 'order.status_changed' && isOrderStatus(event.to_status)) {
    return `Statut : ${ORDER_STATUS_LABELS[event.to_status]}`;
  }
  if (isOrderStatus(event.to_status)) {
    return `Mise à jour : ${ORDER_STATUS_LABELS[event.to_status]}`;
  }
  return 'Mise à jour de la commande';
};

export const getOrderEventActorLabel = (actorType: string): string => {
  switch (actorType) {
    case 'staff':
      return 'Équipe de la boutique';
    case 'customer':
      return 'Client';
    case 'system':
      return 'Système';
    default:
      return 'Acteur non renseigné';
  }
};

export const canMembershipTransitionOrder = (
  memberships: readonly MembershipScopeLike[],
  order: OrderScopeLike
): boolean =>
  memberships.some((membership) => {
    if (membership.status !== 'active') return false;
    if (!(PRODUCTION_STAFF_ROLES as readonly string[]).includes(membership.role)) return false;
    if (membership.role === 'organization_owner') {
      return membership.organization_id === order.organization_id;
    }
    return membership.shop_id === order.shop_id;
  });

export const compareByUpdatedAtDesc = <T extends { id: string; updated_at: string }>(
  a: T,
  b: T
): number => {
  const byUpdatedAt = b.updated_at.localeCompare(a.updated_at);
  return byUpdatedAt !== 0 ? byUpdatedAt : a.id.localeCompare(b.id);
};

/** Remplace une ligne par sa version la plus récente, sans perdre le tri. */
export const upsertByUpdatedAt = <T extends { id: string; updated_at: string }>(
  rows: readonly T[],
  incoming: T
): T[] => {
  const existingIndex = rows.findIndex((row) => row.id === incoming.id);
  if (existingIndex < 0) return [...rows, incoming].sort(compareByUpdatedAtDesc);

  const existing = rows[existingIndex];
  if (existing.updated_at > incoming.updated_at) return [...rows];

  const next = [...rows];
  next[existingIndex] = incoming;
  return next.sort(compareByUpdatedAtDesc);
};

export const isLogisticsTaskStatus = (value: unknown): value is LogisticsTaskStatus =>
  value === 'scheduled' ||
  value === 'en_route' ||
  value === 'completed' ||
  value === 'failed' ||
  value === 'cancelled';
