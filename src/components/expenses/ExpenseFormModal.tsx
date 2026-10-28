import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ModalShell } from '../common/ModalShell';
import { Expense, ExpenseFormData, ExpensePaymentMethod, EXPENSE_PAYMENT_LABELS } from '../../types';
import { isValidISODate, todayISO } from '../../lib/dates';
import { ReceiptText, Save } from 'lucide-react';

interface ExpenseFormModalProps {
  /** Dépense à modifier, ou null pour une création. */
  expense: Expense | null;
  onClose: () => void;
}

interface FormState {
  label: string;
  categoryId: string;
  amount: string;
  date: string;
  paymentMethod: ExpensePaymentMethod;
  supplier: string;
  reference: string;
  description: string;
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({ expense, onClose }) => {
  const { expenseCategories, addExpense, updateExpense } = useApp();
  const isEdit = expense !== null;

  // Catégories proposées : actives + celle déjà associée à la dépense en édition
  // (même désactivée, pour ne pas perdre le sens historique).
  const selectableCategories = useMemo(
    () =>
      expenseCategories.filter(
        (c) => c.isActive || (expense && c.id === expense.categoryId)
      ),
    [expenseCategories, expense]
  );

  const initial: FormState = useMemo(
    () => ({
      label: expense?.label ?? '',
      categoryId: expense?.categoryId ?? selectableCategories[0]?.id ?? '',
      amount: expense ? String(expense.amountXof) : '',
      date: expense?.date ?? todayISO(),
      paymentMethod: expense?.paymentMethod ?? 'cash',
      supplier: expense?.supplier ?? '',
      reference: expense?.reference ?? '',
      description: expense?.description ?? '',
    }),
    [expense, selectableCategories]
  );

  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);

  const validateField = (field: keyof FormState): string | undefined => {
    switch (field) {
      case 'label':
        return form.label.trim() ? undefined : 'Le libellé est obligatoire.';
      case 'categoryId':
        return form.categoryId && selectableCategories.some((c) => c.id === form.categoryId)
          ? undefined
          : 'Choisissez une catégorie.';
      case 'amount': {
        const raw = form.amount.trim().replace(/\s/g, '').replace(',', '.');
        if (!raw) return 'Le montant est obligatoire.';
        const value = Number(raw);
        if (isNaN(value)) return 'Montant non numérique.';
        if (value <= 0) return 'Le montant doit être strictement supérieur à zéro.';
        return undefined;
      }
      case 'date':
        return isValidISODate(form.date) ? undefined : 'La date est obligatoire et doit être valide.';
      default:
        return undefined;
    }
  };

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      // Revalide le champ corrigé avec sa nouvelle valeur.
      const probe = { ...form, [field]: value };
      let err: string | undefined;
      if (field === 'label') err = probe.label.trim() ? undefined : 'Le libellé est obligatoire.';
      else if (field === 'amount') {
        const raw = probe.amount.trim().replace(/\s/g, '').replace(',', '.');
        const v = Number(raw);
        err = !raw || isNaN(v) || v <= 0 ? 'Montant invalide (nombre > 0 attendu).' : undefined;
      } else if (field === 'date') err = isValidISODate(probe.date) ? undefined : 'Date invalide.';
      else if (field === 'categoryId') err = probe.categoryId ? undefined : 'Choisissez une catégorie.';
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // anti double-clic

    const nextErrors: Partial<Record<keyof FormState, string>> = {
      label: validateField('label'),
      categoryId: validateField('categoryId'),
      amount: validateField('amount'),
      date: validateField('date'),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return; // saisies conservées, formulaire ouvert

    const amountValue = Math.round(Number(form.amount.trim().replace(/\s/g, '').replace(',', '.')));
    const data: ExpenseFormData = {
      label: form.label.trim().replace(/\s+/g, ' '),
      categoryId: form.categoryId,
      amountXof: amountValue,
      date: form.date,
      paymentMethod: form.paymentMethod,
      supplier: form.supplier.trim() || undefined,
      reference: form.reference.trim() || undefined,
      description: form.description.trim() || undefined,
    };

    setIsSubmitting(true);
    if (isEdit) updateExpense(expense.id, data);
    else addExpense(data);
    setIsSubmitting(false);
    onClose();
  };

