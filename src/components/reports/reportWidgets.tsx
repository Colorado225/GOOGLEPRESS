import React from 'react';
import { enumerateDaysISO, DateRange } from '../../lib/periods';
import { formatISODateFr, todayISO } from '../../lib/dates';

/**
 * Widgets graphiques sobres des rapports (barres CSS, dans l'esprit du
 * graphique existant du tableau de bord). Les valeurs essentielles sont
 * toujours lisibles en texte — jamais uniquement au survol.
 */

export interface BarDatum {
  key: string;
  label: string;
  fullLabel: string;
  value: number;
  /** Libellé court affiché au-dessus de la barre (ex. "186k"). */
  valueLabel?: string;
}

/** Regroupe une série journalière : par jour, ou par semaine si la période dépasse 62 jours. */
export function buildDailySeries(
  range: DateRange,
  valueByISO: Map<string, number>,
  formatValue?: (v: number) => string
): BarDatum[] {
  const days = enumerateDaysISO(range);
  const fmt = formatValue ?? ((v: number) => (v > 0 ? `${Math.round(v / 1000)}k` : ''));
  if (days.length <= 62) {
    return days.map((d) => ({
      key: d,
      label: d.slice(8, 10),
      fullLabel: formatISODateFr(d),
      value: valueByISO.get(d) ?? 0,
      valueLabel: fmt(valueByISO.get(d) ?? 0),
    }));
  }
  const weeks: BarDatum[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    const value = slice.reduce((s, d) => s + (valueByISO.get(d) ?? 0), 0);
    weeks.push({
      key: slice[0],
      label: `${slice[0].slice(8, 10)}/${slice[0].slice(5, 7)}`,
      fullLabel: `Semaine du ${formatISODateFr(slice[0])}`,
      value,
      valueLabel: fmt(value),
    });
  }
  return weeks;
}

interface VerticalBarsProps {
  data: BarDatum[];
  ariaLabel: string;
  formatFullValue: (v: number) => string;
  emptyMessage: string;
}

export const VerticalBars: React.FC<VerticalBarsProps> = ({ data, ariaLabel, formatFullValue, emptyMessage }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
        {emptyMessage}
      </p>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1 sm:gap-1.5 h-[150px] pt-5" role="img" aria-label={ariaLabel}>
      {data.map((d) => (
        <div
          key={d.key}
          className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
          title={`${d.fullLabel} : ${formatFullValue(d.value)}`}
        >
          <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 tabular-nums">{d.valueLabel ?? ''}</span>
          <div
            className={`w-full rounded-t ${d.key === todayISO() ? 'bg-blue-600' : 'bg-zinc-800'}`}
            style={{ height: `${Math.max(d.value > 0 ? 4 : 1, (d.value / max) * 100)}%` }}
            aria-hidden="true"
          />
          <span className="text-[9.5px] text-zinc-400 dark:text-zinc-500 tabular-nums mt-1 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

interface HorizontalBarsProps {
  data: { label: string; value: number; display: string }[];
  emptyMessage: string;
}

export const HorizontalBars: React.FC<HorizontalBarsProps> = ({ data, emptyMessage }) => {
  if (data.length === 0) {
    return <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="text-[12px]">
          <div className="flex justify-between gap-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">{d.label}</span>
            <span className="tabular-nums text-zinc-900 dark:text-zinc-100 font-bold shrink-0">{d.display}</span>
          </div>
          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-1 overflow-hidden" aria-hidden="true">
            <div className="h-1.5 bg-zinc-800 rounded-full" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

interface ReportCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export const ReportCard: React.FC<ReportCardProps> = ({ title, subtitle, children, className = '' }) => (
  <div className={`bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-4 shadow-2xs ${className}`}>
    <h3 className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100">{title}</h3>
    {subtitle && <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-2">{subtitle}</p>}
    <div className={subtitle ? '' : 'mt-2'}>{children}</div>
  </div>
);
