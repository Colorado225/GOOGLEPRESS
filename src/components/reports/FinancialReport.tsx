import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { KpiCard } from '../common/ModuleCommon';
import { Frame, FramePanel, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../common/DataTable';
import { formatFCFA } from '../../data/demoData';
import { DateRange, isISOInRange } from '../../lib/periods';
import { ORDER_STATUS_LABELS, orderReceivedISO } from '../../lib/reports';
import { downloadCsv } from '../../lib/csv';
import { buildDailySeries, HorizontalBars, ReportCard, VerticalBars } from './reportWidgets';
import { Download, Info } from 'lucide-react';

const ORDER_PAYMENT_LABELS: Record<string, string> = {
  especes: 'Espèces',
  wave: 'Wave',
  momo: 'MTN MoMo',
  om: 'Orange Money',
};

/**
 * Rapport financier — mesures strictement distinguées :
 * - Ventes enregistrées : total des commandes, rattaché à leur date de réception.
 * - Encaissements : AUCUN historique daté n'existe dans les données ; on expose
 *   la caisse du jour (instantané) et les montants marqués payés par commande,
 *   sans en faire une série temporelle.
 * - « Ventes − dépenses enregistrées » : indicateur simplifié, PAS un résultat comptable.
 */
export const FinancialReport: React.FC<{ range: DateRange }> = ({ range }) => {
  const { orders, expenses, expenseCategories, cashRegister, setPreviewTicket, showToast } = useApp();

  const periodOrders = useMemo(
    () =>
      orders.filter((o) => {
        const iso = orderReceivedISO(o);
        return iso !== null && iso >= range.startISO && iso <= range.endISO;
      }),
    [orders, range.startISO, range.endISO]
  );

  const periodExpenses = useMemo(
    () => expenses.filter((e) => e.status === 'recorded' && isISOInRange(e.date, range)),
    [expenses, range.startISO, range.endISO] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const salesTotal = periodOrders.reduce((s, o) => s + o.total, 0);
  const markedPaidTotal = periodOrders.reduce((s, o) => s + o.depositPaid, 0);
  const dueOrders = useMemo(
    () => periodOrders.filter((o) => o.remainingBalance > 0),
    [periodOrders]
  );
  const dueTotal = dueOrders.reduce((s, o) => s + o.remainingBalance, 0);
  const expensesTotal = periodExpenses.reduce((s, e) => s + e.amountXof, 0);
  const simplifiedBalance = salesTotal - expensesTotal;

  const salesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of periodOrders) {
      const iso = orderReceivedISO(o);
      if (iso) map.set(iso, (map.get(iso) ?? 0) + o.total);
    }
    return map;
  }, [periodOrders]);
  const salesSeries = buildDailySeries(range, salesByDay);

  const expensesByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of periodExpenses) totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amountXof);
    return Array.from(totals.entries())
      .map(([id, total]) => ({
        label: expenseCategories.find((c) => c.id === id)?.label ?? 'Catégorie introuvable',
        value: total,
        display: formatFCFA(total),
      }))
      .sort((a, b) => b.value - a.value);
  }, [periodExpenses, expenseCategories]);

  const salesByPayment = useMemo(() => {
    const totals = new Map<string, number>();
    for (const o of periodOrders) totals.set(o.paymentMethod, (totals.get(o.paymentMethod) ?? 0) + o.total);
    return Array.from(totals.entries())
      .map(([method, total]) => ({ label: ORDER_PAYMENT_LABELS[method] ?? method, value: total, display: formatFCFA(total) }))
      .sort((a, b) => b.value - a.value);
  }, [periodOrders]);

  const exportCsv = () => {
    downloadCsv(
      `pressingpro-rapport-financier-${range.startISO}-${range.endISO}.csv`,
      ['Ticket', 'Date de commande (stockée)', 'Client', 'Statut', 'Mode de paiement déclaré', 'Vente totale FCFA', 'Marqué payé FCFA', 'Solde dû FCFA'],
      periodOrders.map((o) => [
        o.ticketNumber,
        o.receivedAt,
        o.customerName,
        ORDER_STATUS_LABELS[o.status],
        ORDER_PAYMENT_LABELS[o.paymentMethod] ?? o.paymentMethod,
        o.total,
        o.depositPaid,
        o.remainingBalance,
      ])
    );
    showToast(`✓ Rapport financier exporté (${periodOrders.length} commande(s)) — données locales`);
  };

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-[11.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          <strong>Définitions :</strong> les ventes sont rattachées à la <strong>date de commande</strong> ;
          les dépenses à leur <strong>date de dépense</strong>. Aucun historique de paiements datés n’est
          conservé : le rapport n’invente aucune série d’encaissements. « Ventes − dépenses enregistrées »
          est un indicateur simplifié, <strong>pas un bénéfice comptable</strong>.
        </span>
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ventes enregistrées" value={formatFCFA(salesTotal)} hint={`${periodOrders.length} commande(s) de la période`} tone="success" />
        <KpiCard label="Soldes dus (période)" value={formatFCFA(dueTotal)} hint={`${dueOrders.length} commande(s) non soldée(s)`} tone={dueTotal > 0 ? 'warning' : 'default'} />
        <KpiCard label="Dépenses enregistrées" value={formatFCFA(expensesTotal)} hint="hors dépenses annulées" />
        <KpiCard
          label="Ventes − dépenses enregistrées"
          value={formatFCFA(simplifiedBalance)}
          hint="indicateur simplifié, hors autres charges"
          tone={simplifiedBalance < 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ReportCard title="Évolution des ventes" subtitle="Total des commandes par jour de réception" className="lg:col-span-2">
          <VerticalBars
            data={salesSeries}
            ariaLabel="Évolution quotidienne des ventes"
            formatFullValue={(v) => formatFCFA(v)}
            emptyMessage="Aucune vente enregistrée sur cette période."
          />
        </ReportCard>

        <ReportCard title="Caisse du jour et montants marqués payés" subtitle="Sans historique daté des règlements">
          <div className="space-y-2 text-[12.5px]">
            <p className="text-zinc-600">
              Instantané caisse du <strong>{cashRegister.date}</strong> :{' '}
              <strong className="tabular-nums">{formatFCFA(cashRegister.totalAmount)}</strong>
            </p>
            <ul className="space-y-1 tabular-nums">
              <li className="flex justify-between"><span className="text-zinc-500">Espèces</span><span className="font-semibold">{formatFCFA(cashRegister.cashAmount)}</span></li>
              <li className="flex justify-between"><span className="text-zinc-500">Wave</span><span className="font-semibold">{formatFCFA(cashRegister.waveAmount)}</span></li>
              <li className="flex justify-between"><span className="text-zinc-500">MTN / Orange</span><span className="font-semibold">{formatFCFA(cashRegister.momoAmount)}</span></li>
            </ul>
            <p className="border-t border-zinc-100 pt-2 text-zinc-600">
              Montants marqués payés sur les commandes de la période :{' '}
              <strong className="tabular-nums text-zinc-900">{formatFCFA(markedPaidTotal)}</strong>
            </p>
            <p className="text-[11px] text-zinc-400">
              La date de chaque règlement n’est pas suivie : ce montant est rattaché aux commandes,
              il ne mesure pas des encaissements quotidiens.
            </p>
          </div>
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ReportCard title="Dépenses par catégorie" subtitle="Enregistrées, hors annulées">
          <HorizontalBars data={expensesByCategory} emptyMessage="Aucune dépense enregistrée sur la période." />
        </ReportCard>
        <ReportCard title="Ventes par mode de paiement" subtitle="Mode déclaré à la commande (total de la commande)">
          <HorizontalBars data={salesByPayment} emptyMessage="Aucune vente sur la période." />
        </ReportCard>
      </div>

      <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3.5 pb-2">
          <h3 className="font-bold text-[14px] text-zinc-900">Soldes dus des commandes de la période ({dueOrders.length})</h3>
          <button
            type="button"
            onClick={exportCsv}
            disabled={periodOrders.length === 0}
            className="ml-auto inline-flex items-center gap-1.5 border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50 text-zinc-800 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors print:hidden focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV (commandes)
          </button>
        </div>
        {dueOrders.length === 0 ? (
          <p className="px-4 pb-4 text-[12.5px] text-zinc-500">Aucun solde dû : toutes les commandes de la période sont soldées.</p>
        ) : (
          <Frame className="m-3 mt-1">
            <FramePanel className="p-0">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Ticket</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Marqué payé</TableHead>
                  <TableHead className="text-right">Solde dû</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dueOrders.map((o) => (
                  <TableRow key={o.id} onClick={() => setPreviewTicket(o)} className="hover:bg-zinc-50/70 cursor-pointer transition-colors">
                    <TableCell className="px-4 font-bold text-zinc-900">{o.ticketNumber}</TableCell>
                    <TableCell className="text-zinc-700">{o.customerName}</TableCell>
                    <TableCell className="tabular-nums text-zinc-600">{o.customerPhone}</TableCell>
                    <TableCell className="text-zinc-600">{ORDER_STATUS_LABELS[o.status]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatFCFA(o.total)}</TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-600">{formatFCFA(o.depositPaid)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-amber-700">{formatFCFA(o.remainingBalance)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t border-zinc-200 font-bold">
                  <TableCell className="px-4" colSpan={6}>Total des soldes dus</TableCell>
                  <TableCell className="text-right tabular-nums">{formatFCFA(dueTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </FramePanel>
          </Frame>
        )}
      </div>
    </div>
  );
};
