import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  ActionResult,
  Expense,
  ExpenseCategory,
  ExpenseFormData,
} from '../../types';
import {
  INITIAL_EXPENSES,
  INITIAL_EXPENSE_CATEGORIES,
} from '../../data/demoData';
import { normalizeText } from '../../lib/utils';
import { createLocalId as genId, loadPersistedState, persistState } from '../../lib/localPersistence';
import { nowISODateTime } from '../../lib/dates';
import type { NotifyFn } from './types';

export interface ExpensesDeps {
  storageKey: (name: string) => string;
  seedList: <T>(demoValue: readonly T[]) => T[];
  notify: NotifyFn;
}

export interface ExpensesStore {
  expenses: Expense[];
  setExpenses: Dispatch<SetStateAction<Expense[]>>;
  expenseCategories: ExpenseCategory[];
  setExpenseCategories: Dispatch<SetStateAction<ExpenseCategory[]>>;
  addExpense: (data: ExpenseFormData) => Expense;
  updateExpense: (id: string, data: ExpenseFormData) => boolean;
  cancelExpense: (id: string, reason: string) => void;
  addExpenseCategory: (label: string) => ActionResult;
  renameExpenseCategory: (id: string, label: string) => ActionResult;
  setExpenseCategoryActive: (id: string, isActive: boolean) => void;
}

/**
 * Module Dépenses : registre des charges et nomenclature des catégories.
 * Une dépense annulée reste dans le registre mais sort des totaux.
 */
export const useExpensesStore = ({
  storageKey,
  seedList,
  notify,
}: ExpensesDeps): ExpensesStore => {
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    loadPersistedState(storageKey('pressingpro_expenses'), seedList(INITIAL_EXPENSES))
  );
  // Catégories : nomenclature de paramétrage (et non des écritures), donc
  // conservée dans les deux modes ; la liste reste éditable dans Paramètres.
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(() =>
    loadPersistedState(storageKey('pressingpro_expense_categories'), [
      ...INITIAL_EXPENSE_CATEGORIES,
    ])
  );

  useEffect(() => {
    persistState(storageKey('pressingpro_expenses'), expenses);
  }, [expenses]);
  useEffect(() => {
    persistState(storageKey('pressingpro_expense_categories'), expenseCategories);
  }, [expenseCategories]);

  const addExpense = (data: ExpenseFormData): Expense => {
    const now = nowISODateTime();
    const expense: Expense = { ...data, id: genId('exp'), status: 'recorded', createdAt: now, updatedAt: now };
    setExpenses((prev) => [expense, ...prev]);
    notify('✓ Dépense enregistrée');
    return expense;
  };

  const updateExpense = (id: string, data: ExpenseFormData): boolean => {
    let found = false;
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        found = true;
        return { ...e, ...data, id: e.id, updatedAt: nowISODateTime() };
      })
    );
    if (found) notify('✓ Dépense mise à jour');
    return found;
  };

  const cancelExpense = (id: string, reason: string) => {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status: 'cancelled', cancellationReason: reason.trim(), updatedAt: nowISODateTime() }
          : e
      )
    );
    notify('Dépense annulée — exclue des totaux, conservée dans le registre');
  };

  const addExpenseCategory = (label: string): ActionResult => {
    const trimmed = label.trim();
    if (!trimmed) return { ok: false, error: 'Le libellé de la catégorie est obligatoire.' };
    if (expenseCategories.some((c) => normalizeText(c.label) === normalizeText(trimmed))) {
      return { ok: false, error: 'Une catégorie avec ce libellé existe déjà.' };
    }
    setExpenseCategories((prev) => [...prev, { id: genId('cat'), label: trimmed, isActive: true }]);
    notify(`✓ Catégorie ajoutée : ${trimmed}`);
    return { ok: true };
  };

  const renameExpenseCategory = (id: string, label: string): ActionResult => {
    const trimmed = label.trim();
    if (!trimmed) return { ok: false, error: 'Le libellé de la catégorie est obligatoire.' };
    if (expenseCategories.some((c) => c.id !== id && normalizeText(c.label) === normalizeText(trimmed))) {
      return { ok: false, error: 'Une catégorie avec ce libellé existe déjà.' };
    }
    setExpenseCategories((prev) => prev.map((c) => (c.id === id ? { ...c, label: trimmed } : c)));
    notify('✓ Catégorie renommée');
    return { ok: true };
  };

  const setExpenseCategoryActive = (id: string, isActive: boolean) => {
    setExpenseCategories((prev) => prev.map((c) => (c.id === id ? { ...c, isActive } : c)));
    notify(isActive ? 'Catégorie réactivée pour les nouvelles saisies' : 'Catégorie désactivée pour les nouvelles saisies');
  };

  return {
    expenses,
    setExpenses,
    expenseCategories,
    setExpenseCategories,
    addExpense,
    updateExpense,
    cancelExpense,
    addExpenseCategory,
    renameExpenseCategory,
    setExpenseCategoryActive,
  };
};
