import { describe, expect, it } from 'vitest';
import {
  formatStaffRole,
  getActiveStaffMemberships,
  hasActiveStaffMembership,
  resolveStaffAccessMode,
} from '../../src/lib/staffAccess';
import type { RemoteMembership } from '../../src/lib/supabaseOrders';

const membership = (
  overrides: Partial<RemoteMembership> = {}
): RemoteMembership => ({
  id: 'membership-1',
  organization_id: 'org-1',
  shop_id: 'shop-1',
  role: 'cashier',
  status: 'active',
  ...overrides,
});

describe('staffAccess', () => {
  it('exige Supabase en production configurée', () => {
    expect(
      resolveStaffAccessMode({
        supabaseConfigured: true,
        isDevelopment: false,
        allowLocalDemo: false,
      })
    ).toBe('supabase-required');
  });

  it('refuse d’ouvrir implicitement la démonstration en production non configurée', () => {
    expect(
      resolveStaffAccessMode({
        supabaseConfigured: false,
        isDevelopment: false,
        allowLocalDemo: false,
      })
    ).toBe('configuration-required');
  });

  it('autorise uniquement les démonstrations locales explicites ou le développement', () => {
    expect(
      resolveStaffAccessMode({
        supabaseConfigured: false,
        isDevelopment: true,
        allowLocalDemo: false,
      })
    ).toBe('explicit-local-demo');
    expect(
      resolveStaffAccessMode({
        supabaseConfigured: true,
        isDevelopment: false,
        allowLocalDemo: true,
      })
    ).toBe('explicit-local-demo');
  });

  it('ne retient que les memberships actifs avec un rôle personnel connu', () => {
    const memberships = [
      membership(),
      membership({ id: 'disabled', status: 'disabled' }),
      membership({ id: 'invited', status: 'invited' }),
      membership({ id: 'unknown', role: 'customer' }),
    ];

    expect(getActiveStaffMemberships(memberships).map((item) => item.id)).toEqual([
      'membership-1',
    ]);
    expect(hasActiveStaffMembership(memberships)).toBe(true);
    expect(hasActiveStaffMembership([])).toBe(false);
  });

  it('affiche les rôles du personnel en français', () => {
    expect(formatStaffRole('organization_owner')).toBe('Propriétaire');
    expect(formatStaffRole('shop_manager')).toBe('Responsable d’agence');
    expect(formatStaffRole('cashier')).toBe('Caisse / réception');
    expect(formatStaffRole('workshop')).toBe('Atelier');
    expect(formatStaffRole('courier')).toBe('Coursier');
  });
});
