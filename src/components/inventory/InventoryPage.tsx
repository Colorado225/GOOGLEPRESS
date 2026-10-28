import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ModalShell';
import { PageHeader, LocalDataNotice, EmptyState, ResetFiltersButton, KpiCard } from '../common/ModuleCommon';
import { Tabs } from '../common/Tabs';
import { Frame, FramePanel, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, TablePaginationFooter } from '../common/DataTable';
import { usePagination } from '../../lib/pagination';
import { ProductFormModal } from './ProductFormModal';
import { StockMovementModal } from './StockMovementModal';
import { StockMovementHistory } from './StockMovementHistory';
import { StockAlertsPanel } from './StockAlertsPanel';
import { ProductDetailPanel } from './ProductDetailPanel';
import { InventoryProduct, StockMovementType, StockStatus } from '../../types';
import {
  estimateStockValue,
  formatQuantity,
  getAlertProducts,
  getStockStatus,
  STOCK_STATUS_LABELS,
} from '../../lib/inventory';
import { formatFCFA } from '../../data/demoData';
import { isoDaysFromToday } from '../../lib/dates';
import { normalizeText } from '../../lib/utils';
import { STOCK_STATUS_BADGE } from './inventoryLabels';
import { Search, Plus, Eye, Pencil, Ban, UserCheck, ArrowDownUp, Boxes, AlertTriangle, History, TrendingDown } from 'lucide-react';

type TabId = 'catalog' | 'alerts' | 'history';
type SortKey = 'name' | 'quantity' | 'cost';

