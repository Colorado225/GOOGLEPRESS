import type { InventoryProduct, LaundryOrder } from '../types';
import { formatQuantity, getAlertProducts, getStockStatus } from './inventory';

export type PressingAlertSeverity = 'critical' | 'warning' | 'info';
export type PressingAlertScreen = 'orders' | 'workshop' | 'inventory';

export interface PressingAlert {
  id: string;
  severity: PressingAlertSeverity;
  title: string;
  detail: string;
  screen: PressingAlertScreen;
  orderId?: string;
}

export const getLateOrders = (orders: LaundryOrder[]): LaundryOrder[] =>
  orders.filter((order) => order.status !== 'delivered' && Boolean(order.isLate));

/**
 * Le champ historique `smsSent` signifie uniquement « notification marquée
 * localement dans l'application ». Tant qu'aucune passerelle n'est connectée,
 * il ne prouve pas l'envoi d'un SMS externe.
 */
export const getReadyOrdersToMarkNotified = (orders: LaundryOrder[]): LaundryOrder[] =>
  orders.filter((order) => order.status === 'ready' && !order.smsSent);

const plural = (count: number, singular: string, pluralForm: string): string =>
  count > 1 ? pluralForm : singular;

export function getPressingAlerts(
  orders: LaundryOrder[],
  products: InventoryProduct[]
): PressingAlert[] {
  const alerts: PressingAlert[] = [];

  const lateOrders = getLateOrders(orders);
  if (lateOrders.length > 0) {
    const first = lateOrders[0];
    alerts.push({
      id: 'late-orders',
      severity: 'critical',
      title: `${lateOrders.length} ${plural(lateOrders.length, 'commande en retard', 'commandes en retard')}`,
      detail: `${first.ticketNumber} • ${first.customerName} • promis ${first.promisedAt}`,
      screen: 'orders',
      orderId: first.id,
    });
  }

  const stockAlerts = getAlertProducts(products);
  if (stockAlerts.length > 0) {
    const first = stockAlerts[0];
    const hasOutOfStock = stockAlerts.some(
      (product) => getStockStatus(product.currentQuantity, product.alertThreshold) === 'out'
    );
    alerts.push({
      id: 'stock-alerts',
      severity: hasOutOfStock ? 'critical' : 'warning',
      title: `${stockAlerts.length} ${plural(stockAlerts.length, 'produit en alerte stock', 'produits en alerte stock')}`,
      detail: `${first.name} : ${formatQuantity(first.currentQuantity, first.unit)} (seuil ${formatQuantity(first.alertThreshold, first.unit)})`,
      screen: 'inventory',
    });
  }

  const readyToNotify = getReadyOrdersToMarkNotified(orders);
  if (readyToNotify.length > 0) {
    const first = readyToNotify[0];
    alerts.push({
      id: 'ready-to-notify-locally',
      severity: 'warning',
      title: `${readyToNotify.length} ${plural(readyToNotify.length, 'commande prête à marquer comme notifiée', 'commandes prêtes à marquer comme notifiées')}`,
      detail: `${first.ticketNumber} • ${first.customerName} • aucun SMS externe n’est envoyé par cette action locale`,
      screen: 'workshop',
      orderId: first.id,
    });
  }

  return alerts;
}
