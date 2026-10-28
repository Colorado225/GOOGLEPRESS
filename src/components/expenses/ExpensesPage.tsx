import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ModalShell';
import { PageHeader, LocalDataNotice, EmptyState, ResetFiltersButton, KpiCard, PeriodFilter } from '../common/ModuleCommon';
import { Tabs } from '../common/Tabs';
import { Frame, FramePanel, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from '../common/DataTable';
import { ExpenseFormModal } from './ExpenseFormModal';
import { ExpenseDetailPanel } from './ExpenseDetailPanel';
import { ExpenseCategoriesSection } from './ExpenseCategoriesSection';
import { Expense, EXPENSE_PAYMENT_LABELS, ExpensePaymentMethod } from '../../types';
import { formatFCFA } from '../../data/demoData';
import { formatISODateFr, todayISO } from '../../lib/dates';
import {
  enumerateDaysISO,
  formatRangeLabel,
  getPeriodRange,
  getPreviousPeriodRange,
  isISOInRange,
  PeriodPreset,
} from '../../lib/periods';
import { downloadCsv } from '../../lib/csv';
import { normalizeText } from '../../lib/utils';
import { Search, Plus, Eye, Pencil, Ban, Download, ReceiptText, FolderCog, ChartColumn } from 'lucide-react';

type TabId = 'overview' | 'register' | 'categories';
type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

const STATUS_BADGE: Record<Expense['status'], string> = {
  recorded: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  cancelled: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
};
const STATUS_LABELS: Record<Expense['status'], string> = {
  recorded: 'Enregistrée',
  cancelled: 'Annulée',
};

export const ExpensesPage: React.FC = () => {
  const { expenses, expenseCategories, setActiveScreen, cancelExpense, showToast } = useApp();

  const [tab, setTab] = useState<TabId>('overview');
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | ExpensePaymentMethod>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Expense['status']>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date-desc');

  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Expense | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const range = getPeriodRange(preset, customStart, customEnd);
  const categoryLabel = (id: string) =>
    expenseCategories.find((c) => c.id === id)?.label ?? 'Catégorie introuvable';

  // Base « période » : KPI et graphiques (hors dépenses annulées, règle homogène partout)
  const periodExpenses = useMemo(
    () => expenses.filter((e) => e.status === 'recorded' && isISOInRange(e.date, range)),
    [expenses, range.startISO, range.endISO] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const periodTotal = periodExpenses.reduce((sum, e) => sum + e.amountXof, 0);

  const topCategory = useMemo(() => {
    if (periodExpenses.length === 0) return null;
    const totals = new Map<string, number>();
    for (const e of periodExpenses) totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amountXof);
    let best: { id: string; total: number } | null = null;
    for (const [id, total] of totals) if (!best || total > best.total) best = { id, total };
    return best;
  }, [periodExpenses]);

  const variation = useMemo(() => {
    const prevRange = getPreviousPeriodRange(range);
    const prevTotal = expenses
      .filter((e) => e.status === 'recorded' && isISOInRange(e.date, prevRange))
      .reduce((sum, e) => sum + e.amountXof, 0);
    if (prevTotal <= 0) return null; // base nulle : aucun pourcentage trompeur
    return { percent: ((periodTotal - prevTotal) / prevTotal) * 100, prevTotal, prevRange };
  }, [expenses, periodTotal, range.startISO, range.endISO]); // eslint-disable-line react-hooks/exhaustive-deps

  // Évolution par jour (regroupée par semaine si la période est longue)
  const evolution = useMemo(() => {
    const days = enumerateDaysISO(range);
    const byDay = new Map<string, number>();
    for (const e of periodExpenses) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.amountXof);
    if (days.length <= 62) {
      return days.map((d) => ({ key: d, label: d.slice(8, 10), full: formatISODateFr(d), value: byDay.get(d) ?? 0 }));
    }
    const weeks: { key: string; label: string; full: string; value: number }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const slice = days.slice(i, i + 7);
      weeks.push({
        key: slice[0],
        label: slice[0].slice(8, 10) + '/' + slice[0].slice(5, 7),
        full: `Semaine du ${formatISODateFr(slice[0])}`,
        value: slice.reduce((s, d) => s + (byDay.get(d) ?? 0), 0),
      });
    }
    return weeks;
  }, [periodExpenses, range.startISO, range.endISO]); // eslint-disable-line react-hooks/exhaustive-deps
  const evolutionMax = Math.max(1, ...evolution.map((d) => d.value));

  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of periodExpenses) totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.amountXof);
    return Array.from(totals.entries())
      .map(([id, total]) => ({ id, label: categoryLabel(id), total }))
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodExpenses, expenseCategories]);

  // Registre : période + filtres fins
  const filteredExpenses = useMemo(() => {
    const term = normalizeText(searchTerm);
    const list = expenses.filter((e) => {
      if (!isISOInRange(e.date, range)) return false;
      if (term) {
        const matches =
          normalizeText(e.label).includes(term) ||
          normalizeText(e.supplier ?? '').includes(term) ||
          normalizeText(e.reference ?? '').includes(term);
        if (!matches) return false;
      }
      if (categoryFilter !== 'all' && e.categoryId !== categoryFilter) return false;
      if (paymentFilter !== 'all' && e.paymentMethod !== paymentFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      return true;
    });
    switch (sortKey) {
      case 'date-asc':
        list.sort((a, b) => a.date.localeCompare(b.date));
        break;
      case 'amount-desc':
        list.sort((a, b) => b.amountXof - a.amountXof);
        break;
      case 'amount-asc':
        list.sort((a, b) => a.amountXof - b.amountXof);
        break;
      case 'date-desc':
      default:
        list.sort((a, b) => b.date.localeCompare(a.date));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, range.startISO, range.endISO, searchTerm, categoryFilter, paymentFilter, statusFilter, sortKey]);

  const displayedTotal = filteredExpenses
    .filter((e) => e.status === 'recorded')
    .reduce((sum, e) => sum + e.amountXof, 0);

  // Affichage progressif du registre (le total et l'export portent toujours sur toutes les lignes filtrées).
  const [visibleCount, setVisibleCount] = useState(50);
  useEffect(() => {
    setVisibleCount(50);
  }, [searchTerm, categoryFilter, paymentFilter, statusFilter, preset, customStart, customEnd, sortKey]);
  const visibleExpenses = filteredExpenses.slice(0, visibleCount);

  const hasRegisterFilters =
    searchTerm.trim() !== '' || categoryFilter !== 'all' || paymentFilter !== 'all' || statusFilter !== 'all';
  const resetRegisterFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setPaymentFilter('all');
    setStatusFilter('all');
  };

  const detailExpense = detailExpenseId ? expenses.find((e) => e.id === detailExpenseId) ?? null : null;

  const exportCsv = () => {
    const rows = filteredExpenses.map((e) => [
      e.date,
      e.label,
      categoryLabel(e.categoryId),
      e.amountXof,
      EXPENSE_PAYMENT_LABELS[e.paymentMethod],
      e.supplier ?? '',
      e.reference ?? '',
      STATUS_LABELS[e.status],
      e.cancellationReason ?? '',
    ]);
    downloadCsv(
      `pressingpro-depenses-${range.startISO}-${range.endISO}.csv`,
      ['Date (ISO)', 'Libellé', 'Catégorie', 'Montant FCFA', 'Mode de paiement', 'Fournisseur', 'Référence', 'Statut', 'Motif d’annulation'],
      rows
    );
    showToast(`✓ Export CSV généré : ${rows.length} ligne(s) filtrée(s) — données locales de ce navigateur`);
  };

  const confirmCancel = () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setCancelError('Le motif d’annulation est obligatoire.');
      return;
    }
    cancelExpense(cancelTarget.id, cancelReason);
    setCancelTarget(null);
    setCancelReason('');
    setCancelError(null);
  };

  const inputClass =
    'border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-[12.5px] bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100';

  const renderActions = (expense: Expense) => (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setDetailExpenseId(expense.id)}
        aria-label={`Voir la dépense ${expense.label}`}
        title="Détail"
        className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        type="button"
        disabled={expense.status === 'cancelled'}
        onClick={() => {
          setEditingExpense(expense);
          setFormOpen(true);
        }}
        aria-label={`Modifier la dépense ${expense.label}`}
        title={expense.status === 'cancelled' ? 'Une dépense annulée ne se modifie plus' : 'Modifier'}
        className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
      >
        <Pencil className="w-4 h-4" />
      </button>
      <button
        type="button"
        disabled={expense.status === 'cancelled'}
        onClick={() => {
          setCancelTarget(expense);
          setCancelReason('');
          setCancelError(null);
        }}
        aria-label={`Annuler la dépense ${expense.label}`}
        title={expense.status === 'cancelled' ? 'Déjà annulée' : 'Annuler avec motif…'}
        className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-600"
      >
        <Ban className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-[1366px]">
      <PageHeader
        title="Dépenses"
        subtitle="Registre des dépenses de l’établissement (en FCFA)"
        onBack={() => setActiveScreen('dashboard')}
        action={
          <button
            type="button"
            onClick={() => {
              setEditingExpense(null);
              setFormOpen(true);
            }}
            className="bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter une dépense</span>
          </button>
        }
      />

      <LocalDataNotice />

      {/* Période maître : KPI, graphiques et registre la partagent */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-3 shadow-2xs mb-3">
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
      </div>

      {/* Onglets par contexte : analyser (vue d'ensemble) · consulter/agir (registre) · configurer (catégories) */}
      <Tabs
        ariaLabel="Sections du module Dépenses"
        className="mb-4"
        activeId={tab}
        onChange={setTab}
        tabs={[
          {
            id: 'overview',
            label: "Vue d'ensemble",
            icon: <ChartColumn className="w-4 h-4" aria-hidden="true" />,
          },
          {
            id: 'register',
            label: 'Registre',
            icon: <ReceiptText className="w-4 h-4" aria-hidden="true" />,
            badge: filteredExpenses.length,
          },
          {
            id: 'categories',
            label: 'Catégories',
            icon: <FolderCog className="w-4 h-4" aria-hidden="true" />,
            badge: expenseCategories.filter((c) => c.isActive).length,
          },
        ]}
      />

      {tab === 'overview' && (
        <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total de la période" value={formatFCFA(periodTotal)} hint="dépenses enregistrées, hors annulées" />
        <KpiCard label="Opérations retenues" value={String(periodExpenses.length)} hint={`sur la période sélectionnée`} />
        <KpiCard
          label="Catégorie la plus dépensière"
          value={topCategory ? categoryLabel(topCategory.id) : '—'}
          hint={topCategory ? formatFCFA(topCategory.total) : 'aucune dépense sur la période'}
        />
        <KpiCard
          label="Variation vs période précédente"
          value={variation ? `${variation.percent > 0 ? '+' : ''}${variation.percent.toFixed(0)} %` : '—'}
          hint={
            variation
              ? `période précédente : ${formatFCFA(variation.prevTotal)}`
              : 'pas de base comparable (0 FCFA avant)'
          }
          tone={variation && variation.percent > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Graphiques de la période */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-4 shadow-2xs">
          <h2 className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100">Évolution des dépenses {evolution.length > 31 ? 'par semaine' : 'par jour'}</h2>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-2">Enregistrées uniquement · {formatRangeLabel(range)}</p>
          {periodTotal === 0 ? (
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
              Aucune dépense enregistrée sur cette période : le graphique restera vide plutôt que d’afficher des valeurs inventées.
            </p>
          ) : (
            <div className="flex items-end gap-1 sm:gap-1.5 h-[150px] pt-5" role="img" aria-label="Graphique en barres des dépenses de la période">
              {evolution.map((d) => (
                <div key={d.key} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${d.full} : ${formatFCFA(d.value)}`}>
                  <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {d.value > 0 ? `${Math.round(d.value / 1000)}k` : ''}
                  </span>
                  <div
                    className={`w-full rounded-t ${d.key === todayISO() ? 'bg-blue-600' : 'bg-zinc-800'}`}
                    style={{ height: `${Math.max(d.value > 0 ? 4 : 1, (d.value / evolutionMax) * 100)}%` }}
                    aria-hidden="true"
                  />
                  <span className="text-[9.5px] text-zinc-400 dark:text-zinc-500 tabular-nums mt-1 truncate w-full text-center">{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-4 shadow-2xs">
          <h2 className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100 mb-2">Répartition par catégorie</h2>
          {byCategory.length === 0 ? (
            <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">Aucune dépense à répartir sur cette période.</p>
          ) : (
            <ul className="space-y-2.5">
              {byCategory.map((c) => (
                <li key={c.id} className="text-[12px]">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">{c.label}</span>
                    <span className="tabular-nums text-zinc-900 dark:text-zinc-100 font-bold">
                      {formatFCFA(c.total)} · {periodTotal > 0 ? Math.round((c.total / periodTotal) * 100) : 0} %
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-1 overflow-hidden" aria-hidden="true">
                    <div
                      className="h-1.5 bg-zinc-800 rounded-full"
                      style={{ width: `${periodTotal > 0 ? (c.total / periodTotal) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

        </>
      )}

      {tab === 'categories' ? (
        <ExpenseCategoriesSection />
      ) : tab === 'register' ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <label htmlFor="exp-search" className="sr-only">Rechercher une dépense</label>
              <input
                id="exp-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Libellé, fournisseur, référence…"
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-[12.5px] w-72 max-w-full focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            <label htmlFor="exp-cat" className="sr-only">Filtrer par catégorie</label>
            <select id="exp-cat" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputClass}>
              <option value="all">Catégorie : toutes</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}{c.isActive ? '' : ' (désactivée)'}</option>
              ))}
            </select>

            <label htmlFor="exp-pay" className="sr-only">Filtrer par mode de paiement</label>
            <select id="exp-pay" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as 'all' | ExpensePaymentMethod)} className={inputClass}>
              <option value="all">Paiement : tous</option>
              {(Object.keys(EXPENSE_PAYMENT_LABELS) as ExpensePaymentMethod[]).map((m) => (
                <option key={m} value={m}>{EXPENSE_PAYMENT_LABELS[m]}</option>
              ))}
            </select>

            <label htmlFor="exp-status" className="sr-only">Filtrer par statut</label>
            <select id="exp-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | Expense['status'])} className={inputClass}>
              <option value="all">Statut : tous</option>
              <option value="recorded">Enregistrées</option>
              <option value="cancelled">Annulées</option>
            </select>

            <label htmlFor="exp-sort" className="sr-only">Trier le registre</label>
            <select id="exp-sort" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={inputClass}>
              <option value="date-desc">Tri : plus récentes</option>
              <option value="date-asc">Tri : plus anciennes</option>
              <option value="amount-desc">Tri : montant décroissant</option>
              <option value="amount-asc">Tri : montant croissant</option>
            </select>

            {hasRegisterFilters && <ResetFiltersButton onClick={resetRegisterFilters} />}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium tabular-nums">
                {filteredExpenses.length} ligne(s) · total affiché (hors annulées) : <strong className="text-zinc-900 dark:text-zinc-100">{formatFCFA(displayedTotal)}</strong>
              </span>
              <button
                type="button"
                onClick={exportCsv}
                disabled={filteredExpenses.length === 0}
                className="inline-flex items-center gap-1.5 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-800 dark:text-zinc-200 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                title="Exporter les lignes filtrées en CSV (séparateur ; pour Excel FR)"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
          </div>

          {expenses.length === 0 ? (
            <EmptyState
              title="Aucune dépense enregistrée"
              description="Ajoutez la première dépense (loyer, facture CIE/SODECI, consommables…) pour alimenter le registre et les rapports."
            />
          ) : filteredExpenses.length === 0 ? (
            <EmptyState
              title="Aucune dépense pour cette période et ces filtres"
              description="Modifiez la période ou réinitialisez les filtres du registre pour élargir la recherche."
              action={<ResetFiltersButton onClick={resetRegisterFilters} />}
            />
          ) : (
            <>
              <Frame className="hidden md:block">
                <FramePanel className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Date</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Paiement</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleExpenses.map((expense) => (
                      <TableRow
                        key={expense.id}
                        onClick={() => setDetailExpenseId(expense.id)}
                        className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/70 cursor-pointer transition-colors ${expense.status === 'cancelled' ? 'opacity-60' : ''}`}
                      >
                        <TableCell className="px-4 tabular-nums text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatISODateFr(expense.date)}</TableCell>
                        <TableCell>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{expense.label}</span>
                          {expense.supplier && <span className="block text-[11.5px] text-zinc-400 dark:text-zinc-500">{expense.supplier}</span>}
                        </TableCell>
                        <TableCell className="text-zinc-600 dark:text-zinc-400">{categoryLabel(expense.categoryId)}</TableCell>
                        <TableCell className={`text-right font-bold tabular-nums ${expense.status === 'cancelled' ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
                          {formatFCFA(expense.amountXof)}
                        </TableCell>
                        <TableCell className="text-zinc-600 dark:text-zinc-400">{EXPENSE_PAYMENT_LABELS[expense.paymentMethod]}</TableCell>
                        <TableCell className="text-zinc-500 dark:text-zinc-400">{expense.reference ?? '—'}</TableCell>
                        <TableCell>
                          <Badge size="sm" className={STATUS_BADGE[expense.status]}>{STATUS_LABELS[expense.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{renderActions(expense)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </FramePanel>
              </Frame>

              <div className="md:hidden grid grid-cols-1 gap-3 p-3">
                {visibleExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    onClick={() => setDetailExpenseId(expense.id)}
                    className={`border border-zinc-200 dark:border-zinc-700 rounded-xl p-3.5 bg-zinc-50/40 dark:bg-zinc-800/40 ${expense.status === 'cancelled' ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100 truncate">{expense.label}</p>
                        <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                          {formatISODateFr(expense.date)} · {categoryLabel(expense.categoryId)}
                        </p>
                      </div>
                      {renderActions(expense)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <span className={`font-black tabular-nums ${expense.status === 'cancelled' ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-950 dark:text-zinc-50'}`}>
                        {formatFCFA(expense.amountXof)}
                      </span>
                      <span className="text-[11.5px] text-zinc-500 dark:text-zinc-400">{EXPENSE_PAYMENT_LABELS[expense.paymentMethod]}</span>
                      <Badge size="sm" className={`ml-auto ${STATUS_BADGE[expense.status]}`}>{STATUS_LABELS[expense.status]}</Badge>
                    </div>
                    {(expense.supplier || expense.reference) && (
                      <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-1.5 truncate">
                        {expense.supplier ?? ''}{expense.supplier && expense.reference ? ' · ' : ''}{expense.reference ? `Réf. ${expense.reference}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {filteredExpenses.length > visibleCount && (
                <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-3">
                  <span className="text-[12px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {visibleCount} ligne(s) affichée(s) sur {filteredExpenses.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + 50)}
                    className="border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    Afficher plus
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {formOpen && <ExpenseFormModal expense={editingExpense} onClose={() => setFormOpen(false)} />}

      {detailExpense && (
        <ExpenseDetailPanel
          expense={detailExpense}
          onClose={() => setDetailExpenseId(null)}
          onEdit={(e) => {
            setEditingExpense(e);
            setFormOpen(true);
          }}
          onCancelExpense={(e) => {
            setCancelTarget(e);
            setCancelReason('');
            setCancelError(null);
          }}
        />
      )}

      {cancelTarget && (
        <ConfirmModal
          title="Annuler cette dépense ?"
          description={
            <>
              <strong>{cancelTarget.label}</strong> ({formatFCFA(cancelTarget.amountXof)}, le{' '}
              {formatISODateFr(cancelTarget.date)}) sera marquée « Annulée » : exclue des totaux et des
              rapports, mais conservée dans le registre avec son motif.
            </>
          }
          confirmLabel="Oui, annuler la dépense"
          cancelLabel="Garder la dépense"
          danger
          onCancel={() => setCancelTarget(null)}
          onConfirm={confirmCancel}
        >
          <div className="text-left">
            <label htmlFor="cancel-reason" className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
              Motif d’annulation *
            </label>
            <input
              id="cancel-reason"
              type="text"
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
                setCancelError(null);
              }}
              placeholder="Ex : saisie en double, montant erroné…"
              aria-invalid={Boolean(cancelError)}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
            {cancelError && <p role="alert" className="text-[11.5px] text-red-600 dark:text-red-400 font-medium mt-1">{cancelError}</p>}
          </div>
        </ConfirmModal>
      )}
    </div>
  );
};
