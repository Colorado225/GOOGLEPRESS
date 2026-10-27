import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { Pencil, Check, X, Plus, Ban, UserCheck } from 'lucide-react';
import { Badge } from '../common/DataTable';

/** Gestion des catégories de dépenses : ajout, renommage, activation/désactivation. */
export const ExpenseCategoriesSection: React.FC = () => {
  const {
    expenseCategories,
    expenses,
    addExpenseCategory,
    renameExpenseCategory,
    setExpenseCategoryActive,
  } = useApp();

  const [newLabel, setNewLabel] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const statsByCategory = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const e of expenses) {
      const current = map.get(e.categoryId) ?? { count: 0, total: 0 };
      current.count += 1;
      if (e.status === 'recorded') current.total += e.amountXof;
      map.set(e.categoryId, current);
    }
    return map;
  }, [expenses]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const result = addExpenseCategory(newLabel);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setAddError(null);
    setNewLabel('');
  };

  const submitRename = (id: string) => {
    const result = renameExpenseCategory(id, renameValue);
    if (!result.ok) {
      setRenameError(result.error);
      return;
    }
    setRenameError(null);
    setRenamingId(null);
  };

  return (
    <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden">
      <div className="p-3 border-b border-zinc-200">
        <form onSubmit={handleAdd} noValidate className="flex flex-wrap items-center gap-2">
          <label htmlFor="cat-new" className="text-[12.5px] font-bold text-zinc-700">
            Nouvelle catégorie
          </label>
          <input
            id="cat-new"
            type="text"
            value={newLabel}
            onChange={(e) => {
              setNewLabel(e.target.value);
              setAddError(null);
            }}
            placeholder="Ex : Carburant groupe électrogène"
            aria-invalid={Boolean(addError)}
            className="border border-zinc-200 rounded-lg px-3 py-1.5 text-[12.5px] w-72 max-w-full focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 bg-[#09090b] hover:bg-zinc-800 text-white text-[12.5px] font-semibold rounded-lg px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
          {addError && <p role="alert" className="text-[12px] text-red-600 font-medium">{addError}</p>}
        </form>
        <p className="text-[11px] text-zinc-400 mt-1.5">
          Les doublons sont refusés (comparaison sans casse ni espaces superflus). Renommer met à jour
          l’affichage partout ; les anciennes dépenses gardent leur catégorie d’origine.
        </p>
      </div>

      <ul className="divide-y divide-zinc-100">
        {expenseCategories.map((category) => {
          const stats = statsByCategory.get(category.id) ?? { count: 0, total: 0 };
          const isRenaming = renamingId === category.id;
          return (
            <li key={category.id} className={`flex flex-wrap items-center gap-2 px-3 py-2.5 ${category.isActive ? '' : 'opacity-60'}`}>
              {isRenaming ? (
                <span className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[240px]">
                  <label htmlFor={`cat-rename-${category.id}`} className="sr-only">Nouveau libellé</label>
                  <input
                    id={`cat-rename-${category.id}`}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename(category.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    autoFocus
                    aria-invalid={Boolean(renameError)}
                    className="border border-zinc-300 rounded-lg px-2.5 py-1.5 text-[12.5px] w-64 max-w-full focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  />
                  <button
                    type="button"
                    onClick={() => submitRename(category.id)}
                    aria-label="Valider le renommage"
                    className="p-2 bg-[#09090b] text-white rounded-lg hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(null);
                      setRenameError(null);
                    }}
                    aria-label="Annuler le renommage"
                    className="p-2 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {renameError && <span role="alert" className="text-[11.5px] text-red-600 font-medium">{renameError}</span>}
                </span>
              ) : (
                <span className="flex-1 min-w-[200px]">
                  <span className="font-bold text-[13.5px] text-zinc-900">{category.label}</span>
                  <span className="block text-[11.5px] text-zinc-500 tabular-nums">
                    {stats.count} dépense(s) liée(s)
                    {stats.total > 0 ? ` · ${formatFCFA(stats.total)} enregistrés (hors annulées)` : ' · aucun montant enregistré'}
                  </span>
                </span>
              )}

              <Badge
                size="sm"
                variant={category.isActive ? 'success' : 'secondary'}
                className={category.isActive ? 'bg-emerald-50' : 'bg-zinc-100 text-zinc-500'}
              >
                {category.isActive ? 'Active' : 'Désactivée'}
              </Badge>

              {!isRenaming && (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(category.id);
                      setRenameValue(category.label);
                      setRenameError(null);
                    }}
                    aria-label={`Renommer la catégorie ${category.label}`}
                    title="Renommer"
                    className="p-2 text-zinc-500 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseCategoryActive(category.id, !category.isActive)}
                    aria-label={category.isActive ? `Désactiver la catégorie ${category.label}` : `Réactiver la catégorie ${category.label}`}
                    title={category.isActive ? 'Désactiver pour les nouvelles saisies' : 'Réactiver'}
                    className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                      category.isActive
                        ? 'text-red-500 hover:bg-red-50 focus:ring-red-600'
                        : 'text-emerald-600 hover:bg-emerald-50 focus:ring-emerald-600'
                    }`}
                  >
                    {category.isActive ? <Ban className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
