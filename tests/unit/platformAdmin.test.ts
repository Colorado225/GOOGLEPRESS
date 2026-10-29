import { describe, expect, it } from 'vitest';
import {
  filterPlatformAdminOrganizations,
  getPlatformAdminMetrics,
  parsePlatformAdminSnapshot,
  parsePlatformPublicConfig,
  type PlatformAdminSnapshot,
} from '../../src/lib/platformAdmin';

const snapshot: PlatformAdminSnapshot = {
  config: {
    registrations_open: true,
    support_message: '',
    support_message_tone: 'info',
    updated_at: null,
  },
  organizations: [
    {
      id: 'org-harmonie',
      name: 'Pressing Harmonie',
      slug: 'harmonie',
      status: 'active',
      created_at: '2026-10-01T09:00:00Z',
      owner: { user_id: 'owner-1', display_name: 'Awa Koné', email: 'awa@example.test' },
      shops: [
        {
          id: 'shop-1',
          name: 'Harmonie Cocody',
          slug: 'cocody',
          status: 'active',
          city: 'Abidjan',
          phone_display: null,
          email: null,
          subscription: {
            plan: 'free',
            status: 'essai',
            requested_plan: 'pro',
            requested_at: '2026-10-28T09:00:00Z',
            trial_started_at: '2026-10-01T09:00:00Z',
            renews_on: null,
          },
        },
      ],
      support_notes: [],
    },
    {
      id: 'org-emeraude',
      name: 'Buanderie Émeraude',
      slug: 'emeraude',
      status: 'suspended',
      created_at: '2026-09-01T09:00:00Z',
      owner: null,
      shops: [],
      support_notes: [],
    },
  ],
};

describe('parsePlatformAdminSnapshot', () => {
  it('valide les comptes, agences et demandes sans données métier', () => {
    const parsed = parsePlatformAdminSnapshot(snapshot);
    expect(parsed.organizations).toHaveLength(2);
    expect(parsed.organizations[0].shops[0].subscription.requested_plan).toBe('pro');
    expect(parsed.organizations[1].owner).toBeNull();
    expect(parsed.organizations[0]).not.toHaveProperty('orders');
  });

  it('refuse une formule ou une structure inconnue', () => {
    const invalid = structuredClone(snapshot);
    invalid.organizations[0].shops[0].subscription.plan = 'platinum' as never;
    expect(() => parsePlatformAdminSnapshot(invalid)).toThrow(/champ plan/i);
    expect(() => parsePlatformAdminSnapshot({ config: snapshot.config })).toThrow(
      /organizations/i
    );
  });

  it('valide strictement la configuration publique', () => {
    expect(parsePlatformPublicConfig(snapshot.config).registrations_open).toBe(true);
    expect(parsePlatformPublicConfig(snapshot.config).maintenance_mode).toBe(false);
    expect(
      parsePlatformPublicConfig({
        ...snapshot.config,
        support_message: 'Intervention ciblée',
        maintenance_mode: true,
        campaign_id: 'campaign-1',
      }).maintenance_mode
    ).toBe(true);
    expect(() =>
      parsePlatformPublicConfig({ ...snapshot.config, support_message_tone: 'urgent' })
    ).toThrow(/support_message_tone/i);
  });
});

describe('recherche et synthèse des comptes clients', () => {
  it('compte organisations, agences, demandes et verrouillages', () => {
    expect(getPlatformAdminMetrics(snapshot.organizations)).toEqual({
      organizations: 2,
      shops: 1,
      active: 1,
      suspended: 1,
      pending: 1,
    });
  });

  it('recherche sans tenir compte des accents et filtre les demandes', () => {
    expect(
      filterPlatformAdminOrganizations(snapshot.organizations, 'awa kone', 'all').map(
        (organization) => organization.id
      )
    ).toEqual(['org-harmonie']);
    expect(
      filterPlatformAdminOrganizations(snapshot.organizations, 'emeraude', 'suspended')
    ).toHaveLength(1);
    expect(
      filterPlatformAdminOrganizations(snapshot.organizations, '', 'pending').map(
        (organization) => organization.id
      )
    ).toEqual(['org-harmonie']);
  });
});
