import type { LogisticsTask } from '../types';

/**
 * Liens de navigation vers une adresse de tournée.
 *
 * Phase 0 du suivi GPS : aucune coordonnée n'est encore stockée, donc
 * l'itinéraire part de l'adresse en texte libre. On ouvre l'application de
 * cartes du téléphone (Google Maps ou Waze) plutôt que d'intégrer une carte :
 * rien à télécharger, rien à payer, et le coursier retrouve ses habitudes.
 *
 * Le nettoyage est volontaire : l'adresse est saisie librement par l'équipe,
 * elle peut contenir des retours à la ligne ou des caractères de contrôle.
 */

export interface DeliveryItineraryLinks {
  googleMaps: string;
  waze: string;
}

const MAX_ADDRESS_LENGTH = 300;

/** Adresse utilisable pour une navigation, ou `null` si elle est vide. */
export const sanitizeItineraryAddress = (
  task: Pick<LogisticsTask, 'address' | 'addressDetails'>
): string | null => {
  const joined = `${task.address ?? ''} ${task.addressDetails ?? ''}`
    // Caractères de contrôle (dont retours à la ligne) → espace.
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!joined) return null;
  return joined.slice(0, MAX_ADDRESS_LENGTH);
};

/**
 * Deux liens équivalents : Google Maps pour l'itinéraire, Waze pour les
 * coursiers qui l'utilisent. Aucune clé d'API n'est nécessaire.
 */
export const buildDeliveryItinerary = (
  task: Pick<LogisticsTask, 'address' | 'addressDetails'>
): DeliveryItineraryLinks | null => {
  const address = sanitizeItineraryAddress(task);
  if (!address) return null;
  const query = encodeURIComponent(address);
  return {
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    waze: `https://waze.com/ul?q=${query}&navigate=yes`,
  };
};
