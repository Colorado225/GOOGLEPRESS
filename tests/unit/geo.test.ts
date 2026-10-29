import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DELIVERY_GPS_SETTINGS,
  estimateArrival,
  formatDistanceKm,
  formatEtaWindow,
  formatPositionAge,
  getPositionAgeMinutes,
  haversineKm,
  isPositionFresh,
  isValidLatLng,
  normalizeDeliveryGpsSettings,
  normalizeGeoPoint,
} from '../../src/lib/geo';
import type { GeoPoint } from '../../src/types';

const NOW = new Date('2026-10-28T10:00:00.000Z');

const point = (overrides: Partial<GeoPoint> = {}): GeoPoint => ({
  lat: 5.36,
  lng: -4.0083,
  accuracyM: 12,
  source: 'device',
  recordedAt: '2026-10-28T09:59:30.000Z',
  ...overrides,
});

const destination = (overrides: Partial<GeoPoint> = {}): GeoPoint => ({
  lat: 5.37,
  lng: -4.0083,
  source: 'manual',
  recordedAt: '2026-10-27T08:00:00.000Z',
  ...overrides,
});

describe('geo — réglages', () => {
  it('applique des valeurs par défaut raisonnables', () => {
    expect(normalizeDeliveryGpsSettings(undefined)).toEqual(DEFAULT_DELIVERY_GPS_SETTINGS);
    expect(DEFAULT_DELIVERY_GPS_SETTINGS.trackPositions).toBe(false);
  });

  it('borne les réglages hors plage sans planter', () => {
    expect(
      normalizeDeliveryGpsSettings({ avgSpeedKmh: 2, detourFactor: 9, maxAgeSeconds: 5, enabled: false })
    ).toMatchObject({ avgSpeedKmh: 5, detourFactor: 2.5, maxAgeSeconds: 30, enabled: false });
    expect(normalizeDeliveryGpsSettings({ avgSpeedKmh: 200 }).avgSpeedKmh).toBe(60);
    expect(normalizeDeliveryGpsSettings({ trackPositions: 'oui' as unknown as boolean })).toMatchObject({
      trackPositions: false,
    });
  });
});

describe('geo — points', () => {
  it('rejette les coordonnées impossibles, dont 0,0', () => {
    expect(isValidLatLng(5.36, -4.0)).toBe(true);
    expect(isValidLatLng(0, 0)).toBe(false);
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(-181, 0)).toBe(false);
    expect(isValidLatLng(Number.NaN, 1)).toBe(false);
    expect(isValidLatLng('5' as unknown as number, 1)).toBe(false);
  });

  it('relit un point stocké et écarte les données douteuses', () => {
    expect(normalizeGeoPoint(point())).toMatchObject({ lat: 5.36, lng: -4.0083, source: 'device' });
    expect(normalizeGeoPoint({ ...point(), recordedAt: '' })).toBeUndefined();
    expect(normalizeGeoPoint({ ...point(), recordedAt: 'invalide' })).toBeUndefined();
    expect(normalizeGeoPoint({ lat: 0, lng: 0, recordedAt: NOW.toISOString() })).toBeUndefined();
    expect(normalizeGeoPoint(null)).toBeUndefined();

    const manual = normalizeGeoPoint({
      lat: 5.4,
      lng: -4.1,
      accuracyM: -5,
      source: 'autre',
      recordedAt: NOW.toISOString(),
    });
    expect(manual).toMatchObject({ source: 'manual' });
    expect(manual?.accuracyM).toBeUndefined();
  });
});

