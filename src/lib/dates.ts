import type { PickupOption } from '../types';

/**
 * Utilitaires de dates — PressingPro CI.
 *
 * Toutes les dates affichées / enregistrées par l'application doivent passer
 * par ce module afin de ne plus jamais coder de date en dur dans les écrans.
 * Format de stockage historique conservé (chaînes fr-FR) pour compatibilité
 * avec les données déjà présentes dans le localStorage des utilisateurs.
 */

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const capitalize = (s: string): string =>
  s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/** "27/10/2026" */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** "10:15" */
export function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** "10h15" (ou "17h" si minutes = 0 et trimMinutes = true) */
export function formatTimeFr(date: Date, trimMinutes = false): string {
  const h = date.getHours();
  const m = date.getMinutes();
  if (trimMinutes && m === 0) return `${h}h`;
  return `${h}h${pad2(m)}`;
}

/** "27/10/2026 10:15" — format des horodatages stockés sur les commandes */
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/** Horodatage courant au format de stockage des commandes. */
export function nowDateTime(): string {
  return formatDateTime(new Date());
}

/**
 * Parse un horodatage stocké ("27/10/2026 10:15") ou ISO.
 * Retourne null si la valeur est absente ou illisible, au lieu d'inventer une date.
 */
export function parseStoredDateTime(value: string | undefined | null): Date | null {
  if (!value) return null;
  const fr = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (fr) {
    const d = new Date(
      Number(fr[3]),
      Number(fr[2]) - 1,
      Number(fr[1]),
      Number(fr[4] ?? 12),
      Number(fr[5] ?? 0),
      0,
      0
    );
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(value);
  return isNaN(iso.getTime()) ? null : iso;
}

/** "27 oct. 2026" */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** "mardi 27 octobre 2026" (minuscule initiale, à capitaliser si besoin) */
export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** "27 oct. 2026 à 10h15" */
export function formatLongDateTime(date: Date): string {
  return `${formatShortDate(date)} à ${formatTimeFr(date)}`;
}

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Libellé court d'une date de retrait promise :
 * "Aujourd’hui • 15h", "Demain • 12h", "Mer. 28 • 17h"…
 */
export function formatPromised(date: Date, from: Date = new Date()): string {
  const time = formatTimeFr(date, true);
  if (isSameDay(date, from)) return `Aujourd’hui • ${time}`;
  const tomorrow = new Date(from);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(date, tomorrow)) return `Demain • ${time}`;
  const weekday = capitalize(
    new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date)
  );
  return `${weekday} ${date.getDate()} • ${time}`;
}

/** "Mercredi 28 oct. • 17h00" */
export function formatPromisedLong(date: Date): string {
  const weekday = capitalize(
    new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(date)
  );
  const dayMonth = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(date);
  return `${weekday} ${dayMonth} • ${formatTimeFr(date)}`;
}

/** Date à J+offset (négatif = passé), à l'heure indiquée. Sert aussi aux données de démo. */
export function daysFromToday(offsetDays: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Prochain samedi (strictement après aujourd'hui) à l'heure indiquée. */
export function nextSaturday(from: Date = new Date(), hour = 10): Date {
  const d = new Date(from);
  const delta = ((6 - d.getDay()) + 7) % 7 || 7; // 6 = samedi
  d.setDate(d.getDate() + delta);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * Règle métier unique des délais de retrait :
 * - express  : lendemain 12h
 * - standard : J+2 à 17h (48 h)
 * - delayed  : prochain samedi 10h
 */
export function getPromisedDate(option: PickupOption, from: Date = new Date()): Date {
  switch (option) {
    case 'express': {
      const d = new Date(from);
      d.setDate(d.getDate() + 1);
      d.setHours(12, 0, 0, 0);
      return d;
    }
    case 'delayed':
      return nextSaturday(from, 10);
    case 'standard':
    default: {
      const d = new Date(from);
      d.setDate(d.getDate() + 2);
      d.setHours(17, 0, 0, 0);
      return d;
    }
  }
}

export function getPickupLabel(option: PickupOption): string {
  switch (option) {
    case 'express':
      return 'Express 24h';
    case 'delayed':
      return 'Différé — samedi';
    case 'standard':
    default:
      return 'Standard 48h';
  }
}

/* ============================================================================
 * Dates ISO (YYYY-MM-DD) — utilisées par les modules Personnel, Stocks et
 * Dépenses pour des comparaisons et des regroupements fiables.
 * Les chaînes ISO se comparent lexicographiquement (= chronologiquement).
 * ========================================================================== */

/** Date locale → "2026-10-27" (sans décalage UTC). */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** "2026-10-27" → Date locale (midi, pour éviter tout effet de fuseau). Null si invalide. */
export function parseISODate(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

export function isValidISODate(iso: string | undefined | null): boolean {
  return parseISODate(iso) !== null;
}

/** Affiche une date ISO en français : "27/10/2026" (défaut) ou "27 oct. 2026". */
export function formatISODateFr(iso: string | undefined | null, short = false): string {
  const d = parseISODate(iso);
  if (!d) return 'Non renseigné';
  return short ? formatShortDate(d) : formatDate(d);
}

/** "mardi 27 octobre 2026" depuis une date ISO. */
export function formatISODateLongFr(iso: string | undefined | null): string {
  const d = parseISODate(iso);
  if (!d) return 'Non renseigné';
  return formatLongDate(d);
}

export function addDaysToISO(iso: string, days: number): string {
  const d = parseISODate(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Date ISO à J+offset par rapport à aujourd'hui (données de démo relatives). */
export function isoDaysFromToday(offsetDays: number): string {
  return addDaysToISO(todayISO(), offsetDays);
}

/** Horodatage ISO complet (createdAt / updatedAt des nouveaux modules). */
export function nowISODateTime(): string {
  return new Date().toISOString();
}
