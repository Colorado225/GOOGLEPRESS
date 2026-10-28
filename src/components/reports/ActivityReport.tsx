import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { KpiCard, ResetFiltersButton } from '../common/ModuleCommon';
import { Frame, FramePanel, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from '../common/DataTable';
import { OrderStatus } from '../../types';
import { formatFCFA } from '../../data/demoData';
import { DateRange } from '../../lib/periods';
import {
  ORDER_STATUS_LABELS,
  computeAverageTurnaroundHours,
  formatDurationHours,
  isOrderFinished,
  isOrderLate,
  orderReceivedISO,
} from '../../lib/reports';
import { downloadCsv } from '../../lib/csv';
import { buildDailySeries, HorizontalBars, ReportCard, VerticalBars } from './reportWidgets';
import { Download } from 'lucide-react';

/**
 * Rapport d'activité — définitions :
 * - "Reçue dans la période" : date de réception stockée sur la commande.
 * - "Terminée" : statut actuel Prête ou Livrée · "Livrée" : statut Livrée.
 * - "En retard" : drapeau métier isLate de la commande (promisedAt est un
 *   libellé d'affichage sans année, non recalculable de façon fiable).
 */
export const ActivityReport: React.FC<{ range: DateRange }> = ({ range }) => {
  const { orders, setPreviewTicket, showToast } = useApp();
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const periodOrders = useMemo(() => {
    return orders.filter((o) => {
      const iso = orderReceivedISO(o);
      return iso !== null && iso >= range.startISO && iso <= range.endISO;
    });
  }, [orders, range.startISO, range.endISO]);

  const unreadableCount = orders.length - orders.filter((o) => orderReceivedISO(o) !== null).length;

  const filtered = useMemo(
    () =>
      periodOrders.filter((o) => {
        if (statusFilter !== 'all' && o.status !== statusFilter) return false;
        if (categoryFilter !== 'all' && (o.serviceCategory ?? 'unrecorded') !== categoryFilter) return false;
        return true;
      }),
    [periodOrders, statusFilter, categoryFilter]
  );

  const finished = periodOrders.filter(isOrderFinished).length;
  const delivered = periodOrders.filter((o) => o.status === 'delivered').length;
  const lateOrders = periodOrders.filter(isOrderLate);
  const turnaround = computeAverageTurnaroundHours(periodOrders);

  const volumeByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of filtered) {
      const iso = orderReceivedISO(o);
      if (iso) map.set(iso, (map.get(iso) ?? 0) + 1);
    }
    return map;
  }, [filtered]);
  const volumeSeries = buildDailySeries(range, volumeByDay, (v) => (v > 0 ? String(v) : ''));

  const byStatus = useMemo(() => {
    const counts = new Map<OrderStatus, number>();
    for (const o of filtered) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    return (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[])
      .filter((s) => (counts.get(s) ?? 0) > 0)
      .map((s) => ({
        label: ORDER_STATUS_LABELS[s],
        value: counts.get(s) ?? 0,
        display: `${counts.get(s) ?? 0} commande(s)`,
      }));
  }, [filtered]);

  const byService = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of filtered) for (const l of o.lines) counts.set(l.serviceType, (counts.get(l.serviceType) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value, display: `${value} ligne(s)` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  const exportCsv = () => {
    downloadCsv(
      `pressingpro-rapport-activite-${range.startISO}-${range.endISO}.csv`,
      ['Ticket', 'Date de réception (stockée)', 'Client', 'Statut', 'Total FCFA', 'Reste à payer FCFA', 'En retard (drapeau)'],
      filtered.map((o) => [
        o.ticketNumber,
        o.receivedAt,
        o.customerName,
        ORDER_STATUS_LABELS[o.status],
        o.total,
        o.remainingBalance,
        isOrderLate(o) ? 'Oui' : 'Non',
      ])
    );
    showToast(`✓ Rapport d’activité exporté (${filtered.length} commande(s)) — données locales`);
  };

  const inputClass =
    'border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-[12.5px] bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Commandes reçues" value={String(periodOrders.length)} hint="sur la période (date de réception)" />
        <KpiCard label="Terminées (prêtes/livrées)" value={String(finished)} hint="parmi celles de la période, à ce jour" tone="success" />
        <KpiCard label="Livrées" value={String(delivered)} hint="statut actuel « Livrée »" />
        <KpiCard label="En retard" value={String(lateOrders.length)} hint="drapeau retard de la commande" tone={lateOrders.length > 0 ? 'danger' : 'default'} />
        <KpiCard
          label="Délai moyen réception → prêt"
          value={turnaround ? formatDurationHours(turnaround.hours) : '—'}
          hint={turnaround ? `sur ${turnaround.sampleSize} commande(s) horodatées` : 'horodatages insuffisants'}
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-3 shadow-2xs flex flex-wrap items-center gap-2 print:hidden">
        <label htmlFor="act-status" className="sr-only">Filtrer par statut</label>
        <select id="act-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)} className={inputClass}>
          <option value="all">Statut : tous</option>
          {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <label htmlFor="act-cat" className="sr-only">Filtrer par univers de service</label>
        <select id="act-cat" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputClass}>
          <option value="all">Univers : tous</option>
          <option value="pressing">Pressing</option>
          <option value="blanchisserie">Blanchisserie</option>
          <option value="unrecorded">Non renseigné</option>
        </select>
        {(statusFilter !== 'all' || categoryFilter !== 'all') && (
          <ResetFiltersButton
            onClick={() => {
              setStatusFilter('all');
              setCategoryFilter('all');
            }}
          />
        )}
        <span className="text-[12px] text-zinc-500 dark:text-zinc-400 tabular-nums">
          Graphiques et tableau : {filtered.length} commande(s) après filtres métier · KPI ci-dessus : période complète
        </span>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 text-zinc-800 dark:text-zinc-200 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ReportCard title="Volume de commandes reçues" subtitle="Par jour de réception (semaine si période longue)" className="lg:col-span-2">
          <VerticalBars
            data={volumeSeries}
            ariaLabel="Volume quotidien des commandes reçues"
            formatFullValue={(v) => `${v} commande(s)`}
            emptyMessage="Aucune commande reçue sur cette période avec les filtres actuels."
          />
        </ReportCard>
        <ReportCard title="Répartition par statut">
          <HorizontalBars data={byStatus} emptyMessage="Aucune commande à répartir." />
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ReportCard title="Prestations demandées" subtitle="Nombre de lignes par type de prestation">
          <HorizontalBars data={byService} emptyMessage="Aucune ligne de prestation sur la sélection." />
        </ReportCard>

        <ReportCard title={`Commandes en retard (${lateOrders.length})`} className="lg:col-span-2">
          {lateOrders.length === 0 ? (
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">Aucune commande marquée en retard parmi celles reçues sur la période.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {lateOrders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setPreviewTicket(o)}
                    className="w-full flex flex-wrap items-center gap-2 py-2 text-left text-[12.5px] hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg px-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{o.ticketNumber}</span>
                    <span className="text-zinc-600 dark:text-zinc-400">{o.customerName}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 tabular-nums">reçue {o.receivedAt}</span>
                    <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                      {ORDER_STATUS_LABELS[o.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ReportCard>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl shadow-2xs overflow-hidden">
        <h3 className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100 px-4 pt-3.5">Commandes de la sélection ({filtered.length})</h3>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 px-4 pb-2">Cliquez une ligne pour ouvrir le ticket correspondant.</p>
        {filtered.length === 0 ? (
          <p className="px-4 pb-4 text-[12.5px] text-zinc-500 dark:text-zinc-400">Aucune commande ne correspond à la période et aux filtres métier.</p>
        ) : (
          <Frame className="m-3 mt-1">
            <FramePanel className="p-0">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Ticket</TableHead>
                  <TableHead>Réception</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Reste à payer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id} onClick={() => setPreviewTicket(o)} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/70 cursor-pointer transition-colors">
                    <TableCell className="px-4 font-bold text-zinc-900 dark:text-zinc-100">{o.ticketNumber}</TableCell>
                    <TableCell className="tabular-nums text-zinc-600 dark:text-zinc-400">{o.receivedAt}</TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300">{o.customerName}</TableCell>
                    <TableCell className="text-zinc-600 dark:text-zinc-400">
                      {ORDER_STATUS_LABELS[o.status]}
                      {isOrderLate(o) && <Badge variant="destructive" size="sm" className="ml-1.5 px-1.5 text-[10px]">Retard</Badge>}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{formatFCFA(o.total)}</TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-600 dark:text-zinc-400">{formatFCFA(o.remainingBalance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </FramePanel>
          </Frame>
        )}
        {unreadableCount > 0 && (
          <p className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 text-[11.5px] text-zinc-400 dark:text-zinc-500">
            {unreadableCount} commande(s) exclue(s) des rapports datés : date de réception stockée dans un format illisible.
          </p>
        )}
      </div>
    </div>
  );
};