  const inputClass = (hasError: boolean) =>
    `w-full border rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 ${
      hasError ? 'border-red-400 focus:ring-red-500' : 'border-zinc-300 dark:border-zinc-600 focus:ring-zinc-900 dark:focus:ring-zinc-100'
    }`;
  const labelClass = 'block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1';
  const errorClass = 'text-[11.5px] text-red-600 dark:text-red-400 font-medium mt-1';

  return (
    <ModalShell
      title={isEdit ? 'Modifier une dépense' : 'Ajouter une dépense'}
      subtitle={isEdit ? expense.label : 'Nouvelle opération de dépense'}
      icon={<ReceiptText className="w-5 h-5 text-blue-400" />}
      onClose={onClose}
      isDirty={isDirty}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} noValidate className="p-5 space-y-3.5 text-[13px]">
        <div>
          <label htmlFor="exp-label" className={labelClass}>Libellé *</label>
          <input
            id="exp-label"
            type="text"
            value={form.label}
            onChange={(e) => setField('label', e.target.value)}
            placeholder="Ex : Facture électricité CIE"
            aria-invalid={Boolean(errors.label)}
            className={inputClass(Boolean(errors.label))}
          />
          {errors.label && <p className={errorClass}>{errors.label}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="exp-category" className={labelClass}>Catégorie *</label>
            <select
              id="exp-category"
              value={form.categoryId}
              onChange={(e) => setField('categoryId', e.target.value)}
              aria-invalid={Boolean(errors.categoryId)}
              className={inputClass(Boolean(errors.categoryId))}
            >
              {selectableCategories.length === 0 && <option value="">Aucune catégorie active</option>}
              {selectableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}{c.isActive ? '' : ' (désactivée — déjà associée)'}
                </option>
              ))}
            </select>
            {errors.categoryId && <p className={errorClass}>{errors.categoryId}</p>}
          </div>

          <div>
            <label htmlFor="exp-amount" className={labelClass}>Montant (FCFA) *</label>
            <input
              id="exp-amount"
              type="text"
              inputMode="numeric"
              value={form.amount}
              onChange={(e) => setField('amount', e.target.value)}
              placeholder="Ex : 15 000"
              aria-invalid={Boolean(errors.amount)}
              className={`${inputClass(Boolean(errors.amount))} tabular-nums`}
            />
            {errors.amount && <p className={errorClass}>{errors.amount}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="exp-date" className={labelClass}>Date *</label>
            <input
              id="exp-date"
              type="date"
              value={form.date}
              onChange={(e) => setField('date', e.target.value)}
              aria-invalid={Boolean(errors.date)}
              className={`${inputClass(Boolean(errors.date))} tabular-nums`}
            />
            {errors.date && <p className={errorClass}>{errors.date}</p>}
          </div>

          <div>
            <label htmlFor="exp-payment" className={labelClass}>Mode de paiement *</label>
            <select
              id="exp-payment"
              value={form.paymentMethod}
              onChange={(e) => setField('paymentMethod', e.target.value as ExpensePaymentMethod)}
              className={inputClass(false)}
            >
              {(Object.keys(EXPENSE_PAYMENT_LABELS) as ExpensePaymentMethod[]).map((m) => (
                <option key={m} value={m}>{EXPENSE_PAYMENT_LABELS[m]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="exp-supplier" className={labelClass}>Fournisseur / bénéficiaire</label>
            <input
              id="exp-supplier"
              type="text"
              value={form.supplier}
              onChange={(e) => setField('supplier', e.target.value)}
              placeholder="Optionnel"
              className={inputClass(false)}
            />
          </div>
          <div>
            <label htmlFor="exp-reference" className={labelClass}>Référence du reçu</label>
            <input
              id="exp-reference"
              type="text"
              value={form.reference}
              onChange={(e) => setField('reference', e.target.value)}
              placeholder="N° facture, reçu… (optionnel)"
              className={inputClass(false)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="exp-desc" className={labelClass}>Description</label>
          <textarea
            id="exp-desc"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={2}
            placeholder="Détail libre de la dépense…"
            className={inputClass(false)}
          />
        </div>

        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          * Champ obligatoire. Aucun justificatif n’est téléversé : conservez vos reçus papier et
          reportez leur référence ci-dessus. Donnée conservée localement dans ce navigateur.
        </p>

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