describe('geo — distance et fraîcheur', () => {
  it('calcule une distance à vol d’oiseau cohérente', () => {
    expect(haversineKm(point(), point())).toBeCloseTo(0, 5);
    // 0,01° de latitude ≈ 1,11 km.
    expect(haversineKm({ lat: 5.36, lng: -4.0083 }, { lat: 5.37, lng: -4.0083 })).toBeCloseTo(1.111, 2);
  });

  it('distingue une position fraîche d’une position périmée', () => {
    expect(isPositionFresh(point(), NOW, 180)).toBe(true);
    expect(isPositionFresh(point({ recordedAt: '2026-10-28T09:50:00.000Z' }), NOW, 180)).toBe(false);
    expect(isPositionFresh(point({ recordedAt: '2026-10-28T10:05:00.000Z' }), NOW, 180)).toBe(false);
    expect(isPositionFresh(point({ recordedAt: 'n’importe quoi' }), NOW, 180)).toBe(false);
    expect(getPositionAgeMinutes(point(), NOW)).toBe(1);
  });

  it('formate distance, fourchette et âge', () => {
    expect(formatDistanceKm(0.85)).toBe('850 m');
    expect(formatDistanceKm(3.42)).toBe('3,4 km');
    expect(formatDistanceKm(Number.NaN)).toBe('—');
    expect(formatEtaWindow('2026-10-28T10:20:00.000Z', '2026-10-28T10:45:00.000Z')).toMatch(
      /^\d{2} h \d{2} – \d{2} h \d{2}$/
    );
    expect(formatPositionAge(point(), NOW)).toBe('il y a 30 s');
    expect(formatPositionAge(point({ recordedAt: '2026-10-28T09:55:00.000Z' }), NOW)).toBe('il y a 5 min');
  });
});

describe('geo — heure d’arrivée estimée', () => {
  it('estime une fourchette à partir de la distance et de la vitesse', () => {
    const estimate = estimateArrival({
      position: point(),
      destination: destination(),
      now: NOW,
      settings: DEFAULT_DELIVERY_GPS_SETTINGS,
    });

    expect(estimate).not.toBeNull();
    // 1,111 km × 1,3 de détour = 1,44 km ; à 18 km/h ≈ 4,8 min → 5 min.
    expect(estimate?.distanceKm).toBeCloseTo(1.444, 2);
    expect(estimate?.delayMinutes).toBe(5);
    // Marge de 10 min avant, mais jamais dans le passé : au plus tôt maintenant + 1 min.
    expect(estimate?.earliest).toBe('2026-10-28T10:01:00.000Z');
    expect(estimate?.latest).toBe('2026-10-28T10:20:00.000Z');
    expect(estimate?.approximate).toBe(false);
  });

  it('ajoute les arrêts restants du coursier', () => {
    const estimate = estimateArrival({
      position: point(),
      destination: destination(),
      now: NOW,
      settings: DEFAULT_DELIVERY_GPS_SETTINGS,
      remainingStops: 3,
    });
    expect(estimate?.remainingStops).toBe(3);
    expect(estimate?.delayMinutes).toBe(29); // 5 min de route + 3 × 8 min
  });

  it('n’annonce aucune heure sur une position périmée ou des coordonnées invalides', () => {
    expect(
      estimateArrival({
        position: point({ recordedAt: '2026-10-28T09:40:00.000Z' }),
        destination: destination(),
        now: NOW,
        settings: DEFAULT_DELIVERY_GPS_SETTINGS,
      })
    ).toBeNull();

    expect(
      estimateArrival({
        position: point({ lat: 0, lng: 0 }),
        destination: destination(),
        now: NOW,
        settings: DEFAULT_DELIVERY_GPS_SETTINGS,
      })
    ).toBeNull();
  });

  it('élargit la fourchette quand la position est imprécise', () => {
    const estimate = estimateArrival({
      position: point({ accuracyM: 400 }),
      destination: destination(),
      now: NOW,
      settings: DEFAULT_DELIVERY_GPS_SETTINGS,
    });
    expect(estimate?.approximate).toBe(true);
    expect(estimate?.earliest).toBe('2026-10-28T10:01:00.000Z');
    expect(estimate?.latest).toBe('2026-10-28T10:30:00.000Z');
  });
});
