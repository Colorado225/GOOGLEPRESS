import React from 'react';
import { useApp } from '../../context/AppContext';
import { SlidePanel } from '../common/ModalShell';
import { Badge } from '../common/DataTable';
import { Expense, EXPENSE_PAYMENT_LABELS } from '../../types';
import { formatISODateFr } from '../../lib/dates';
import { formatFCFA } from '../../data/demoData';
import { Pencil, Ban } from 'lucide-react';

interface ExpenseDetailPanelProps {
  expense: Expense;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onCancelExpense: (expense: Expense) => void;
}

export const ExpenseDetailPanel: React.FC<ExpenseDetailPanelProps> = ({
  expense,
  onClose,
  onEdit,
  onCancelExpense,
}) => {
  const { expenseCategories } = useApp();
  const category = expenseCategories.find((c) => c.id === expense.categoryId);
  const isCancelled = expense.status === 'cancelled';

  return (
    <SlidePanel title={expense.label} subtitle="Détail d’une dépense" onClose={onClose}>
      <section aria-label="Résumé de la dépense">
        <p className={`text-[26px] font-black tabular-nums tracking-tight ${isCancelled ? 'text-zinc-400 line-through' : 'text-zinc-950'}`}>
          {formatFCFA(expense.amountXof)}
        </p>
        <Badge
          size="sm"
          variant={isCancelled ? 'destructive' : 'success'}
          className={`mt-1 ${isCancelled ? 'bg-red-50' : 'bg-emerald-50'}`}
        >
          {isCancelled ? 'Annulée — exclue des totaux' : 'Enregistrée'}
        </Badge>

        <dl className="mt-4 space-y-1.5 text-[13px]">
          {([
            ['Date de la dépense', formatISODateFr(expense.date, true)],
            ['Catégorie', category ? category.label + (category.isActive ? '' : ' (catégorie désactivée)') : 'Catégorie introuvable'],
            ['Mode de paiement', EXPENSE_PAYMENT_LABELS[expense.paymentMethod]],
            ['Fournisseur / bénéficiaire', expense.supplier ?? 'Non renseigné'],
            ['Référence du reçu', expense.reference ?? 'Non renseigné'],
            ['Enregistrée le', expense.createdAt ? formatISODateFr(expense.createdAt.slice(0, 10), true) : 'Non renseigné'],
            ['Dernière modification', expense.updatedAt ? formatISODateFr(expense.updatedAt.slice(0, 10), true) : 'Non renseigné'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-zinc-50 pb-1">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="font-semibold text-zinc-900 text-right">{value}</dd>
            </div>
          ))}
        </dl>

        {expense.description && (
          <p className="mt-3 bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-[12.5px] text-zinc-700 italic">
            « {expense.description} »
          </p>
        )}

        {isCancelled && (
          <p className="mt-3 bg-red-50 border border-red-200 rounded-lg p-2.5 text-[12.5px] text-red-800">
            <strong>Motif d’annulation :</strong> {expense.cancellationReason ?? 'Non renseigné'}.
            Cette opération reste visible dans le registre pour garder l’historique compréhensible,
            mais elle n’est plus comptée dans les totaux ni les rapports.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {!isCancelled && (
            <>
              <button
                type="button"
                onClick={() => onEdit(expense)}
                className="inline-flex items-center gap-1.5 bg-[#09090b] hover:bg-zinc-800 text-white text-[12.5px] font-semibold rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
              >
                <Pencil className="w-3.5 h-3.5" /> Modifier
              </button>
              <button
                type="button"
                onClick={() => onCancelExpense(expense)}
                className="inline-flex items-center gap-1.5 border border-red-300 text-red-700 hover:bg-red-50 text-[12.5px] font-semibold rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <Ban className="w-3.5 h-3.5" /> Annuler la dépense…
              </button>
            </>
          )}
        </div>
        <p className="text-[11.5px] text-zinc-400 mt-3">
          Il n’y a pas de suppression définitive : une dépense erronée s’annule avec un motif,
          afin que les rapports passés restent explicables.
        </p>
      </section>
    </SlidePanel>
  );
};
