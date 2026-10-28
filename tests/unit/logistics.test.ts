import { describe, expect, it } from 'vitest';
import {
  compareLogisticsTasks,
  formatLogisticsDateTime,
  getDefaultDeliveryTimeSlot,
  getOrderFulfillment,
  getOrderLogisticsFeesTotal,
  getOrderOrigin,
  getPhoneHref,
  isLogisticsTaskActionable,
  normalizeLogisticsFee,
  sortCourierCandidates,
} from '../../src/lib/logistics';
import type { Employee, LogisticsTask } from '../../src/types';

const makeTask = (overrides: Partial<LogisticsTask> = {}): LogisticsTask => ({
  id: 'task-1',
  kind: 'delivery',
  status: 'scheduled',
  customerId: 'cust-1',
  customerName: 'Client Test',
  customerPhone: '+225 07 00 00 00 00',
  address: 'Cocody',
  scheduledDate: '2026-10-28',
  timeSlot: '10:00-12:00',
  fee: 0,
  createdAt: '2026-10-28T08:00:00.000Z',
  updatedAt: '2026-10-28T08:00:00.000Z',
  ...overrides,
});

const makeEmployee = (overrides: Partial<Employee>): Employee => ({
  id: overrides.id ?? 'emp-1',
  fullName: overrides.fullName ?? 'Employé Test',
  position: overrides.position ?? 'Atelier',
  status: overrides.status ?? 'active',
  ...overrides,
});

describe('logistics', () => {
  it('conserve comptoir comme valeur par défaut des anciennes commandes', () => {
    expect(getOrderOrigin({})).toBe('counter');
    expect(getOrderOrigin({ origin: 'home_pickup' })).toBe('home_pickup');
    expect(getOrderFulfillment({})).toBe('counter_pickup');
    expect(getOrderFulfillment({ fulfillmentMethod: 'home_delivery' })).toBe('home_delivery');
  });

  it('normalise les frais et ne totalise jamais de montant négatif', () => {
    expect(normalizeLogisticsFee(499.6)).toBe(500);
    expect(normalizeLogisticsFee(-100)).toBe(0);
    expect(normalizeLogisticsFee(undefined)).toBe(0);
    expect(getOrderLogisticsFeesTotal({ collectionFee: 500, deliveryFee: -200 })).toBe(500);
  });

  it('identifie les tournées qui demandent encore une action', () => {
    expect(isLogisticsTaskActionable(makeTask({ status: 'scheduled' }))).toBe(true);
    expect(isLogisticsTaskActionable(makeTask({ status: 'failed' }))).toBe(true);
    expect(
      isLogisticsTaskActionable(
        makeTask({ kind: 'pickup', status: 'completed', orderId: undefined })
      )
    ).toBe(true);
    expect(
      isLogisticsTaskActionable(
        makeTask({ kind: 'pickup', status: 'completed', orderId: 'order-1' })
      )
    ).toBe(false);
    expect(isLogisticsTaskActionable(makeTask({ status: 'cancelled' }))).toBe(false);
  });

  it('trie les tournées par date, créneau puis création', () => {
    const laterSlot = makeTask({ id: 'later-slot', timeSlot: '16:00-18:00' });
    const earlierSlot = makeTask({ id: 'earlier-slot', timeSlot: '08:00-10:00' });
    const nextDay = makeTask({ id: 'next-day', scheduledDate: '2026-10-29' });

    expect([nextDay, laterSlot, earlierSlot].sort(compareLogisticsTasks).map((task) => task.id)).toEqual([
      'earlier-slot',
      'later-slot',
      'next-day',
    ]);
  });

  it('propose le créneau cohérent avec le délai et nettoie les liens téléphone', () => {
    expect(getDefaultDeliveryTimeSlot('express')).toBe('14:00-16:00');
    expect(getDefaultDeliveryTimeSlot('standard')).toBe('16:00-18:00');
    expect(getDefaultDeliveryTimeSlot('delayed')).toBe('10:00-12:00');
    expect(getPhoneHref('+225 07-08 09')).toBe('tel:+225070809');
    expect(formatLogisticsDateTime('invalide')).toBe('Non renseigné');
  });

  it('place les livreurs actifs avant les autres employés actifs', () => {
    const employees = [
      makeEmployee({ id: 'atelier', fullName: 'Awa Atelier', position: 'Lavage' }),
      makeEmployee({ id: 'inactive', fullName: 'Nina Inactive', position: 'Livraison', status: 'inactive' }),
      makeEmployee({ id: 'courier', fullName: 'Zoe Coursier', position: 'Livraison' }),
    ];

    expect(sortCourierCandidates(employees).map((employee) => employee.id)).toEqual([
      'courier',
      'atelier',
    ]);
  });
});
