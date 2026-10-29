import type { GeoPoint } from '../types';
import { haversineKm, normalizeGeoPoint } from './geo';

/**
 * Dernière position connue de chaque tournée.
 *
 * Choix assumé : **une seule position par tournée**, la plus récente. Un
 * historique complet n'apporte rien à l'heure d'arrivée et alourdit le
 * stockage local ; en cas de litige, la preuve de remise horodatée est la
 * pièce utile, pas la trace du trajet.
 *
 * Les positions sont volatiles : purge automatique après quelques jours, et
 * jamais envoyées à un serveur (aucune synchronisation Supabase pour l'instant).
 */

export const COURIER_POSITIONS_STORAGE_KEY = 'pressingpro_courier_positions';

/** Durée de conservation locale d'une position. */
export const POSITION_RETENTION_DAYS = 7;

/** Fréquence minimale entre deux enregistrements automatiques. */
export const POSITION_MIN_INTERVAL_SECONDS = 45;

/** Déplacement minimal justifiant un nouvel enregistrement. */
export const POSITION_MIN_DISTANCE_M = 50;

export interface CourierPosition extends GeoPoint {
  taskId: string;
}

export type CourierPositions = Record<string, CourierPosition>;

/** Relit le stockage local en écartant les positions inexploitables. */
export const normalizeCourierPositions = (value: unknown): CourierPositions => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const positions: CourierPositions = {};
  for (const [taskId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!taskId) continue;
    const point = normalizeGeoPoint(raw);
    if (point) positions[taskId] = { ...point, taskId };
  }
  return positions;
};

/** Retire les positions plus anciennes que la durée de conservation. */
export const pruneCourierPositions = (
  positions: CourierPositions,
  now: Date,
  retentionDays: number = POSITION_RETENTION_DAYS
): CourierPositions => {
  const retentionMs = Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;
  const kept: CourierPositions = {};
  for (const [taskId, position] of Object.entries(positions)) {
    const recorded = new Date(position.recordedAt).getTime();
    if (Number.isNaN(recorded)) continue;
    if (now.getTime() - recorded <= retentionMs) kept[taskId] = position;
  }
  return kept;
};

/**
 * Faut-il enregistrer cette nouvelle mesure ?
 *
 * On évite d'écrire à chaque seconde : soit l'intervalle minimal est écoulé,
 * soit le coursier a réellement bougé. Cela économise la batterie et les
 * données mobiles, sans perdre le fil de la tournée.
 */
export const shouldRecordPosition = (
  previous: CourierPosition | undefined,
  next: Pick<GeoPoint, 'lat' | 'lng' | 'recordedAt'>,
  options: { minIntervalSeconds?: number; minDistanceM?: number } = {}
): boolean => {
  if (!previous) return true;
  const minIntervalSeconds = options.minIntervalSeconds ?? POSITION_MIN_INTERVAL_SECONDS;
  const minDistanceM = options.minDistanceM ?? POSITION_MIN_DISTANCE_M;

  const previousAt = new Date(previous.recordedAt).getTime();
  const nextAt = new Date(next.recordedAt).getTime();
  if (Number.isNaN(previousAt) || Number.isNaN(nextAt)) return true;
  if ((nextAt - previousAt) / 1000 >= minIntervalSeconds) return true;

  return haversineKm(previous, next) * 1000 >= minDistanceM;
};
