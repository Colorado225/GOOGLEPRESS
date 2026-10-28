import React, { useMemo, useState } from 'react';
import { InventoryProduct, StockMovement, StockMovementType } from '../../types';
import { formatQuantity } from '../../lib/inventory';
import { formatISODateFr } from '../../lib/dates';
import { formatFCFA } from '../../data/demoData';
import { getPeriodRange, isISOInRange, PeriodPreset, formatRangeLabel } from '../../lib/periods';
import { normalizeText } from '../../lib/utils';
import { EmptyState, PeriodFilter, ResetFiltersButton } from '../common/ModuleCommon';
import { ModalShell } from '../common/ModalShell';
import { Frame, FramePanel, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, TablePaginationFooter } from '../common/DataTable';
import { usePagination } from '../../lib/pagination';
import { MOVEMENT_TYPE_BADGE, MOVEMENT_TYPE_LABELS } from './inventoryLabels';
import { Eye, History } from 'lucide-react';

interface StockMovementHistoryProps {
  movements: StockMovement[];
  products: InventoryProduct[];
  onViewProduct: (product: InventoryProduct) => void;
}

export const StockMovementHistory: React.FC<StockMovementHistoryProps> = ({
  movements,
  products,
  onViewProduct,
}) => {
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | StockMovementType>('all');
  const [reasonSearch, setReasonSearch] = useState('');
  const [sortDesc, setSortDesc] = useState(true);
  const [detail, setDetail] = useState<StockMovement | null>(null);

  const range = getPeriodRange(preset, customStart, customEnd);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filtered = useMemo(() => {
    const term = normalizeText(reasonSearch);
    const list = movements.filter((m) => {
      if (!isISOInRange(m.date, range)) return false;
      if (productFilter !== 'all' && m.productId !== productFilter) return false;
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (term && !normalizeText(m.reason).includes(term) && !normalizeText(m.note ?? '').includes(term)) return false;
      return true;
    });
    list.sort((a, b) => (sortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movements, preset, customStart, customEnd, productFilter, typeFilter, reasonSearch, sortDesc]);

  const { page, pageCount, setPage, pageItems: pagedMovements, rangeStart, rangeEnd } = usePagination(filtered, 10, [preset, customStart, customEnd, productFilter, typeFilter, reasonSearch, sortDesc]);

  const hasActiveFilters =
    preset !== 'month' || productFilter !== 'all' || typeFilter !== 'all' || reasonSearch.trim() !== '';
  const resetFilters = () => {
    setPreset('month');
    setProductFilter('all');
    setTypeFilter('all');
    setReasonSearch('');
  };

  const variationOf = (m: StockMovement) => m.quantityAfter - m.quantityBefore;
  const inputClass =
    'border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-[12.5px] bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100';

  const detailProduct = detail ? productById.get(detail.productId) : undefined;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl shadow-2xs overflow-hidden">
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 space-y-2.5">
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
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="hist-product" className="sr-only">Filtrer par produit</label>
          <select id="hist-product" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className={inputClass}>
            <option value="all">Tous les produits (y compris désactivés)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.reference}){p.isActive ? '' : ' — désactivé'}
              </option>
            ))}
          </select>

          <label htmlFor="hist-type" className="sr-only">Filtrer par type de mouvement</label>
          <select id="hist-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | StockMovementType)} className={inputClass}>
            <option value="all">Tous les types</option>
            {(Object.keys(MOVEMENT_TYPE_LABELS) as StockMovementType[]).map((t) => (
              <option key={t} value={t}>{MOVEMENT_TYPE_LABELS[t]}</option>
            ))}
          </select>

          <label htmlFor="hist-reason" className="sr-only">Rechercher dans les motifs</label>
          <input
            id="hist-reason"
            type="text"
            value={reasonSearch}
            onChange={(e) => setReasonSearch(e.target.value)}
            placeholder="Motif (ex. inventaire)…"
            className={`${inputClass} w-52 max-w-full`}
          />

          <button
            type="button"
            onClick={() => setSortDesc((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg px-2.5 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            aria-label="Inverser l'ordre chronologique"
          >
            <History className="w-3.5 h-3.5" /> {sortDesc ? 'Plus récents d’abord' : 'Plus anciens d’abord'}
          </button>

          {hasActiveFilters && <ResetFiltersButton onClick={resetFilters} />}
          <span className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium ml-auto tabular-nums">
            {filtered.length} mouvement(s)
          </span>
        </div>
      </div>

      {movements.length === 0 ? (
        <EmptyState
          title="Aucun mouvement enregistré"
          description="L’historique apparaîtra ici dès la première entrée, sortie ou ajustement de stock."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun mouvement pour ces filtres"
          description="Aucun mouvement ne correspond à la période, au produit, au type et au motif sélectionnés."
          action={<ResetFiltersButton onClick={resetFilters} />}
        />
      ) : (
        <Frame>
          <FramePanel className="p-0">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Date</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Variation</TableHead>
                <TableHead className="text-right">Stock après</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead className="text-right">Détail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedMovements.map((m) => {
                const product = productById.get(m.productId);
                const variation = variationOf(m);
                return (
                  <TableRow key={m.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/70 transition-colors">
                    <TableCell className="px-4 tabular-nums text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{formatISODateFr(m.date)}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{product?.name ?? 'Produit supprimé de la liste'}</span>
                      {product && <span className="text-zinc-400 dark:text-zinc-500 text-[11.5px]"> · {product.reference}{product.isActive ? '' : ' (désactivé)'}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge size="sm" className={MOVEMENT_TYPE_BADGE[m.type]}>{MOVEMENT_TYPE_LABELS[m.type]}</Badge>
                    </TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${variation < 0 ? 'text-orange-700 dark:text-orange-300' : variation > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {variation > 0 ? '+' : ''}
                      {formatQuantity(variation, product?.unit ?? '')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatQuantity(m.quantityAfter, product?.unit ?? '')}
                    </TableCell>
                    <TableCell className="text-zinc-600 dark:text-zinc-400">{m.reason}</TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => setDetail(m)}
                        aria-label="Voir le détail du mouvement"
                        className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePaginationFooter
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={filtered.length}
            label="mouvement(s)"
            className="border-t border-zinc-200 dark:border-zinc-700"
          />
          </FramePanel>
        </Frame>
      )}

      {detail && (
        <ModalShell
          title="Détail du mouvement"
          subtitle={detailProduct ? `${detailProduct.name} · ${detailProduct.reference}` : undefined}
          onClose={() => setDetail(null)}
        >
          <div className="p-5 space-y-2.5 text-[13px]">
            <dl className="space-y-1.5">
              {([
                ['Date', formatISODateFr(detail.date)],
                ['Produit', detailProduct ? `${detailProduct.name} (${detailProduct.reference})` : 'Non renseigné'],
                ['Type', MOVEMENT_TYPE_LABELS[detail.type]],
                ['Quantité saisie', formatQuantity(detail.quantity, detailProduct?.unit ?? '') + (detail.type === 'adjustment' ? ' (quantité cible)' : '')],
                ['Stock avant', formatQuantity(detail.quantityBefore, detailProduct?.unit ?? '')],
                ['Stock après', formatQuantity(detail.quantityAfter, detailProduct?.unit ?? '')],
                ['Motif', detail.reason],
                ['Coût unitaire', detail.unitCostXof !== undefined ? formatFCFA(detail.unitCostXof) : 'Non renseigné'],
                ['Commentaire', detail.note ?? 'Non renseigné'],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-zinc-50 dark:border-zinc-800 pb-1">
                  <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
                  <dd className="font-semibold text-zinc-900 dark:text-zinc-100 text-right tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5">
              Les mouvements ne sont jamais modifiés ni supprimés : pour corriger une erreur,
              enregistrez un ajustement motivé — la trace complète reste visible dans cet historique.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="flex-1 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-lg py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                Fermer
              </button>
              {detailProduct && (
                <button
                  type="button"
                  onClick={() => {
                    setDetail(null);
                    onViewProduct(detailProduct);
                  }}
                  className="flex-1 bg-[#09090b] dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold rounded-lg py-2.5 shadow transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  Voir le produit
                </button>
              )}
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};
