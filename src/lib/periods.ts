import { addDaysToISO, formatISODateFr, parseISODate, todayISO, toISODate } from './dates';

/**
 * Périodes prédéfinies partagées par Dépenses et Rapports.
 * Toutes les bornes sont des dates ISO (YYYY-MM-DD), incluses.
 * Définitions : "Cette semaine" = lundi de la semaine en cours → aujourd'hui ;
 * "Ce mois" = 1er du mois → aujourd'hui (jamais de dates futures).
 */

export type PeriodPreset = 'today' | 'week' | 'month' | 'custom';

export interface DateRange {
  startISO: string;
  endISO: string;
}

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
  custom: 'Personnalisée',
};

export function getPeriodRange(
  preset: PeriodPreset,
  customStart?: string,
  customEnd?: string
): DateRange {
  const today = todayISO();
  switch (preset) {
    case 'today':
      return { startISO: today, endISO: today };
    case 'week': {
      const d = parseISODate(today) ?? new Date();
      const dayOfWeek = (d.getDay() + 6) % 7; // 0 = lundi
      d.setDate(d.getDate() - dayOfWeek);
      return { startISO: toISODate(d), endISO: today };
    }
    case 'month': {
      const d = parseISODate(today) ?? new Date();
      d.setDate(1);
      return { startISO: toISODate(d), endISO: today };
    }
    case 'custom':
    default: {
      const start = customStart && parseISODate(customStart) ? customStart : today;
      const end = customEnd && parseISODate(customEnd) ? customEnd : today;
      return start <= end ? { startISO: start, endISO: end } : { startISO: end, endISO: start };
    }
  }
}

/** Période précédente de même durée, immédiatement avant (comparaisons honnêtes). */
export function getPreviousPeriodRange(range: DateRange): DateRange {
  const start = parseISODate(range.startISO);
  const end = parseISODate(range.endISO);
  if (!start || !end) return range;
  const lengthDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const prevEnd = addDaysToISO(range.startISO, -1);
  const prevStart = addDaysToISO(prevEnd, -(lengthDays - 1));
  return { startISO: prevStart, endISO: prevEnd };
}

export function isISOInRange(iso: string | undefined | null, range: DateRange): boolean {
  if (!iso) return false;
  const day = iso.slice(0, 10);
  return day >= range.startISO && day <= range.endISO;
}

/** Liste des jours ISO de la période (plafonnée à 366 pour les graphiques). */
export function enumerateDaysISO(range: DateRange): string[] {
  const days: string[] = [];
  let cursor = range.startISO;
  while (cursor <= range.endISO && days.length < 366) {
    days.push(cursor);
    cursor = addDaysToISO(cursor, 1);
  }
  return days;
}

/** "Période : 01/10/2026 → 27/10/2026" / "Période : 27/10/2026". */
export function formatRangeLabel(range: DateRange): string {
  if (range.startISO === range.endISO) return formatISODateFr(range.startISO);
  return `${formatISODateFr(range.startISO)} → ${formatISODateFr(range.endISO)}`;
}
