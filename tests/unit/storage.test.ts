import { describe, expect, it } from 'vitest';
import {
  buildStorageLocationSeries,
  calculateStorageOccupancy,
  getSuggestedStorageLocation,
  getSuggestedStorageZone,
  isValidStorageCode,
  normalizeStorageCode,
  normalizeStorageLocations,
  sanitizePackageCount,
  wouldExceedKnownStorageCapacity,
} from '../../src/lib/storage';
import type { LaundryOrder, LogisticsTask, OrderLine, StorageLocation } from '../../src/types';

const line = (overrides: Partial<OrderLine> = {}): OrderLine => ({
  id: 'line-1',
  clothingItemId: 'item-1',
  name: 'Chemise',
  quantity: 1,
  unitPrice: 1000,
  subtotal: 1000,
  serviceType: 'wash_iron',
  ...overrides,
});

const order = (overrides: Partial<LaundryOrder> = {}): LaundryOrder =>
  ({
    id: 'order-1',
    status: 'ready',
    lines: [line()],
    fulfillmentMethod: 'counter_pickup',
    ...overrides,
  }) as LaundryOrder;

const location = (overrides: Partial<StorageLocation> = {}): StorageLocation => ({
  id: 'loc-1',
  code: 'A-01',
  label: 'Portant A',
  zone: 'hanging',
  capacityPackages: 10,
  isActive: true,
  ...overrides,
});

const task = (overrides: Partial<LogisticsTask> = {}): LogisticsTask =>
  ({
    id: 'task-1',
    kind: 'delivery',
    status: 'scheduled',
    scheduledDate: '2026-10-28',
    timeSlot: '10:00-12:00',
    createdAt: '2026-10-28T08:00:00.000Z',
    ...overrides,
  }) as LogisticsTask;

describe('storage', () => {
  it('normalise et valide les codes physiques', () => {
    expect(normalizeStorageCode(' b 01 ')).toBe('B-01');
    expect(isValidStorageCode('B-01')).toBe(true);
    expect(isValidStorageCode('B')).toBe(false);
    expect(isValidStorageCode('B--01')).toBe(false);
    expect(sanitizePackageCount('3')).toBe(3);
    expect(sanitizePackageCount(0)).toBeUndefined();
    expect(sanitizePackageCount(1.5)).toBeUndefined();
  });

  it('nettoie un plan relu sans conserver les doublons ni les entrées illisibles', () => {
    const normalized = normalizeStorageLocations(
      [
        { id: 'one', code: ' b 01 ', label: ' Bac 1 ', zone: 'valeur-inconnue', capacityPackages: 'x' },
        { id: 'two', code: 'B-01', label: 'Doublon' },
        { code: '!', label: 'Invalide' },
        null,
      ],
      []
    );

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      id: 'one',
      code: 'B-01',
      label: 'Bac 1',
      zone: 'other',
      capacityPackages: 20,
      isActive: true,
    });
  });

  it('génère une série complète ou rien en cas de doublon', () => {
    const input = {
      codePrefix: 'b',
      startNumber: 1,
      count: 3,
      labelTemplate: 'Casier {nn}',
      zone: 'folded' as const,
      capacityPackages: 12,
      isActive: true,
    };

    expect(buildStorageLocationSeries(input, []).locations.map((item) => item.code)).toEqual([
      'B-01',
      'B-02',
      'B-03',
    ]);

    const duplicate = buildStorageLocationSeries(input, [{ code: 'B-02' }]);
    expect(duplicate.locations).toEqual([]);
    expect(duplicate.error).toContain('B-02');
  });

  it('calcule l’occupation connue sans inventer les paquets absents', () => {
    const orders = [
      order({ id: 'known', storageLocationId: 'loc-1', storagePackageCount: 2 }),
      order({ id: 'unknown', storageLocationId: 'loc-1', storagePackageCount: undefined }),
      order({ id: 'out', storageLocationId: 'loc-1', storagePackageCount: 5 }),
      order({ id: 'delivered', status: 'delivered', storageLocationId: 'loc-1', storagePackageCount: 4 }),
    ];
    const tasks = [task({ status: 'en_route', orderId: 'out' })];

    expect(calculateStorageOccupancy(orders, tasks).get('loc-1')).toEqual({
      orderCount: 2,
      packageCount: 2,
      unknownPackageOrders: 1,
    });
  });

  it('détecte uniquement les dépassements certains de capacité', () => {
    const loc = location({ capacityPackages: 5 });
    const occupancy = { orderCount: 1, packageCount: 4, unknownPackageOrders: 2 };
    expect(wouldExceedKnownStorageCapacity(loc, occupancy, 1)).toBe(false);
    expect(wouldExceedKnownStorageCapacity(loc, occupancy, 2)).toBe(true);
    expect(wouldExceedKnownStorageCapacity(loc, occupancy, 0)).toBe(false);
  });

  it('suggère la zone selon volume, livraison puis pièces à suspendre', () => {
    expect(getSuggestedStorageZone(order({ lines: [line({ quantity: 25 })] }))).toBe('bulky');
    expect(getSuggestedStorageZone(order({ fulfillmentMethod: 'home_delivery' }))).toBe('delivery');
    expect(getSuggestedStorageZone(order({ lines: [line({ name: 'Costume 2 pièces' })] }))).toBe('hanging');
    expect(getSuggestedStorageZone(order({ lines: [line({ name: 'Serviettes' })] }))).toBe('folded');
  });

  it('préfère un emplacement adapté non saturé', () => {
    const saturated = location({ id: 'full', code: 'A-01', capacityPackages: 2 });
    const available = location({ id: 'free', code: 'A-02', capacityPackages: 10 });
    const occupancy = new Map([
      ['full', { orderCount: 1, packageCount: 2, unknownPackageOrders: 0 }],
      ['free', { orderCount: 0, packageCount: 0, unknownPackageOrders: 0 }],
    ]);

    expect(
      getSuggestedStorageLocation(
        order({ lines: [line({ name: 'Costume' })] }),
        [saturated, available],
        occupancy
      )?.id
    ).toBe('free');
  });
});
