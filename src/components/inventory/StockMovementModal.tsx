import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ModalShell } from '../common/ModalShell';
import { StockMovementType } from '../../types';
import { computeMovement, formatQuantity, getStockStatus, STOCK_STATUS_LABELS } from '../../lib/inventory';
import { formatFCFA } from '../../data/demoData';
import { isValidISODate, todayISO } from '../../lib/dates';
import { MOVEMENT_REASONS, MOVEMENT_TYPE_LABELS, parseQuantityInput } from './inventoryLabels';
import { ArrowDownUp, Save } from 'lucide-react';

interface StockMovementModalProps {
  /** Produit présélectionné (depuis le catalogue ou une alerte), sinon premier produit actif. */
  initialProductId?: string;
  initialType?: StockMovementType;
  onClose: () => void;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  initialProductId,
  initialType = 'in',
  onClose,
}) => {
  const { products, recordStockMovement } = useApp();
  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const [productId, setProductId] = useState<string>(
    initialProductId && activeProducts.some((p) => p.id === initialProductId)
      ? initialProductId
      : activeProducts[0]?.id ?? ''
  );
  const [type, setType] = useState<StockMovementType>(initialType);
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const product = activeProducts.find((p) => p.id === productId);
  const qtyNumber = parseQuantityInput(quantity);

  const preview = useMemo(() => {
    if (!product || quantity.trim() === '' || isNaN(qtyNumber)) return null;
    return computeMovement(product.currentQuantity, type, qtyNumber);
  }, [product, type, quantity, qtyNumber]);

  const variation =
    preview && !preview.error ? preview.quantityAfter - preview.quantityBefore : null;

  const handleProductChange = (id: string) => {
    setProductId(id);
    const next = activeProducts.find((p) => p.id === id);
    if (next?.unitCostXof !== undefined) setUnitCost(String(next.unitCostXof));
    else setUnitCost('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // anti double-clic : une validation = un mouvement
    setFormError(null);

    if (!product) return setFormError('Choisissez un produit actif.');
    if (!isValidISODate(date)) return setFormError('La date du mouvement est invalide.');
    if (date > todayISO()) return setFormError('La date du mouvement ne peut pas être dans le futur.');
    if (quantity.trim() === '' || isNaN(qtyNumber)) return setFormError('Saisissez une quantité numérique (ex. 3 ou 2,5).');
    if (!reason.trim()) return setFormError('Le motif du mouvement est obligatoire.');
    if (type === 'in' && unitCost.trim() !== '') {
      const cost = parseQuantityInput(unitCost);
      if (isNaN(cost) || cost < 0) return setFormError('Coût unitaire invalide (montant FCFA ≥ 0, ou laissez vide).');
    }
    if (preview?.error) return setFormError(preview.error);

    setIsSubmitting(true);
    const result = recordStockMovement({
      productId: product.id,
      type,
      quantity: qtyNumber,
      date,
      reason,
      unitCostXof:
        type === 'in' && unitCost.trim() !== '' ? Math.round(parseQuantityInput(unitCost)) : undefined,
      note: note.trim() || undefined,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setFormError(result.error); // le formulaire reste ouvert, saisies conservées
      return;
    }
    onClose();
  };

  const inputClass =
    'w-full border border-zinc-300 rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900';
  const labelClass = 'block text-[11.5px] font-bold text-zinc-600 uppercase mb-1';

  return (
    <ModalShell
      title="Enregistrer un mouvement"
      subtitle="Entrée, sortie ou ajustement de stock"
      icon={<ArrowDownUp className="w-5 h-5 text-blue-400" />}
      onClose={onClose}
      isDirty={quantity !== '' || reason !== '' || note !== ''}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} noValidate className="p-5 space-y-3.5 text-[13px]">
        {formError && (
          <p role="alert" className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
            {formError}
          </p>
        )}

        <div>
          <label htmlFor="mov-product" className={labelClass}>Produit *</label>
          <select
            id="mov-product"
            value={productId}
            onChange={(e) => handleProductChange(e.target.value)}
            className={inputClass}
          >
            {activeProducts.length === 0 && <option value="">Aucun produit actif</option>}
            {activeProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.reference}) — stock {formatQuantity(p.currentQuantity, p.unit)}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-400 mt-1">Seuls les produits actifs peuvent recevoir un mouvement.</p>
        </div>

        <fieldset>
          <legend className={labelClass}>Type de mouvement *</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(MOVEMENT_TYPE_LABELS) as StockMovementType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={`py-2 rounded-lg border text-[12.5px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 ${
                  type === t
                    ? 'bg-[#09090b] text-white border-[#09090b]'
                    : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 bg-white'
                }`}
              >
                {MOVEMENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="mov-qty" className={labelClass}>
              {type === 'adjustment' ? 'Quantité constatée après inventaire *' : 'Quantité *'}
            </label>
            <div className="relative">
              <input
                id="mov-qty"
                type="text"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ex : 3 ou 2,5"
                className={`${inputClass} tabular-nums pr-12`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400 font-bold">
                {product?.unit ?? ''}
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="mov-date" className={labelClass}>Date *</label>
            <input
              id="mov-date"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
        </div>

        {/* Aperçu avant validation */}
        {product && (
          <div aria-live="polite" className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-[12.5px] space-y-1">
            <p className="font-bold text-zinc-900 text-[12px] uppercase tracking-wide">Aperçu du mouvement</p>
            <div className="flex justify-between tabular-nums">
              <span className="text-zinc-500">Stock avant</span>
              <span className="font-semibold">{formatQuantity(product.currentQuantity, product.unit)}</span>
            </div>
            <div className="flex justify-between tabular-nums">
              <span className="text-zinc-500">Variation</span>
              <span className={`font-semibold ${variation !== null && variation < 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                {variation === null
                  ? '—'
                  : `${variation > 0 ? '+' : ''}${formatQuantity(variation, product.unit)}`}
              </span>
            </div>
            <div className="flex justify-between tabular-nums border-t border-zinc-200 pt-1">
              <span className="text-zinc-500">Stock après</span>
              <span className="font-black text-zinc-950">
                {preview && !preview.error
                  ? `${formatQuantity(preview.quantityAfter, product.unit)} (${STOCK_STATUS_LABELS[getStockStatus(preview.quantityAfter, product.alertThreshold)]})`
                  : '—'}
              </span>
            </div>
            {preview?.error && <p role="alert" className="text-red-700 font-medium pt-1">{preview.error}</p>}
          </div>
        )}

        <div>
          <label htmlFor="mov-reason" className={labelClass}>Motif *</label>
          <input
            id="mov-reason"
            type="text"
            list="movement-reasons"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex : Consommation atelier"
            className={inputClass}
          />
          <datalist id="movement-reasons">
            {MOVEMENT_REASONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          {type === 'adjustment' && (
            <p className="text-[11px] text-amber-700 mt-1">Un ajustement exige un motif explicite (inventaire, casse…).</p>
          )}
        </div>

        {type === 'in' && (
          <div>
            <label htmlFor="mov-cost" className={labelClass}>Coût unitaire d’achat (FCFA, optionnel)</label>
            <input
              id="mov-cost"
              type="text"
              inputMode="numeric"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder={product?.unitCostXof !== undefined ? `Actuel : ${formatFCFA(product.unitCostXof)}` : 'Vide = inchangé / inconnu'}
              className={`${inputClass} tabular-nums`}
            />
            <p className="text-[11px] text-zinc-400 mt-1">Si renseigné, devient le dernier coût d’achat du produit.</p>
          </div>
        )}

        <div>
          <label htmlFor="mov-note" className={labelClass}>Commentaire (optionnel)</label>
          <input
            id="mov-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Précision libre…"
            className={inputClass}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-semibold rounded-lg py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting || activeProducts.length === 0}
            className="flex-1 bg-[#09090b] hover:bg-zinc-800 disabled:opacity-60 text-white font-bold rounded-lg py-2.5 shadow transition-colors flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Enregistrement…' : 'Valider le mouvement'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
