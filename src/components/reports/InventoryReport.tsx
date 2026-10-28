import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { KpiCard, ResetFiltersButton } from '../common/ModuleCommon';
import { Frame, FramePanel, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from '../common/DataTable';
import { StockStatus } from '../../types';
import { formatFCFA } from '../../data/demoData';
import { DateRange, isISOInRange } from '../../lib/periods';
import {
  estimateStockValue,
  formatQuantity,
  getAlertProducts,
  getStockStatus,
  STOCK_STATUS_LABELS,
} from '../../lib/inventory';
import { STOCK_STATUS_BADGE } from '../inventory/inventoryLabels';
import { downloadCsv } from '../../lib/csv';
import { Download } from 'lucide-react';

/**
 * Rapport de stock : quantités courantes (aujourd'hui) et mouvements de la
 * période. Les quantités restent par produit et par unité — on n'additionne
 * jamais des litres, des kilos et des pièces dans un total unique.
 */
export const InventoryReport: React.FC<{ range: DateRange }> = ({ range }) => {
  const { products, stockMovements, showToast } = useApp();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StockStatus>('all');

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort((a, b) => a.localeCompare(b, 'fr')),
    [products]
  );

  const alerts = useMemo(() => getAlertProducts(products), [products]);
  const outCount = alerts.filter((p) => getStockStatus(p.currentQuantity, p.alertThreshold) === 'out').length;
  const stockValue = useMemo(() => estimateStockValue(products), [products]);

  const periodMovements = useMemo(
    () => stockMovements.filter((m) => isISOInRange(m.date, range)),
    [stockMovements, range.startISO, range.endISO] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const entries = periodMovements.filter((m) => m.type === 'in');
  const outputs = periodMovements.filter((m) => m.type === 'out');
  const entryCost = entries.reduce(
    (sum, m) => sum + (m.unitCostXof !== undefined ? (m.quantityAfter - m.quantityBefore) * m.unitCostXof : 0),
    0
  );
  const entriesWithCost = entries.filter((m) => m.unitCostXof !== undefined).length;

  const rows = useMemo(() => {
    return products
      .filter((p) => {
        if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
        if (statusFilter !== 'all' && getStockStatus(p.currentQuantity, p.alertThreshold) !== statusFilter) return false;
        return true;
      })
      .map((product) => {
        const moves = periodMovements.filter((m) => m.productId === product.id);
        const inQty = moves
          .filter((m) => m.type === 'in')
          .reduce((s, m) => s + (m.quantityAfter - m.quantityBefore), 0);
        const outQty = moves
          .filter((m) => m.type === 'out')
          .reduce((s, m) => s + (m.quantityBefore - m.quantityAfter), 0);
        const value =
          product.unitCostXof !== undefined
            ? Math.round(product.currentQuantity * product.unitCostXof)
            : undefined;
        return { product, inQty, outQty, value };
      })
      .sort((a, b) => a.product.name.localeCompare(b.product.name, 'fr'));
  }, [products, periodMovements, categoryFilter, statusFilter]);

  const exportCsv = () => {
    downloadCsv(
      `pressingpro-rapport-stock-${range.startISO}-${range.endISO}.csv`,
      ['Produit', 'Référence', 'Catégorie', 'Unité', 'Stock actuel', 'Seuil d’alerte', 'État', 'Entrées période', 'Sorties période', 'Dernier coût FCFA', 'Valeur estimée FCFA'],
      rows.map((r) => [
        r.product.name,
        r.product.reference,
        r.product.category,
        r.product.unit,
        r.product.currentQuantity,
        r.product.alertThreshold,
        STOCK_STATUS_LABELS[getStockStatus(r.product.currentQuantity, r.product.alertThreshold)],
        r.inQty,
        r.outQty,
        r.product.unitCostXof ?? '',
        r.value ?? '',
      ])
    );
    showToast(`✓ Rapport de stock exporté (${rows.length} produit(s)) — données locales`);
  };

  const inputClass =
    'border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-[12.5px] bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Références actives"
          value={String(products.filter((p) => p.isActive).length)}
          hint={`${alerts.length} en alerte dont ${outCount} en rupture`}
          tone={outCount > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          label="Entrées sur la période"
          value={String(entries.length)}
          hint={
            entriesWithCost > 0
              ? `coût d’achat estimé : ${formatFCFA(Math.round(entryCost))} (${entriesWithCost}/${entries.length} avec coût)`
              : 'aucun coût renseigné sur les entrées'
          }
        />
        <KpiCard label="Sorties sur la période" value={String(outputs.length)} hint="mouvements de consommation enregistrés" />
        <KpiCard
          label="Valeur indicative du stock"
          value={stockValue.productsWithCost > 0 ? formatFCFA(stockValue.valueXof) : '—'}
          hint={
            stockValue.productsWithCost > 0
              ? `estimation au dernier coût · ${stockValue.productsWithCost}/${stockValue.activeProducts} produits`
              : 'aucun coût d’achat renseigné'
          }
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-3 shadow-2xs flex flex-wrap items-center gap-2 print:hidden">
        <label htmlFor="rep-stock-cat" className="sr-only">Filtrer par catégorie</label>
        <select id="rep-stock-cat" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputClass}>
          <option value="all">Catégorie : toutes</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label htmlFor="rep-stock-state" className="sr-only">Filtrer par état</label>
        <select id="rep-stock-state" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | StockStatus)} className={inputClass}>
          <option value="all">État : tous</option>
          {(Object.keys(STOCK_STATUS_LABELS) as StockStatus[]).map((s) => (
            <option key={s} value={s}>{STOCK_STATUS_LABELS[s]}</option>
          ))}
        </select>
        {(categoryFilter !== 'all' || statusFilter !== 'all') && (
          <ResetFiltersButton
            onClick={() => {
              setCategoryFilter('all');
              setStatusFilter('all');
            }}
          />
        )}
        <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
          Quantités courantes à date ; entrées/sorties sur la période. Unités jamais additionnées entre produits.
        </span>
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 text-zinc-800 dark:text-zinc-200 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl shadow-2xs overflow-hidden">
        <h3 className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100 px-4 pt-3.5">Stock par produit ({rows.length})</h3>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 px-4 pb-2">La consommation estimée repose uniquement sur les sorties enregistrées.</p>
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-[12.5px] text-zinc-500 dark:text-zinc-400">Aucun produit ne correspond aux filtres.</p>
        ) : (
          <Frame className="m-3 mt-1">
            <FramePanel className="p-0">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Produit</TableHead>
                  <TableHead className="text-right">Stock actuel</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="text-right">Entrées (période)</TableHead>
                  <TableHead className="text-right">Sorties (période)</TableHead>
                  <TableHead className="text-right">Dernier coût</TableHead>
                  <TableHead className="text-right">Valeur estimée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ product, inQty, outQty, value }) => {
                  const status = getStockStatus(product.currentQuantity, product.alertThreshold);
                  return (
                    <TableRow key={product.id} className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/70 transition-colors ${product.isActive ? '' : 'opacity-60'}`}>
                      <TableCell className="px-4">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{product.name}</span>
                        <span className="block text-[11px] text-zinc-400 dark:text-zinc-500">
                          {product.reference} · {product.category}{product.isActive ? '' : ' · désactivé'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {formatQuantity(product.currentQuantity, product.unit)}
                      </TableCell>
                      <TableCell>
                        <Badge size="sm" className={STOCK_STATUS_BADGE[status]}>{STOCK_STATUS_LABELS[status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                        {inQty > 0 ? `+${formatQuantity(inQty, product.unit)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-orange-700 dark:text-orange-300">
                        {outQty > 0 ? `−${formatQuantity(outQty, product.unit)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {product.unitCostXof !== undefined ? formatFCFA(product.unitCostXof) : 'Non renseigné'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {value !== undefined ? formatFCFA(value) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </FramePanel>
          </Frame>
        )}
      </div>
    </div>
  );
};
