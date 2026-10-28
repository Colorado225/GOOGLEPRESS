import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ModalShell } from '../common/ModalShell';
import { InventoryProduct, PRODUCT_CATEGORIES, PRODUCT_UNITS, ProductFormData } from '../../types';
import { formatQuantity } from '../../lib/inventory';
import { todayISO } from '../../lib/dates';
import { parseQuantityInput, suggestReference } from './inventoryLabels';
import { PackagePlus, Save } from 'lucide-react';

interface ProductFormModalProps {
  /** Produit à modifier, ou null pour une création. */
  product: InventoryProduct | null;
  onClose: () => void;
}

interface FormState {
  name: string;
  reference: string;
  category: string;
  unit: string;
  alertThreshold: string;
  unitCost: string;
  supplier: string;
  description: string;
  isActive: boolean;
  initialQuantity: string;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({ product, onClose }) => {
  const { createProduct, updateProduct } = useApp();
  const isEdit = product !== null;

  const initial: FormState = useMemo(
    () => ({
      name: product?.name ?? '',
      reference: product?.reference ?? '',
      category: product?.category ?? '',
      unit: product?.unit ?? 'unité',
      alertThreshold: product ? String(product.alertThreshold) : '',
      unitCost: product?.unitCostXof !== undefined ? String(product.unitCostXof) : '',
      supplier: product?.supplier ?? '',
      description: product?.description ?? '',
      isActive: product?.isActive ?? true,
      initialQuantity: '',
    }),
    [product]
  );

  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = 'Le nom du produit est obligatoire.';
    if (!form.category.trim()) next.category = 'La catégorie est obligatoire.';
    if (!form.unit.trim()) next.unit = 'L’unité de mesure est obligatoire.';

    const threshold = parseQuantityInput(form.alertThreshold);
    if (form.alertThreshold.trim() === '' || isNaN(threshold)) next.alertThreshold = 'Seuil invalide (nombre attendu).';
    else if (threshold < 0) next.alertThreshold = 'Le seuil ne peut pas être négatif.';

    if (form.unitCost.trim() !== '') {
      const cost = parseQuantityInput(form.unitCost);
      if (isNaN(cost) || cost < 0) next.unitCost = 'Coût invalide (montant FCFA ≥ 0, ou laissez vide si inconnu).';
    }

    if (!isEdit && form.initialQuantity.trim() !== '') {
      const qty = parseQuantityInput(form.initialQuantity);
      if (isNaN(qty) || qty < 0) next.initialQuantity = 'Quantité initiale invalide (nombre ≥ 0).';
    }

    setErrors(next);
    return Object.values(next).every((v) => !v);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);
    if (!validate()) return;

    const reference = form.reference.trim() || suggestReference(form.name);
    if (!reference) {
      setErrors((prev) => ({ ...prev, reference: 'Référence introuvable : saisissez-la manuellement.' }));
      return;
    }

    const data: ProductFormData = {
      name: form.name.trim().replace(/\s+/g, ' '),
      reference,
      category: form.category.trim(),
      unit: form.unit.trim(),
      alertThreshold: parseQuantityInput(form.alertThreshold),
      // Champ vide = coût inconnu (undefined), jamais zéro silencieux.
      unitCostXof: form.unitCost.trim() === '' ? undefined : Math.round(parseQuantityInput(form.unitCost)),
      supplier: form.supplier.trim() || undefined,
      description: form.description.trim() || undefined,
      isActive: form.isActive,
    };

    setIsSubmitting(true);
    const result = isEdit
      ? updateProduct(product.id, data)
      : createProduct(
          data,
          form.initialQuantity.trim() === '' ? 0 : parseQuantityInput(form.initialQuantity),
          todayISO()
        );
    setIsSubmitting(false);

