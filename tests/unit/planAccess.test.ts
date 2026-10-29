import { describe, expect, it } from 'vitest';
import {
  PLAN_FEATURES,
  countOrdersInMonth,
  getPlanCapabilities,
  getQuotaUsage,
  guardEmployeeCount,
  guardMonthlyOrderCount,
  guardStorageLocationCount,
  isFeatureIncluded,
} from '../../src/lib/planAccess';

describe('planAccess — capacités par formule', () => {
  it('applique les plafonds de Free', () => {
    const caps = getPlanCapabilities('free');
    expect(caps.maxUsers).toBe(2);
    expect(caps.maxOrdersPerMonth).toBe(100);
    expect(caps.maxStorageLocations).toBe(10);
    expect(caps.maxShops).toBe(1);
    expect(Object.values(caps.features)).toEqual([false, false, false, false, false]);
  });

  it('ouvre les fonctions Pro sans plafond de commandes', () => {
    const caps = getPlanCapabilities('pro');
    expect(caps.maxUsers).toBe(8);
    expect(caps.maxOrdersPerMonth).toBeNull();
    expect(caps.maxStorageLocations).toBeNull();
    expect(caps.features.customerPortal).toBe(true);
    expect(caps.features.deliveryTracking).toBe(true);
    expect(caps.features.deliveryProof).toBe(true);
    expect(caps.features.detailedReports).toBe(true);
    // Le multi-agences reste réservé à Business.
    expect(caps.features.multiShop).toBe(false);
  });

  it('lève les plafonds d’utilisateurs en Business', () => {
    const caps = getPlanCapabilities('business');
    expect(caps.maxUsers).toBeNull();
    expect(caps.maxShops).toBe(3);
    expect(caps.features.multiShop).toBe(true);
  });

  it('retombe sur Free pour une formule inconnue', () => {
    // @ts-expect-error — valeur venue d'une sauvegarde douteuse
    expect(getPlanCapabilities('or').maxOrdersPerMonth).toBe(100);
  });

  it('réserve chaque fonction à une formule nommée', () => {
    expect(isFeatureIncluded('free', 'deliveryTracking')).toBe(false);
    expect(isFeatureIncluded('pro', 'deliveryTracking')).toBe(true);
    expect(PLAN_FEATURES.multiShop.requiredPlan).toBe('business');
    expect(PLAN_FEATURES.deliveryProof.requiredPlan).toBe('pro');
  });
});

describe('planAccess — casiers', () => {
  it('laisse Free créer jusqu’au 10e casier, puis refuse', () => {
    expect(guardStorageLocationCount(9, 1, 'free').allowed).toBe(true);
    const blocked = guardStorageLocationCount(10, 1, 'free');
    expect(blocked.allowed).toBe(false);
    expect(blocked.limit).toBe(10);
    expect(blocked.requiredPlan).toBe('pro');
    expect(blocked.message).toContain('10 emplacements');
  });

  it('compte une série en entier', () => {
    expect(guardStorageLocationCount(5, 5, 'free').allowed).toBe(true);
    expect(guardStorageLocationCount(6, 5, 'free').allowed).toBe(false);
  });

  it('ne limite pas Pro', () => {
    expect(guardStorageLocationCount(500, 50, 'pro').allowed).toBe(true);
  });
});

describe('planAccess — comptes d’équipe', () => {
  it('bloque au-delà de 2 comptes en Free', () => {
    expect(guardEmployeeCount(1, 'free').allowed).toBe(true);
    const blocked = guardEmployeeCount(2, 'free');
    expect(blocked.allowed).toBe(false);
    expect(blocked.limit).toBe(2);
    expect(blocked.requiredPlan).toBe('pro');
  });

  it('bloque au-delà de 8 comptes en Pro et renvoie vers Business', () => {
    expect(guardEmployeeCount(7, 'pro').allowed).toBe(true);
    const blocked = guardEmployeeCount(8, 'pro');
    expect(blocked.allowed).toBe(false);
    expect(blocked.requiredPlan).toBe('business');
  });

  it('ne limite pas Business', () => {
    expect(guardEmployeeCount(120, 'business').allowed).toBe(true);
  });
});

describe('planAccess — quota de commandes', () => {
  it('bloque la 101e commande du mois en Free', () => {
    expect(guardMonthlyOrderCount(99, 'free').allowed).toBe(true);
    const blocked = guardMonthlyOrderCount(100, 'free');
    expect(blocked.allowed).toBe(false);
    expect(blocked.limit).toBe(100);
    expect(blocked.message).toContain('100 commandes');
  });

  it('ne bloque jamais Pro ni Business', () => {
    expect(guardMonthlyOrderCount(10_000, 'pro').allowed).toBe(true);
    expect(guardMonthlyOrderCount(10_000, 'business').allowed).toBe(true);
  });

  it('compte les commandes du mois calendaire courant', () => {
    const reference = new Date(2026, 9, 29); // 29 octobre 2026
    const orders = [
      { receivedAt: '2026-10-01T08:00:00.000Z' },
      { receivedAt: '2026-10-29T09:30:00.000Z' },
      { receivedAt: '2026-09-30T23:00:00.000Z' },
      { receivedAt: undefined },
      { receivedAt: 'date invalide' },
    ];
    expect(countOrdersInMonth(orders, reference)).toBe(2);
  });
});

describe('planAccess — consommation des quotas', () => {
  it('calcule un pourcentage borné', () => {
    expect(getQuotaUsage(5, 10)).toBe(50);
    expect(getQuotaUsage(20, 10)).toBe(100);
    expect(getQuotaUsage(5, null)).toBeNull();
    expect(getQuotaUsage(1, 0)).toBe(100);
  });
});
