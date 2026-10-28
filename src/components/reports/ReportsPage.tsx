import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PageHeader, LocalDataNotice, PeriodFilter } from '../common/ModuleCommon';
import { Tabs } from '../common/Tabs';
import { ActivityReport } from './ActivityReport';
import { FinancialReport } from './FinancialReport';
import { EmployeeReport } from './EmployeeReport';
import { InventoryReport } from './InventoryReport';
import { formatFCFA } from '../../data/demoData';
import { formatLongDateTime, todayISO } from '../../lib/dates';
import { formatRangeLabel, getPeriodRange, isISOInRange, PeriodPreset } from '../../lib/periods';
import { getAlertProducts } from '../../lib/inventory';
import { orderReceivedISO } from '../../lib/reports';
import { printDocument } from '../../lib/print';
import { resolveShopDisplayName } from '../../lib/shopIdentity';
import { Activity, Wallet, Users, Boxes, ArrowLeft, Printer, ChevronRight } from 'lucide-react';

type ReportId = 'activity' | 'financial' | 'employees' | 'inventory';

const REPORT_TITLES: Record<ReportId, string> = {
  activity: 'Rapport d’activité',
  financial: 'Rapport financier',
  employees: 'Rapport du personnel',
  inventory: 'Rapport de stock',
};

/**
 * Centre des rapports. Chaque indicateur affiché est calculé depuis l'état
 * frontend visible (commandes, présences, stock, dépenses) — aucune série
 * fictive. L'impression passe par la boîte de dialogue du navigateur avec
 * une zone imprimable dédiée (#report-print-area, voir index.css).
 */