    if (!result.ok) {
      setFormError(result.error); // ex. référence en doublon : le formulaire reste ouvert
      return;
    }
    onClose();
  };

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const inputClass = (hasError: boolean) =>
    `w-full border rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 ${
      hasError ? 'border-red-400 focus:ring-red-500' : 'border-zinc-300 dark:border-zinc-600 focus:ring-zinc-900 dark:focus:ring-zinc-100'
    }`;
  const labelClass = 'block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1';
  const errorClass = 'text-[11.5px] text-red-600 dark:text-red-400 font-medium mt-1';

  return (
    <ModalShell
      title={isEdit ? 'Modifier un produit' : 'Ajouter un produit'}
      subtitle={isEdit ? `${product.name} · Réf. ${product.reference}` : 'Nouvelle référence de stock'}
      icon={<PackagePlus className="w-5 h-5 text-blue-400" />}
      onClose={onClose}
      isDirty={isDirty}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} noValidate className="p-5 space-y-3.5 text-[13px]">
        {formError && (
          <p role="alert" className="text-[12.5px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-2.5">
            {formError}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="prod-name" className={labelClass}>Nom *</label>
            <input
              id="prod-name"
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Ex : Lessive liquide 20 L"
              aria-invalid={Boolean(errors.name)}
              className={inputClass(Boolean(errors.name))}
            />
            {errors.name && <p className={errorClass}>{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="prod-ref" className={labelClass}>Référence</label>
            <input
              id="prod-ref"
              type="text"
              value={form.reference}
              onChange={(e) => setField('reference', e.target.value)}
              placeholder={form.name ? suggestReference(form.name) || 'Ex : LES-20L' : 'Générée si vide'}
              aria-invalid={Boolean(errors.reference)}
              className={inputClass(Boolean(errors.reference))}
            />
            {errors.reference ? (
              <p className={errorClass}>{errors.reference}</p>
            ) : (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">Unique dans le catalogue. Générée depuis le nom si laissée vide.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="prod-category" className={labelClass}>Catégorie *</label>
            <input
              id="prod-category"
              type="text"
              list="product-categories"
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
              placeholder="Choisir ou saisir…"
              aria-invalid={Boolean(errors.category)}
              className={inputClass(Boolean(errors.category))}
            />
            <datalist id="product-categories">
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {errors.category && <p className={errorClass}>{errors.category}</p>}
          </div>
          <div>
            <label htmlFor="prod-unit" className={labelClass}>Unité de mesure *</label>
            <input
              id="prod-unit"
              type="text"
              list="product-units"
              value={form.unit}
              onChange={(e) => setField('unit', e.target.value)}
              placeholder="L, kg, unité…"
              aria-invalid={Boolean(errors.unit)}
              className={inputClass(Boolean(errors.unit))}
            />
            <datalist id="product-units">
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            {errors.unit && <p className={errorClass}>{errors.unit}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="prod-threshold" className={labelClass}>Seuil d’alerte *</label>
            <input
              id="prod-threshold"
              type="text"
              inputMode="decimal"
              value={form.alertThreshold}
              onChange={(e) => setField('alertThreshold', e.target.value)}
              placeholder="Ex : 10"
              aria-invalid={Boolean(errors.alertThreshold)}
              className={`${inputClass(Boolean(errors.alertThreshold))} tabular-nums`}
            />
            {errors.alertThreshold && <p className={errorClass}>{errors.alertThreshold}</p>}
          </div>
          <div>
            <label htmlFor="prod-cost" className={labelClass}>Dernier coût d’achat (FCFA / unité)</label>
            <input
              id="prod-cost"
              type="text"
              inputMode="numeric"
              value={form.unitCost}
              onChange={(e) => setField('unitCost', e.target.value)}
              placeholder="Vide = inconnu"
              aria-invalid={Boolean(errors.unitCost)}
              className={`${inputClass(Boolean(errors.unitCost))} tabular-nums`}
            />
            {errors.unitCost && <p className={errorClass}>{errors.unitCost}</p>}
          </div>
        </div>

        {isEdit ? (
          <p className="text-[12px] text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5">
            Stock actuel : <strong className="tabular-nums">{formatQuantity(product.currentQuantity, product.unit)}</strong>.
            La quantité ne se modifie pas ici : utilisez « Enregistrer un mouvement » pour garder une trace.
          </p>
        ) : (
          <div>
            <label htmlFor="prod-initial" className={labelClass}>Quantité initiale en stock (optionnelle)</label>
            <input
              id="prod-initial"
              type="text"
              inputMode="decimal"
              value={form.initialQuantity}
              onChange={(e) => setField('initialQuantity', e.target.value)}
              placeholder="Ex : 20"
              aria-invalid={Boolean(errors.initialQuantity)}
              className={`${inputClass(Boolean(errors.initialQuantity))} tabular-nums`}
            />
            {errors.initialQuantity ? (
              <p className={errorClass}>{errors.initialQuantity}</p>
            ) : (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
                Si renseignée, un mouvement d’entrée « Stock initial » daté d’aujourd’hui sera créé dans l’historique.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="prod-supplier" className={labelClass}>Fournisseur (optionnel)</label>
            <input
              id="prod-supplier"
              type="text"
              value={form.supplier}
              onChange={(e) => setField('supplier', e.target.value)}
              placeholder="Ex : Siprochim CI"
              className={inputClass(false)}
            />
          </div>
          <div>
            <label htmlFor="prod-active" className={labelClass}>Statut</label>
            <select
              id="prod-active"
              value={form.isActive ? 'active' : 'inactive'}
              onChange={(e) => setField('isActive', e.target.value === 'active')}
              className={inputClass(false)}
            >
              <option value="active">Actif</option>
              <option value="inactive">Inactif (historique conservé)</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="prod-desc" className={labelClass}>Description (optionnelle)</label>
          <textarea
            id="prod-desc"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={2}
            placeholder="Usage, précautions, emplacement…"
            className={inputClass(false)}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-lg py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-[#09090b] dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-60 text-white dark:text-zinc-950 font-bold rounded-lg py-2.5 shadow transition-colors flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Enregistrement…' : 'Enregistrer'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
