import type { DeliveryGpsSettings, GeoPoint } from '../types';

/**
 * Géographie et estimation d'arrivée — règles pures.
 *
 * Aucune dépendance à Leaflet ni au navigateur ici : les calculs se testent en
 * Vitest, et les composants ne font qu'afficher. L'heure d'arrivée est
 * volontairement annoncée **en fourchette** : une distance à vol d'oiseau et une
 * vitesse moyenne ne justifient pas une heure précise.
 */

/** Centre de départ de la carte : Abidjan (Plateau). */
export const ABIDJAN_CENTER = { lat: 5.3599, lng: -4.0083 } as const;

/** Zoom par défaut de la carte des tournées. */
export const DEFAULT_MAP_ZOOM = 12;

/** Au-delà de cette précision, la position est dite approximative. */
export const ACCURACY_WARNING_M = 150;

/** Temps d'arrêt moyen par client, pour les arrêts restants de la tournée. */
export const DEFAULT_STOP_MINUTES = 8;

export const DEFAULT_DELIVERY_GPS_SETTINGS: DeliveryGpsSettings = {
  enabled: true,
  // Le suivi n'est jamais activé à l'insu du coursier : c'est lui qui appuie
  // sur « Partager ma position ».
  trackPositions: false,
  avgSpeedKmh: 18,
  detourFactor: 1.3,
  maxAgeSeconds: 180,
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

/** Lecture tolérante des réglages GPS stockés localement. */
export const normalizeDeliveryGpsSettings = (
  value?: Partial<DeliveryGpsSettings> | null
): DeliveryGpsSettings => ({
  enabled: value?.enabled !== false,
  trackPositions: value?.trackPositions === true,
  avgSpeedKmh: clampNumber(value?.avgSpeedKmh, 5, 60, DEFAULT_DELIVERY_GPS_SETTINGS.avgSpeedKmh),
  detourFactor: clampNumber(value?.detourFactor, 1, 2.5, DEFAULT_DELIVERY_GPS_SETTINGS.detourFactor),
  maxAgeSeconds: Math.round(
    clampNumber(value?.maxAgeSeconds, 30, 3600, DEFAULT_DELIVERY_GPS_SETTINGS.maxAgeSeconds)
  ),
});

/** Un couple latitude/longitude exploitable. */
export const isValidLatLng = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180 &&
  // 0,0 est presque toujours une donnée manquante déguisée (océan Atlantique).
  !(lat === 0 && lng === 0);

/** Relit un point stocké (destination ou position) sans jamais l'inventer. */
export const normalizeGeoPoint = (value: unknown): GeoPoint | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (!isValidLatLng(raw.lat, raw.lng)) return undefined;
  const recordedAt = typeof raw.recordedAt === 'string' ? raw.recordedAt : '';
  if (!recordedAt || Number.isNaN(new Date(recordedAt).getTime())) return undefined;
  const accuracyM =
    typeof raw.accuracyM === 'number' && Number.isFinite(raw.accuracyM) && raw.accuracyM >= 0
      ? Math.round(raw.accuracyM)
      : undefined;
  return {
    lat: raw.lat as number,
    lng: raw.lng as number,
    accuracyM,
    source: raw.source === 'device' ? 'device' : 'manual',
    recordedAt,
  };
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Distance à vol d'oiseau entre deux points, en kilomètres. */
export const haversineKm = (
  a: Pick<GeoPoint, 'lat' | 'lng'>,
  b: Pick<GeoPoint, 'lat' | 'lng'>
): number => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** La position est-elle encore utilisable à l'instant donné ? */
export const isPositionFresh = (
  position: Pick<GeoPoint, 'recordedAt'>,
  now: Date,
  maxAgeSeconds: number
): boolean => {
  const recorded = new Date(position.recordedAt).getTime();
  if (Number.isNaN(recorded)) return false;
  const ageSeconds = (now.getTime() - recorded) / 1000;
  if (ageSeconds < -60) return false; // horodatage dans le futur : donnée douteuse
  return ageSeconds <= maxAgeSeconds;
};

/** Âge d'une position en minutes arrondies, pour l'affichage. */
export const getPositionAgeMinutes = (
  position: Pick<GeoPoint, 'recordedAt'>,
  now: Date
): number => {
  const recorded = new Date(position.recordedAt).getTime();
  if (Number.isNaN(recorded)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((now.getTime() - recorded) / 60_000));
};

export interface ArrivalEstimate {
  /** Distance estimée, détour compris. */
  distanceKm: number;
  /** Délai estimé au centre de la fourchette, en minutes. */
  delayMinutes: number;
  earliest: string; // ISO
  latest: string; // ISO
  /** Précision dégradée : la fourchette s'élargit. */
  approximate: boolean;
  /** Nombre d'arrêts restants pris en compte. */
  remainingStops: number;
}

/**
 * Estimation d'arrivée. Renvoie `null` si la position est trop ancienne ou si
 * l'un des points est inutilisable : mieux vaut aucune heure qu'une heure fausse.
 */
export const estimateArrival = (input: {
  position: GeoPoint;
  destination: GeoPoint;
  now: Date;
  settings: DeliveryGpsSettings;
  /** Arrêts du même coursier avant celui-ci. */
  remainingStops?: number;
  stopMinutes?: number;
}): ArrivalEstimate | null => {
  const { position, destination, now, settings } = input;
  if (!isValidLatLng(position.lat, position.lng) || !isValidLatLng(destination.lat, destination.lng)) {
    return null;
  }
  if (!isPositionFresh(position, now, settings.maxAgeSeconds)) return null;

  const distanceKm = haversineKm(position, destination) * settings.detourFactor;
  const remainingStops = Math.max(0, Math.round(input.remainingStops ?? 0));
  const stopMinutes = Math.max(0, Math.round(input.stopMinutes ?? DEFAULT_STOP_MINUTES));
  const driveMinutes = (distanceKm / settings.avgSpeedKmh) * 60;
  const delayMinutes = Math.max(1, Math.round(driveMinutes + remainingStops * stopMinutes));

  const approximate = (position.accuracyM ?? 0) > ACCURACY_WARNING_M;
  const marginBefore = approximate ? 15 : 10;
  const marginAfter = approximate ? 25 : 15;
  const addMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

  return {
    distanceKm,
    delayMinutes,
    earliest: addMinutes(Math.max(1, delayMinutes - marginBefore)),
    latest: addMinutes(delayMinutes + marginAfter),
    approximate,
    remainingStops,
  };
};

/** Distance lisible : « 850 m » en dessous du kilomètre, « 3,4 km » au-delà. */
export const formatDistanceKm = (km: number): string => {
  if (!Number.isFinite(km) || km < 0) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
};

/** Fourchette horaire française : « 14 h 32 – 14 h 55 ». */
export const formatEtaWindow = (earliest: string, latest: string): string => {
  const format = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}`;
  };
  return `${format(earliest)} – ${format(latest)}`;
};

/** Age lisible : « il y a 40 s », « il y a 6 min ». */
export const formatPositionAge = (position: Pick<GeoPoint, 'recordedAt'>, now: Date): string => {
  const recorded = new Date(position.recordedAt).getTime();
  if (Number.isNaN(recorded)) return 'horodatage inconnu';
  const seconds = Math.max(0, Math.round((now.getTime() - recorded) / 1000));
  if (seconds < 90) return `il y a ${seconds} s`;
  return `il y a ${Math.round(seconds / 60)} min`;
};
