import React, { useState } from 'react';
import { REVENUE_7_DAYS, formatFCFA } from '../../data/demoData';

export const RevenueChart: React.FC = () => {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100 tracking-tight">
            Chiffre d'affaires — {viewMode === 'week' ? '7 derniers jours' : 'Mois en cours'}
          </h2>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Pressing + Blanchisserie • en FCFA</p>
        </div>
        <div className="flex gap-1.5 text-[11.5px]">
          <button
            onClick={() => setViewMode('week')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              viewMode === 'week'
                ? 'bg-black text-white shadow-2xs'
                : 'border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            Semaine
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'month'
                ? 'bg-black text-white shadow-2xs'
                : 'border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            Mois
          </button>
        </div>
      </div>

      {/* Chart Bars */}
      <div className="flex items-end gap-2 sm:gap-3 h-[155px] px-2 pt-4 relative">
        {REVENUE_7_DAYS.map((item) => {
          const isHovered = hoveredDay === item.day;
          return (
            <div
              key={item.day}
              onMouseEnter={() => setHoveredDay(item.day)}
              onMouseLeave={() => setHoveredDay(null)}
              className="flex-1 flex flex-col items-center gap-1 group cursor-pointer relative h-full justify-end"
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute -top-12 z-30 bg-[#09090b] text-white text-[11px] py-1 px-2.5 rounded-md whitespace-nowrap shadow-lg pointer-events-none">
                  <p className="font-bold">{item.date} : {formatFCFA(item.value)}</p>
                  {item.note && <p className="text-zinc-300 text-[10px]">{item.note}</p>}
                </div>
              )}

              {/* Amount label */}
              <span
                className={`text-[11px] font-semibold tabular-nums transition-colors ${
                  item.isPeak
                    ? 'text-blue-700 dark:text-blue-300 font-bold'
                    : item.isToday
                    ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100'
                }`}
              >
                {item.label}
              </span>

              {/* Bar */}
              <div
                style={{ height: `${item.heightPercent * 1.25}px` }}
                className={`w-full rounded-t-md transition-all duration-300 ${
                  item.isPeak
                    ? 'bg-blue-600 group-hover:bg-blue-700 shadow-sm'
                    : item.isToday
                    ? 'border-2 border-dashed border-zinc-800 bg-blue-50 dark:bg-blue-950 group-hover:bg-blue-100 dark:group-hover:bg-blue-900'
                    : item.day === 'Lun 26'
                    ? 'bg-zinc-800 group-hover:bg-zinc-900'
                    : 'bg-zinc-200 dark:bg-zinc-700 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600'
                }`}
              />

              {/* Day label */}
              <span
                className={`text-[11px] transition-colors ${
                  item.isPeak
                    ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                    : item.isToday
                    ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {item.day}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-[12px] text-zinc-600 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <i className="inline-block w-2.5 h-2.5 bg-blue-600 rounded-xs" />
          <span className="font-medium text-zinc-900 dark:text-zinc-100">Samedi pic</span> (mariages)
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block w-2.5 h-2.5 bg-zinc-800 rounded-xs" />
          <span className="font-medium text-zinc-900 dark:text-zinc-100">Pressing détail</span>
        </span>
        <span className="text-zinc-500 dark:text-zinc-400 truncate">
          Contrats hôtels : 640 000 FCFA / mois (Hôtel Ivoire, Seen Hôtel)
        </span>
      </div>
    </div>
  );
};