export const InventoryPage: React.FC = () => {
  const { products, stockMovements, setActiveScreen, setProductActive } = useApp();

  const [tab, setTab] = useState<TabId>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StockStatus>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [movementModal, setMovementModal] = useState<{ productId?: string; type?: StockMovementType } | null>(null);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<InventoryProduct | null>(null);

  const alerts = useMemo(() => getAlertProducts(products), [products]);
  const outCount = alerts.filter((p) => getStockStatus(p.currentQuantity, p.alertThreshold) === 'out').length;
  const activeCount = products.filter((p) => p.isActive).length;
  const stockValue = useMemo(() => estimateStockValue(products), [products]);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort((a, b) => a.localeCompare(b, 'fr')),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const term = normalizeText(searchTerm);
    const list = products.filter((p) => {
      if (term && !normalizeText(p.name).includes(term) && !normalizeText(p.reference).includes(term)) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && getStockStatus(p.currentQuantity, p.alertThreshold) !== statusFilter) return false;
      if (activeFilter === 'active' && !p.isActive) return false;
      if (activeFilter === 'inactive' && p.isActive) return false;
      return true;
    });
    switch (sortKey) {
      case 'quantity':
        list.sort((a, b) => b.currentQuantity - a.currentQuantity);
        break;
      case 'cost':
        list.sort((a, b) => (b.unitCostXof ?? -1) - (a.unitCostXof ?? -1));
        break;
      case 'name':
      default:
        list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    return list;
  }, [products, searchTerm, categoryFilter, statusFilter, activeFilter, sortKey]);

  const { page, pageCount, setPage, pageItems: pagedProducts, rangeStart, rangeEnd } = usePagination(filteredProducts, 10, [searchTerm, categoryFilter, statusFilter, activeFilter, sortKey]);

  // Produits les plus sortis sur 30 jours (quantités par produit, unités non mélangées)
  const topOutputs = useMemo(() => {
    const since = isoDaysFromToday(-29);
    const totals = new Map<string, number>();
    for (const m of stockMovements) {
      if (m.type !== 'out' || m.date < since) continue;
      totals.set(m.productId, (totals.get(m.productId) ?? 0) + (m.quantityBefore - m.quantityAfter));
    }
    return Array.from(totals.entries())
      .map(([productId, qty]) => ({ product: products.find((p) => p.id === productId), qty }))
      .filter((x): x is { product: InventoryProduct; qty: number } => Boolean(x.product) && x.qty > 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [stockMovements, products]);

  const recentMovementsCount = stockMovements.length;
  const hasActiveFilters =
    searchTerm.trim() !== '' || categoryFilter !== 'all' || statusFilter !== 'all' || activeFilter !== 'all';
  const resetFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setActiveFilter('all');
  };

  const detailProduct = detailProductId ? products.find((p) => p.id === detailProductId) ?? null : null;

  const openCreate = () => {
    setEditingProduct(null);
    setProductFormOpen(true);
  };
  const openEdit = (product: InventoryProduct) => {
    setEditingProduct(product);
    setProductFormOpen(true);
  };

  const inputClass =
    'border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-[12.5px] bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100';

  const renderActions = (product: InventoryProduct) => (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setDetailProductId(product.id)}
        aria-label={`Voir le produit ${product.name}`}
        title="Voir"
        className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => openEdit(product)}
        aria-label={`Modifier ${product.name}`}
        title="Modifier"
        className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
      >
        <Pencil className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setMovementModal({ productId: product.id })}
        disabled={!product.isActive}
        aria-label={`Enregistrer un mouvement pour ${product.name}`}
        title={product.isActive ? 'Enregistrer un mouvement' : 'Produit désactivé'}
        className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
      >
        <ArrowDownUp className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setToggleConfirm(product)}
        aria-label={product.isActive ? `Désactiver ${product.name}` : `Réactiver ${product.name}`}
        title={product.isActive ? 'Désactiver' : 'Réactiver'}
        className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 ${
          product.isActive
            ? 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 focus:ring-red-600'
            : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 focus:ring-emerald-600'
        }`}
      >
        {product.isActive ? <Ban className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-[1366px]">
      <PageHeader
        title="Stocks"
        subtitle="Inventaire, mouvements et alertes de réapprovisionnement"
        onBack={() => setActiveScreen('dashboard')}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMovementModal({ type: 'in' })}
              className="border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enregistrer un mouvement</span>
              <span className="sm:hidden">Mouvement</span>
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter un produit</span>
            </button>
          </div>
        }
      />

      <LocalDataNotice />

      {/* Vue d'ensemble (KPI calculés sur les mêmes règles que le catalogue) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Références actives" value={String(activeCount)} hint={`${products.length} référence(s) au catalogue`} />
        <KpiCard
          label="Sous le seuil d’alerte"
          value={String(alerts.length - outCount)}
          hint="stock faible, à surveiller"
          tone={alerts.length - outCount > 0 ? 'warning' : 'default'}
        />
        <KpiCard label="En rupture" value={String(outCount)} hint="stock à zéro" tone={outCount > 0 ? 'danger' : 'default'} />
        <KpiCard
          label="Valeur indicative du stock"
          value={stockValue.productsWithCost > 0 ? formatFCFA(stockValue.valueXof) : '—'}
          hint={
            stockValue.productsWithCost > 0
              ? `Estimation au dernier coût · ${stockValue.productsWithCost}/${stockValue.activeProducts} produits avec coût renseigné`
              : 'Aucun coût d’achat renseigné'
          }
        />
      </div>

      {/* Onglets par contexte : le catalogue · ce qui demande attention · l'historique */}
      <Tabs
        ariaLabel="Sections du module Stocks"
        className="mb-3"
        activeId={tab}
        onChange={setTab}
        tabs={[
          {
            id: 'catalog',
            label: 'Catalogue',
            icon: <Boxes className="w-4 h-4" aria-hidden="true" />,
            badge: filteredProducts.length,
          },
          {
            id: 'alerts',
            label: 'Alertes',
            icon: <AlertTriangle className="w-4 h-4" aria-hidden="true" />,
            badge: alerts.length > 0 ? alerts.length : undefined,
          },
          {
            id: 'history',
            label: 'Mouvements',
            icon: <History className="w-4 h-4" aria-hidden="true" />,
            badge: recentMovementsCount,
          },
        ]}
      />

      {tab === 'alerts' && (
        <StockAlertsPanel
          alerts={alerts}
          onRecordEntry={(p) => setMovementModal({ productId: p.id, type: 'in' })}
          onViewProduct={(p) => setDetailProductId(p.id)}
        />
      )}

      {tab === 'history' && (
        <>
          {topOutputs.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-3 shadow-2xs mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-zinc-700 dark:text-zinc-300">
                <TrendingDown className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" /> Plus sortis (30 jours) :
              </span>
              {topOutputs.map(({ product, qty }) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setDetailProductId(product.id)}
                  className="text-[11.5px] font-semibold bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-2.5 py-1 tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  {product.name} · {formatQuantity(qty, product.unit)}
                </button>
              ))}
            </div>
          )}
          <StockMovementHistory
            movements={stockMovements}
            products={products}
            onViewProduct={(p) => setDetailProductId(p.id)}
          />
        </>
      )}

      {tab === 'catalog' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl overflow-hidden shadow-2xs">
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <label htmlFor="stock-search" className="sr-only">Rechercher un produit</label>
              <input
                id="stock-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nom ou référence…"
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-[12.5px] w-64 max-w-full focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            <label htmlFor="stock-cat" className="sr-only">Filtrer par catégorie</label>
            <select id="stock-cat" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputClass}>
              <option value="all">Catégorie : toutes</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <label htmlFor="stock-state" className="sr-only">Filtrer par état du stock</label>
            <select id="stock-state" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | StockStatus)} className={inputClass}>
              <option value="all">État : tous</option>
              {(Object.keys(STOCK_STATUS_LABELS) as StockStatus[]).map((s) => (
                <option key={s} value={s}>{STOCK_STATUS_LABELS[s]}</option>
              ))}
            </select>

            <label htmlFor="stock-active" className="sr-only">Filtrer par activité du produit</label>
            <select id="stock-active" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as 'all' | 'active' | 'inactive')} className={inputClass}>
              <option value="all">Actifs et inactifs</option>
              <option value="active">Actifs uniquement</option>
              <option value="inactive">Inactifs uniquement</option>
            </select>

            <label htmlFor="stock-sort" className="sr-only">Trier le catalogue</label>
            <select id="stock-sort" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={inputClass}>
              <option value="name">Tri : nom</option>
              <option value="quantity">Tri : quantité (unités distinctes)</option>
              <option value="cost">Tri : coût unitaire</option>
            </select>

            {hasActiveFilters && <ResetFiltersButton onClick={resetFilters} />}
            <span className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium ml-auto tabular-nums">
              {filteredProducts.length} produit(s)
            </span>
          </div>

          {products.length === 0 ? (
            <EmptyState
              title="Aucun produit au catalogue"
              description="Ajoutez votre premier produit (lessive, cintres, housses…) pour commencer le suivi du stock."
              action={
                <button
                  type="button"
                  onClick={openCreate}
                  className="bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  Ajouter un produit
                </button>
              }
            />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              title="Aucun résultat pour ces filtres"
              description="Aucun produit ne correspond à la recherche et aux filtres sélectionnés."
              action={<ResetFiltersButton onClick={resetFilters} />}
            />
          ) : (
            <>
              <Frame className="hidden md:block">
                <FramePanel className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Produit</TableHead>
                      <TableHead>Catégorie</TableHead>
                      <TableHead>Unité</TableHead>
                      <TableHead className="text-right">Stock actuel</TableHead>
                      <TableHead className="text-right">Seuil</TableHead>
                      <TableHead className="text-right">Dernier coût</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedProducts.map((product) => {
                      const status = getStockStatus(product.currentQuantity, product.alertThreshold);
                      return (
                        <TableRow
                          key={product.id}
                          onClick={() => setDetailProductId(product.id)}
                          className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/70 cursor-pointer transition-colors ${product.isActive ? '' : 'opacity-60'}`}
                        >
                          <TableCell className="px-4">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{product.name}</span>
                            <span className="block text-[11.5px] text-zinc-400 dark:text-zinc-500">{product.reference}{product.isActive ? '' : ' · désactivé'}</span>
                          </TableCell>
                          <TableCell className="text-zinc-600 dark:text-zinc-400">{product.category}</TableCell>
                          <TableCell className="text-zinc-600 dark:text-zinc-400">{product.unit}</TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {formatQuantity(product.currentQuantity, product.unit)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                            {formatQuantity(product.alertThreshold, product.unit)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                            {product.unitCostXof !== undefined ? formatFCFA(product.unitCostXof) : 'Non renseigné'}
                          </TableCell>
                          <TableCell>
                            <Badge size="sm" className={STOCK_STATUS_BADGE[status]}>{STOCK_STATUS_LABELS[status]}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{renderActions(product)}</TableCell>
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
                  total={filteredProducts.length}
                  label="produit(s)"
                  className="border-t border-zinc-200 dark:border-zinc-700"
                />
                </FramePanel>
              </Frame>

              <div className="md:hidden grid grid-cols-1 gap-3 p-3">
                {pagedProducts.map((product) => {
                  const status = getStockStatus(product.currentQuantity, product.alertThreshold);
                  return (
                    <div
                      key={product.id}
                      onClick={() => setDetailProductId(product.id)}
                      className={`border border-zinc-200 dark:border-zinc-700 rounded-xl p-3.5 bg-zinc-50/40 dark:bg-zinc-800/40 ${product.isActive ? '' : 'opacity-60'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-[14px] text-zinc-900 dark:text-zinc-100 truncate">{product.name}</p>
                          <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500">{product.reference} · {product.category}</p>
                        </div>
                        {renderActions(product)}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        <span className="font-black tabular-nums text-zinc-950 dark:text-zinc-50">{formatQuantity(product.currentQuantity, product.unit)}</span>
                        <span className="text-[11.5px] text-zinc-500 dark:text-zinc-400 tabular-nums">seuil {formatQuantity(product.alertThreshold, product.unit)}</span>
                        <Badge size="sm" className={`ml-auto ${STOCK_STATUS_BADGE[status]}`}>{STOCK_STATUS_LABELS[status]}</Badge>
                      </div>
                      <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 tabular-nums mt-1.5">
                        Dernier coût : {product.unitCostXof !== undefined ? `${formatFCFA(product.unitCostXof)} / ${product.unit}` : 'Non renseigné'}
                        {product.isActive ? '' : ' · désactivé'}
                      </p>
                    </div>
                  );
                })}
              </div>
              <TablePaginationFooter
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                total={filteredProducts.length}
                label="produit(s)"
                className="md:hidden border-t border-zinc-200 dark:border-zinc-700"
              />
            </>
          )}
        </div>
      )}

      {productFormOpen && <ProductFormModal product={editingProduct} onClose={() => setProductFormOpen(false)} />}

      {movementModal && (
        <StockMovementModal
          initialProductId={movementModal.productId}
          initialType={movementModal.type}
          onClose={() => setMovementModal(null)}
        />
      )}

      {detailProduct && (
        <ProductDetailPanel
          product={detailProduct}
          onClose={() => setDetailProductId(null)}
          onEdit={openEdit}
          onRecordMovement={(p) => setMovementModal({ productId: p.id })}
          onToggleActive={(p) => setToggleConfirm(p)}
        />
      )}

      {toggleConfirm && (
        <ConfirmModal
          title={toggleConfirm.isActive ? 'Désactiver ce produit ?' : 'Réactiver ce produit ?'}
          description={
            toggleConfirm.isActive ? (
              <>
                <strong>{toggleConfirm.name}</strong> ne sera plus proposé pour de nouveaux mouvements et
                ses alertes seront masquées. Son historique de mouvements reste intégralement conservé.
              </>
            ) : (
              <>
                <strong>{toggleConfirm.name}</strong> pourra de nouveau recevoir des mouvements et ses
                alertes réapparaîtront si le stock est sous le seuil.
              </>
            )
          }
          confirmLabel={toggleConfirm.isActive ? 'Oui, désactiver' : 'Oui, réactiver'}
          danger={toggleConfirm.isActive}
          onCancel={() => setToggleConfirm(null)}
          onConfirm={() => {
            setProductActive(toggleConfirm.id, !toggleConfirm.isActive);
            setToggleConfirm(null);
          }}
        />
      )}
    </div>
  );
};
