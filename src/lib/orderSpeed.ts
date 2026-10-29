export type OrderSpeed = 'normal' | 'express' | 'mixed';
export type OrderSpeedFilter = 'all' | OrderSpeed;

export interface OrderSpeedSource {
  isUrgent?: boolean;
  lines: readonly { isExpress?: boolean }[];
}

/** Délai d'une commande, avec repli sur l'ancien indicateur urgent global. */
export function getOrderSpeed(order: OrderSpeedSource): OrderSpeed {
  if (order.lines.length === 0) return order.isUrgent ? 'express' : 'normal';
  const expressCount = order.lines.filter(
    (line) => line.isExpress ?? Boolean(order.isUrgent)
  ).length;
  if (expressCount === 0) return 'normal';
  return expressCount === order.lines.length ? 'express' : 'mixed';
}

/**
 * Une commande mixte est volontairement incluse dans Express : au moins une
 * ligne urgente lui donne la priorité atelier Express 24h.
 */
export function matchesOrderSpeedFilter(
  order: OrderSpeedSource,
  filter: OrderSpeedFilter
): boolean {
  if (filter === 'all') return true;
  const speed = getOrderSpeed(order);
  if (filter === 'express') return speed === 'express' || speed === 'mixed';
  return speed === filter;
}

export function getOrderSpeedLabel(order: OrderSpeedSource): string {
  const speed = getOrderSpeed(order);
  if (speed === 'mixed') return 'Express · mixte';
  return speed === 'express' ? 'Express 24h' : 'Normal';
}