export const ReportsPage: React.FC = () => {
  const {
    setActiveScreen,
    orders,
    expenses,
    employees,
    attendanceRecords,
    products,
    shopSettings,
    workspace,
  } = useApp();
  const [activeReport, setActiveReport] = useState<ReportId | null>(null);
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const range = getPeriodRange(preset, customStart, customEnd);

  // Mini-indicateurs réels des cartes d'accès (période courante sélectionnée)
  const previews = useMemo(() => {
    const periodOrders = orders.filter((o) => {
      const iso = orderReceivedISO(o);
      return iso !== null && iso >= range.startISO && iso <= range.endISO;
    });
    const sales = periodOrders.reduce((s, o) => s + o.total, 0);
    const periodExpensesTotal = expenses
      .filter((e) => e.status === 'recorded' && isISOInRange(e.date, range))
      .reduce((s, e) => s + e.amountXof, 0);
    const presentToday = attendanceRecords.filter(
      (r) => r.date === todayISO() && (r.status === 'present' || r.status === 'late')
    ).length;
    return {
      activity: `${periodOrders.length} commande(s) reçue(s) sur la période`,
      financial: `Ventes ${formatFCFA(sales)} · dépenses ${formatFCFA(periodExpensesTotal)}`,
      employees: `${employees.filter((e) => e.status === 'active').length} employé(s) actif(s) · ${presentToday} présent(s) aujourd’hui`,
      inventory: `${getAlertProducts(products).length} alerte(s) de stock en cours`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, expenses, employees, attendanceRecords, products, range.startISO, range.endISO]);

  const reportCards: { id: ReportId; icon: React.ReactNode; title: string; description: string; preview: string }[] = [
    {
      id: 'activity',
      icon: <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      title: REPORT_TITLES.activity,
      description: 'Commandes reçues, terminées, livrées, en retard, délais et prestations.',
      preview: previews.activity,
    },
    {
      id: 'financial',
      icon: <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      title: REPORT_TITLES.financial,
      description: 'Ventes, soldes dus et dépenses — mesures distinguées, sans encaissements inventés.',
      preview: previews.financial,
    },
    {
      id: 'employees',
      icon: <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      title: REPORT_TITLES.employees,
      description: 'Présences saisies et activité atelier connue, par employé et par poste.',
      preview: previews.employees,
    },
    {
      id: 'inventory',
      icon: <Boxes className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
      title: REPORT_TITLES.inventory,
      description: 'Quantités actuelles, alertes, entrées/sorties et valeur estimée du stock.',
      preview: previews.inventory,
    },
  ];

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-[1366px]">
      <div className="print:hidden">
        <PageHeader
          title={activeReport ? REPORT_TITLES[activeReport] : 'Rapports'}
          subtitle={
            activeReport
              ? 'Indicateurs calculés depuis les données visibles de l’application'
              : 'Activité, finances, personnel et stocks — à partir de vos données locales'
          }
          onBack={() => (activeReport ? setActiveReport(null) : setActiveScreen('dashboard'))}
          action={
            activeReport ? (
              <button
                type="button"
                onClick={() => printDocument('report')}
                className="bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                title="Imprimer ce rapport (ou l’enregistrer en PDF via la boîte de dialogue)"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer / PDF</span>
              </button>
            ) : undefined
          }
        />
        <LocalDataNotice />

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-3 shadow-2xs mb-4">
          <PeriodFilter
            preset={preset}
            onPresetChange={setPreset}
            customStart={customStart}
            customEnd={customEnd}
            onCustomChange={(s, e) => {
              setCustomStart(s);
              setCustomEnd(e);
            }}
            rangeLabel={formatRangeLabel(range)}
          />
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5">
            La période s’applique à tous les rapports. Chaque rapport précise la date de référence
            utilisée (réception de commande, date de dépense, jour de présence…).
          </p>
        </div>
      </div>

      {activeReport === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
          {reportCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveReport(card.id)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 hover:border-zinc-400 rounded-xl p-5 shadow-2xs text-left transition-all hover:shadow-sm group focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <span className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">{card.icon}</span>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors" aria-hidden="true" />
              </span>
              <span className="block font-bold text-[16px] text-zinc-900 dark:text-zinc-100 mt-3">{card.title}</span>
              <span className="block text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-1">{card.description}</span>
              <span className="block text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 mt-3 tabular-nums">
                {card.preview}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3 print:hidden">
            <button
              type="button"
              onClick={() => setActiveReport(null)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg px-2.5 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Centre des rapports
            </button>
            {/* Bascule directe entre rapports, même modèle d'onglets que les autres pages */}
            <Tabs
              ariaLabel="Basculer de rapport"
              size="sm"
              activeId={activeReport}
              onChange={setActiveReport}
              tabs={[
                { id: 'activity', label: 'Activité', icon: <Activity className="w-3.5 h-3.5" aria-hidden="true" /> },
                { id: 'financial', label: 'Financier', icon: <Wallet className="w-3.5 h-3.5" aria-hidden="true" /> },
                { id: 'employees', label: 'Personnel', icon: <Users className="w-3.5 h-3.5" aria-hidden="true" /> },
                { id: 'inventory', label: 'Stock', icon: <Boxes className="w-3.5 h-3.5" aria-hidden="true" /> },
              ]}
            />
          </div>

          {/* Zone imprimable : en-tête de document + contenu du rapport */}
          <div id="report-print-area">
            <div className="hidden print:block mb-4 border-b border-zinc-300 dark:border-zinc-600 pb-3">
              <p className="text-[18px] font-black text-zinc-900 dark:text-zinc-100">{resolveShopDisplayName(shopSettings, workspace)}
                {shopSettings.address ? ` — ${shopSettings.address}` : ''}</p>
              <p className="text-[15px] font-bold mt-1">{REPORT_TITLES[activeReport]}</p>
              <p className="text-[12px] text-zinc-600 dark:text-zinc-400 tabular-nums mt-1">
                Période analysée : {formatRangeLabel(range)} · Généré le {formatLongDateTime(new Date())}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Document généré depuis les données saisies/locales de ce navigateur (jeu de démonstration
                inclus au premier lancement) — sans valeur comptable officielle.
              </p>
            </div>

            {activeReport === 'activity' && <ActivityReport range={range} />}
            {activeReport === 'financial' && <FinancialReport range={range} />}
            {activeReport === 'employees' && <EmployeeReport range={range} />}
            {activeReport === 'inventory' && <InventoryReport range={range} />}
          </div>
        </>
      )}
    </div>
  );
};
