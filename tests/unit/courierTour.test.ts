import { describe, expect, it } from 'vitest';
import {
  getCourierStops,
  getNextCourierStop,
  resolveActiveCourierId,
  summarizeCourierTour,
} from '../../src/lib/courierTour';
import type { Employee, LaundryOrder, LogisticsTask } from '../../src/types';

const employee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'emp-1',
  fullName: 'Yao Coursier',
  position: 'Livraison',
  status: 'active',
  ...overrides,
});

const task = (overrides: Partial<LogisticsTask> = {}): LogisticsTask => ({
  id: 'task-1',
  kind: 'delivery',
  status: 'scheduled',
  customerId: 'cust-1',
  customerName: 'Awa Koné',
  customerPhone: '+225 07 00 00 00 01',
  address: 'Cocody',
  scheduledDate: '2026-10-28',
  timeSlot: '10:00-12:00',
  assignedEmployeeId: 'emp-1',
  fee: 1000,
  createdAt: '2026-10-28T08:00:00.000Z',
  updatedAt: '2026-10-28T08:00:00.000Z',
  ...overrides,
});

const order = (overrides: Partial<LaundryOrder> = {}): LaundryOrder => ({
  id: 'ord-1',
  ticketNumber: '#TK-1001',
  serviceCategory: 'pressing',
  customerId: 'cust-1',
  customerName: 'Awa Koné',
  customerPhone: '+225 07 00 00 00 01',
  customerAddress: 'Cocody',
  lines: [],
  subtotal: 3000,
  serviceFees: 0,
  discount: 0,
  total: 3000,
  depositPaid: 0,
  remainingBalance: 3000,
  paymentMethod: 'wave',
  status: 'ready',
  receivedAt: '2026-10-28T08:00:00.000Z',
  promisedAt: '2026-10-28',
  notes: '',
  smsSent: false,
  origin: 'counter',
  fulfillmentMethod: 'home_delivery',
  ...overrides,
});

describe('courierTour — coursier actif', () => {
  it('respecte le dernier choix s’il est encore actif', () => {
    const employees = [employee({ id: 'emp-1' }), employee({ id: 'emp-2', fullName: 'Aya' })];
    expect(resolveActiveCourierId(employees, 'emp-2')).toBe('emp-2');
  });

  it('préfère un poste « Livraison », sinon le premier actif', () => {
    const employees = [
      employee({ id: 'atelier', fullName: 'Awa Atelier', position: 'Lavage' }),
      employee({ id: 'livreur', fullName: 'Yao Livreur', position: 'Livraison' }),
    ];
    expect(resolveActiveCourierId(employees, null)).toBe('livreur');
    expect(resolveActiveCourierId(employees, 'employe-supprime')).toBe('livreur');
    expect(resolveActiveCourierId([employee({ id: 'seul', status: 'inactive' })], null)).toBeNull();
  });
});

describe('courierTour — arrêts de la journée', () => {
  it('ne garde que les tournées du coursier, du jour, hors annulations', () => {
    const tasks = [
      task({ id: 'ok-1' }),
      task({ id: 'autre-coursier', assignedEmployeeId: 'emp-2' }),
      task({ id: 'autre-jour', scheduledDate: '2026-10-29' }),
      task({ id: 'annulee', status: 'cancelled' }),
    ];
    expect(getCourierStops(tasks, 'emp-1', '2026-10-28').map((item) => item.id)).toEqual(['ok-1']);
    expect(getCourierStops(tasks, null, '2026-10-28')).toEqual([]);
  });

  it('ordonne par créneau, puis place les courses terminées à la fin', () => {
    const tasks = [
      task({ id: 'apres-midi', timeSlot: '16:00-18:00' }),
      task({ id: 'matin', timeSlot: '08:00-10:00' }),
      task({ id: 'terminee', timeSlot: '08:00-10:00', status: 'completed' }),
    ];
    expect(getCourierStops(tasks, 'emp-1', '2026-10-28').map((item) => item.id)).toEqual([
      'matin',
      'apres-midi',
      'terminee',
    ]);
  });

  it('désigne la prochaine course : en route, puis programmée, puis en échec', () => {
    expect(
      getNextCourierStop([
        task({ id: 'echec', status: 'failed' }),
        task({ id: 'programmee', status: 'scheduled' }),
        task({ id: 'en-route', status: 'en_route' }),
        task({ id: 'finie', status: 'completed' }),
      ])?.id
    ).toBe('en-route');
    expect(getNextCourierStop([task({ id: 'finie', status: 'completed' })])).toBeNull();
  });
});

describe('courierTour — récapitulatif', () => {
  it('compte les arrêts, l’encaissé, les preuves et le reste à encaisser', () => {
    const stops = [
      task({ id: 'a', status: 'scheduled', orderId: 'ord-1' }),
      task({ id: 'b', status: 'en_route', orderId: 'ord-2' }),
      task({ id: 'c', status: 'completed', orderId: 'ord-3', collectedAmount: 2500 }),
      task({
        id: 'd',
        status: 'completed',
        orderId: 'ord-4',
        collectedAmount: 0,
        proof: {
          photoDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
          capturedAt: '2026-10-28T09:00:00.000Z',
        },
      }),
      task({ id: 'e', kind: 'pickup', status: 'completed', collectedAmount: 0 }),
      task({ id: 'f', status: 'failed' }),
    ];
    const orders = [
      order({ id: 'ord-1', remainingBalance: 1000 }),
      order({ id: 'ord-2', remainingBalance: 1500 }),
      order({ id: 'ord-3', remainingBalance: 0 }),
    ];

    expect(summarizeCourierTour(stops, orders)).toEqual({
      total: 6,
      pending: 1,
      enRoute: 1,
      done: 3,
      failed: 1,
      collectedXof: 2500,
      dueXof: 2500,
      proofs: 1,
    });
  });

  it('reste à zéro sur une tournée vide', () => {
    expect(summarizeCourierTour([])).toMatchObject({ total: 0, collectedXof: 0, proofs: 0 });
  });
});
