import { describe, expect, it } from 'vitest';
import {
  buildShopSettingsRow,
  describeShopSettingsSyncError,
  readRemoteShopSettings,
} from '../../src/lib/shopSettingsSync';
import { DEFAULT_SHOP_SETTINGS, mergeShopSettings } from '../../src/lib/shopSettings';

const settings = {
  ...DEFAULT_SHOP_SETTINGS,
  name: 'Pressing Éclat',
  tagline: 'Soin du linge',
  address: 'Cocody',
  phone: '+225 07 00 00 00 00',
  pickupFee: 1500,
  deliveryFee: -200,
};

describe('buildShopSettingsRow', () => {
  it('écrit l’instantané complet et les colonnes historiques', () => {
    const row = buildShopSettingsRow({
      shopId: 'shop-1',
      organizationId: 'org-1',
      settings,
    });

    expect(row.shop_id).toBe('shop-1');
    expect(row.organization_id).toBe('org-1');
    expect(row.tagline).toBe('Soin du linge');
    expect(row.pickup_fee_xof).toBe(1500);
    // Un montant négatif ne doit jamais partir en base (contrainte >= 0).
    expect(row.delivery_fee_xof).toBe(0);
    expect(row.settings).toMatchObject({ name: 'Pressing Éclat', pickupFee: 1500 });
  });
});

describe('readRemoteShopSettings', () => {
  it('privilégie l’instantané JSON et signale sa présence', () => {
    const snapshot = readRemoteShopSettings({
      tagline: 'colonne',
      pickup_fee_xof: 900,
      settings: { tagline: 'instantané', pickupFee: 1200 },
      settings_updated_at: '2026-10-28T10:00:00.000Z',
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot?.hasSnapshot).toBe(true);
    expect(snapshot?.settings.tagline).toBe('instantané');
    expect(snapshot?.settings.pickupFee).toBe(1200);
    expect(snapshot?.updatedAt).toBe('2026-10-28T10:00:00.000Z');
  });

  it('retombe sur les colonnes pour une ligne antérieure à l’instantané', () => {
    const snapshot = readRemoteShopSettings({
      tagline: '',
      enable_sms: true,
      pickup_fee_xof: 800,
      delivery_fee_xof: 1200,
      storage_default_capacity_packages: 12,
      settings: {},
    });

    expect(snapshot?.hasSnapshot).toBe(false);
    expect(snapshot?.settings).toMatchObject({
      enableSms: true,
      pickupFee: 800,
      deliveryFee: 1200,
      storageDefaultCapacityPackages: 12,
    });
  });

  it('ignore une valeur qui n’est pas une ligne', () => {
    expect(readRemoteShopSettings(null)).toBeNull();
    expect(readRemoteShopSettings('ligne')).toBeNull();
  });
});

describe('mergeShopSettings', () => {
  it('n’écrase rien quand la sauvegarde est vide', () => {
    const base = { ...DEFAULT_SHOP_SETTINGS, name: 'Pressing Éclat' };
    expect(mergeShopSettings(base, {})).toEqual(base);
    expect(mergeShopSettings(base, null)).toEqual(base);
  });

  it('nettoie les valeurs douteuses sans perdre les réglages valides', () => {
    const merged = mergeShopSettings(DEFAULT_SHOP_SETTINGS, {
      name: '   ',
      logoDataUrl: 'javascript:alert(1)',
      pickupFee: -1500,
      storageDefaultCapacityPackages: 0,
      enableSms: 'oui' as unknown as boolean,
      blanchisserie: {
        ...DEFAULT_SHOP_SETTINGS.blanchisserie,
        tiers: [],
      },
    });

    // Nom vide : celui du serveur est conservé.
    expect(merged.name).toBe(DEFAULT_SHOP_SETTINGS.name);
    expect(merged.logoDataUrl).toBeNull();
    expect(merged.pickupFee).toBe(0);
    expect(merged.storageDefaultCapacityPackages).toBe(
      DEFAULT_SHOP_SETTINGS.storageDefaultCapacityPackages
    );
    expect(merged.enableSms).toBe(DEFAULT_SHOP_SETTINGS.enableSms);
    expect(merged.blanchisserie.tiers).toEqual([]);
  });
});

describe('describeShopSettingsSyncError', () => {
  it('traduit les refus de rôle et les coupures réseau', () => {
    expect(describeShopSettingsSyncError({ code: '42501', message: 'denied' })).toContain(
      'Votre rôle ne permet pas'
    );
    expect(
      describeShopSettingsSyncError(new Error('TypeError: Failed to fetch'))
    ).toContain('Serveur injoignable');
    expect(describeShopSettingsSyncError(new Error('boom'))).toBe('boom');
    expect(describeShopSettingsSyncError(null)).toBe(
      'Enregistrement sur le serveur impossible pour le moment.'
    );
  });
});
