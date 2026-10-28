import { useEffect, useState, type DependencyList } from 'react';

export interface Pagination<T> {
  /** Page courante (1-indexée), toujours ramenée dans les bornes valides. */
  page: number;
  pageCount: number;
  setPage: (page: number) => void;
  /** Éléments de la page courante. */
  pageItems: T[];
  /** Bornes 1-indexées affichées (« de X à Y sur Z ») ; rangeStart = 0 si vide. */
  rangeStart: number;
  rangeEnd: number;
  total: number;
}

/**
 * Pagination côté client pour les grands tableaux (Commandes, Clients,
 * Produits, Mouvements, Dépenses, Employés…).
 *
 * - Retour automatique à la page 1 dès qu'un filtre change (`resetDeps` :
 *   recherche, onglet, période, tri…).
 * - Page bornée : si la liste rétrécit (suppression du dernier élément d'une
 *   page, filtre plus strict), la page affichée est ramenée à la dernière
 *   page valide au lieu d'afficher un tableau vide.
 * - Les totaux/KPI/exports continuent de porter sur la liste complète :
 *   seul l'affichage est découpé (voir `TablePaginationFooter`).
 */
export function usePagination<T>(
  items: readonly T[],
  pageSize: number,
  resetDeps: DependencyList = [],
): Pagination<T> {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    // Les dépendances sont fournies par l'appelant (ses filtres).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = items.slice(startIndex, startIndex + pageSize);

  return {
    page: currentPage,
    pageCount,
    setPage,
    pageItems,
    rangeStart: total === 0 ? 0 : startIndex + 1,
    rangeEnd: startIndex + pageItems.length,
    total,
  };
}
