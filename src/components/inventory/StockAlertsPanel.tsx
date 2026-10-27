import React, { useState } from 'react';
import { InventoryProduct, StockStatus } from '../../types';
import { formatQuantity, getStockStatus, STOCK_STATUS_LABELS } from '../../lib/inventory';
import { STOCK_STATUS_BADGE } from './inventoryLabels';
import { EmptyState } from '../common/ModuleCommon';
import { AlertTriangle, OctagonAlert, ArrowDownUp, Eye } from 'lucide-react';

interface StockAlertsPanelProps {
  /** Produits déjà filtrés en alerte (lib/inventory.getAlertProducts), ruptures d'abord. */
  alerts: InventoryProduct[];
  onRecordEntry: (product: InventoryProduct) => void;
  onViewProduct: (product: InventoryProduct) => void;
}

export const StockAlertsPanel: React.FC<StockAlertsPanelProps> = ({ alerts, onRecordEntry, onViewProduct }) => {
  const [levelFilter, setLevelFilter] = useState<'all' | Extract<StockStatus, 'low' | 'out'>>('all');

  const visible = alerts.filter(
    (p) => levelFilter === 'all' || getStockStatus(p.currentQuantity, p.alertThreshold) === levelFilter
  );
  const outCount = alerts.filter((p) => getStockStatus(p.currentQuantity, p.alertThreshold) === 'out').length;
  const lowCount = alerts.length - outCount;

  if (alerts.length === 0) {
    return (
      <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs">
        <EmptyState
          title="Aucune alerte de stock"
          description="Tous les produits actifs sont au-dessus de leur seuil d'alerte. Les alertes apparaîtront ici dès qu'un stock passera sous son seuil ou en rupture."
        />
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden">
      <div className="p-3 border-b border-zinc-200 flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-bold text-zinc-900">
          {alerts.length} alerte(s) — {outCount} rupture(s), {lowCount} stock(s) faible(s)
        </p>
        <div className="ml-auto flex gap-1.5" role="group" aria-label="Filtrer par niveau d'alerte">
          {([
            ['all', 'Toutes'],
            ['out', 'Ruptures'],
            ['low', 'Faibles'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setLevelFilter(value)}
              aria-pressed={levelFilter === value}
              className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 ${
                levelFilter === value
                  ? 'bg-[#09090b] text-white'
                  : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 bg-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Aucune alerte de ce niveau"
          description="Aucun produit ne correspond au niveau d'alerte sélectionné."
        />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {visible.map((product) => {
            const status = getStockStatus(product.currentQuantity, product.alertThreshold);
            const isOut = status === 'out';
            return (
              <li
                key={product.id}
                className={`flex flex-wrap items-center gap-2 px-3 py-3 ${isOut ? 'bg-red-50/50' : ''}`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isOut ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`} aria-hidden="true">
                  {isOut ? <OctagonAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[13.5px] text-zinc-900 truncate">
                    {product.name} <span className="font-normal text-zinc-400 text-[11.5px]">{product.reference}</span>
                  </p>
                  <p className="text-[12px] text-zinc-600 tabular-nums">
                    Stock : <strong>{formatQuantity(product.currentQuantity, product.unit)}</strong>
                    {' · '}seuil d’alerte : {formatQuantity(product.alertThreshold, product.unit)}
                    {product.supplier ? ` · ${product.supplier}` : ''}
                  </p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STOCK_STATUS_BADGE[status]}`}>
                  {STOCK_STATUS_LABELS[status]}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onRecordEntry(product)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold bg-[#09090b] hover:bg-zinc-800 text-white rounded-lg px-2.5 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <ArrowDownUp className="w-3.5 h-3.5" /> Enregistrer une entrée
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewProduct(product)}
                    aria-label={`Voir le produit ${product.name}`}
                    className="p-2 border border-zinc-200 rounded-lg text-zinc-500 hover:text-black hover:bg-zinc-50 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
