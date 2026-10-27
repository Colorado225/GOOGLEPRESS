import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SlidePanel } from '../common/ModalShell';
import { InventoryProduct } from '../../types';
import { formatQuantity, getStockStatus, STOCK_STATUS_LABELS } from '../../lib/inventory';
import { formatISODateFr } from '../../lib/dates';
import { formatFCFA } from '../../data/demoData';
import { MOVEMENT_TYPE_BADGE, MOVEMENT_TYPE_LABELS, STOCK_STATUS_BADGE } from './inventoryLabels';
import { Pencil, ArrowDownUp, Ban, UserCheck } from 'lucide-react';

interface ProductDetailPanelProps {
  product: InventoryProduct;
  onClose: () => void;
  onEdit: (product: InventoryProduct) => void;
  onRecordMovement: (product: InventoryProduct) => void;
  onToggleActive: (product: InventoryProduct) => void;
}

export const ProductDetailPanel: React.FC<ProductDetailPanelProps> = ({
  product,
  onClose,
  onEdit,
  onRecordMovement,
  onToggleActive,
}) => {
  const { stockMovements } = useApp();

  const productMovements = useMemo(
    () =>
      stockMovements
        .filter((m) => m.productId === product.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [stockMovements, product.id]
  );

  const status = getStockStatus(product.currentQuantity, product.alertThreshold);
  const estimatedValue =
    product.unitCostXof !== undefined
      ? Math.round(product.currentQuantity * product.unitCostXof)
      : undefined;

  return (
    <SlidePanel title={product.name} subtitle={`Réf. ${product.reference} · ${product.category}`} onClose={onClose}>
      <section aria-label="Résumé du produit">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STOCK_STATUS_BADGE[status]}`}>
            {STOCK_STATUS_LABELS[status]}
          </span>
          {!product.isActive && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-zinc-100 text-zinc-500 border-zinc-200">
              Produit désactivé
            </span>
          )}
        </div>

        <p className="text-[26px] font-black tabular-nums tracking-tight text-zinc-950">
          {formatQuantity(product.currentQuantity, product.unit)}
          <span className="text-[12px] font-semibold text-zinc-400 ml-2">en stock</span>
        </p>

        <dl className="mt-3 space-y-1.5 text-[13px]">
          {([
            ['Seuil d’alerte', formatQuantity(product.alertThreshold, product.unit)],
            ['Unité', product.unit],
            ['Dernier coût d’achat', product.unitCostXof !== undefined ? `${formatFCFA(product.unitCostXof)} / ${product.unit}` : 'Non renseigné'],
            ['Valeur estimée du stock', estimatedValue !== undefined ? `${formatFCFA(estimatedValue)} (estimation au dernier coût)` : 'Non calculable (coût inconnu)'],
            ['Fournisseur', product.supplier ?? 'Non renseigné'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-zinc-50 pb-1">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="font-semibold text-zinc-900 text-right tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {product.description && (
          <p className="mt-3 bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-[12.5px] text-zinc-700 italic">
            « {product.description} »
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="inline-flex items-center gap-1.5 bg-[#09090b] hover:bg-zinc-800 text-white text-[12.5px] font-semibold rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <Pencil className="w-3.5 h-3.5" /> Modifier
          </button>
          <button
            type="button"
            onClick={() => onRecordMovement(product)}
            disabled={!product.isActive}
            title={product.isActive ? undefined : 'Réactivez le produit pour enregistrer un mouvement'}
            className="inline-flex items-center gap-1.5 border border-zinc-300 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-700 text-[12.5px] font-semibold rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <ArrowDownUp className="w-3.5 h-3.5" /> Mouvement
          </button>
          <button
            type="button"
            onClick={() => onToggleActive(product)}
            className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold rounded-lg px-3 py-2 transition-colors border focus:outline-none focus:ring-2 ${
              product.isActive
                ? 'border-red-300 text-red-700 hover:bg-red-50 focus:ring-red-600'
                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 focus:ring-emerald-600'
            }`}
          >
            {product.isActive ? <Ban className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
            {product.isActive ? 'Désactiver' : 'Réactiver'}
          </button>
        </div>
      </section>

      <section aria-label="Derniers mouvements du produit" className="border-t border-zinc-100 pt-4">
        <h4 className="font-bold text-[14px] text-zinc-900 mb-2">
          Derniers mouvements ({productMovements.length})
        </h4>
        {productMovements.length === 0 ? (
          <p className="text-[12.5px] text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg p-3">
            Aucun mouvement enregistré pour ce produit.
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {productMovements.slice(0, 15).map((m) => {
              const variation = m.quantityAfter - m.quantityBefore;
              return (
                <li key={m.id} className="border border-zinc-100 rounded-lg px-2.5 py-2 bg-zinc-50/50 text-[12.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular-nums text-zinc-600">{formatISODateFr(m.date)}</span>
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${MOVEMENT_TYPE_BADGE[m.type]}`}>
                      {MOVEMENT_TYPE_LABELS[m.type]}
                    </span>
                    <span className={`font-bold tabular-nums ${variation < 0 ? 'text-orange-700' : variation > 0 ? 'text-emerald-700' : 'text-zinc-500'}`}>
                      {variation > 0 ? '+' : ''}{formatQuantity(variation, product.unit)}
                    </span>
                    <span className="tabular-nums text-zinc-500">→ {formatQuantity(m.quantityAfter, product.unit)}</span>
                  </div>
                  <p className="text-zinc-500 mt-0.5 truncate" title={m.reason}>{m.reason}{m.note ? ` · ${m.note}` : ''}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </SlidePanel>
  );
};
