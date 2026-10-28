import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Primitives de tableaux partagées par toute l'application, adaptées du motif
 * « Frame + Table + Badge + Avatar » (reui c-table-9) aux conventions maison :
 * jetons d'ombre de index.css, fusion de classes via cn() (les classes passées
 * par l'appelant gagnent sur les styles de base), impression neutralisée
 * (.ui-frame / .ui-frame-panel dans le bloc @media print).
 *
 * Exemple :
 *   <Frame>
 *     <FramePanel className="p-0">
 *       <Table>
 *         <TableHeader><TableRow><TableHead>Client</TableHead>…</TableRow></TableHeader>
 *         <TableBody>…</TableBody>
 *       </Table>
 *     </FramePanel>
 *   </Frame>
 */

/* ————————————————— Frame : cadre extérieur + panneaux ————————————————— */

export const Frame: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div
    className={cn('ui-frame space-y-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100/70 dark:bg-zinc-800/70 p-1.5 shadow-card', className)}
    {...props}
  >
    {children}
  </div>
);

export const FramePanel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div
    className={cn('ui-frame-panel overflow-hidden rounded-[10px] border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xs', className)}
    {...props}
  >
    {children}
  </div>
);

/* ————————————————— Table : structure ————————————————— */

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Classes du conteneur à défilement horizontal qui entoure le tableau. */
  wrapperClassName?: string;
}

export const Table: React.FC<TableProps> = ({ className, wrapperClassName, children, ...props }) => (
  <div className={cn('relative w-full overflow-x-auto', wrapperClassName)}>
    <table className={cn('w-full text-left text-[13px]', className)} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, children, ...props }) => (
  <thead className={cn('bg-zinc-50/80 dark:bg-zinc-800/80 [&_tr]:border-b [&_tr]:border-zinc-200 [&_tr]:hover:bg-transparent', className)} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, children, ...props }) => (
  <tbody className={cn('divide-y divide-zinc-100 dark:divide-zinc-800', className)} {...props}>
    {children}
  </tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className, children, ...props }) => (
  <tr className={cn('transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/70', className)} {...props}>
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className, children, ...props }) => (
  <th
    className={cn('px-3 py-2.5 align-middle text-[11px] font-bold uppercase tracking-wide whitespace-nowrap text-zinc-500 dark:text-zinc-400', className)}
    {...props}
  >
    {children}
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, children, ...props }) => (
  <td className={cn('px-3 py-2.5 align-middle', className)} {...props}>
    {children}
  </td>
);

/* ————————————————— Badge : statuts et étiquettes ————————————————— */

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'info'
  | 'warning'
  | 'destructive'
  | 'purple'
  | 'teal';

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950',
  secondary: 'border-zinc-200 dark:border-zinc-700 bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300',
  outline: 'border-zinc-300 dark:border-zinc-600 bg-transparent text-zinc-700 dark:text-zinc-300',
  success: 'border-emerald-200 dark:border-emerald-800 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
  info: 'border-blue-200 dark:border-blue-800 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  warning: 'border-amber-200 dark:border-amber-800 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200',
  destructive: 'border-red-200 dark:border-red-800 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
  purple: 'border-purple-200 dark:border-purple-800 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  teal: 'border-teal-200 dark:border-teal-800 bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'default';
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'secondary', size = 'default', className, children, ...props }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full border font-bold whitespace-nowrap',
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-[11.5px]',
      BADGE_VARIANTS[variant],
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

/* ————————————————— Avatar : photo ou initiales ————————————————— */

interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'default' | 'lg';
}

export const Avatar: React.FC<AvatarProps> = ({ size = 'default', className, children, ...props }) => (
  <span
    className={cn(
      'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-900 font-bold text-white shadow-xs ring-2 ring-white select-none',
      size === 'sm' ? 'h-8 w-8 text-[11px]' : size === 'lg' ? 'h-10 w-10 text-[13px]' : 'h-9 w-9 text-[12px]',
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

export const AvatarImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ className, alt = '', ...props }) => (
  <img className={cn('absolute inset-0 h-full w-full object-cover', className)} alt={alt} {...props} />
);

export const AvatarFallback: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className, children, ...props }) => (
  <span className={cn('flex h-full w-full items-center justify-center', className)} {...props}>
    {children}
  </span>
);

/* ————————————————— Pagination : navigation par pages ————————————————— */

interface TablePaginationProps {
  /** Page courante (1-indexée). */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Fenêtre de numéros affichés : tous jusqu'à 7 pages, sinon 1 … voisines … dernière. */
function pageWindow(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

/**
 * Pagination segmentée (même langage visuel que les onglets) : piste zinc,
 * page courante blanche en relief, Précédent/Suivant désactivés aux bornes.
 * Ne rend rien lorsqu'il n'y a qu'une seule page.
 */
export const TablePagination: React.FC<TablePaginationProps> = ({ page, pageCount, onPageChange, className }) => {
  if (pageCount <= 1) return null;
  const segment =
    'inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-bold tabular-nums transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 disabled:pointer-events-none disabled:opacity-40';
  const idle = 'text-zinc-600 dark:text-zinc-400 hover:bg-white/70 dark:hover:bg-zinc-900/70 hover:text-zinc-950 dark:hover:text-zinc-50';
  return (
    <nav
      aria-label="Pagination du tableau"
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-0.5 shadow-[inset_0_1px_2px_rgb(9_9_11/0.05)]',
        className,
      )}
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Page précédente"
        title="Page précédente"
        className={cn(segment, idle)}
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Précédent</span>
      </button>
      {pageWindow(page, pageCount).map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-[12px] text-zinc-400 dark:text-zinc-500" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Page ${p}`}
            onClick={() => onPageChange(p)}
            className={cn(segment, 'min-w-8', p === page ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-zinc-50 shadow-sm' : idle)}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        aria-label="Page suivante"
        title="Page suivante"
        className={cn(segment, idle)}
      >
        <span className="hidden sm:inline">Suivant</span>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </nav>
  );
};

interface TablePaginationFooterProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Bornes 1-indexées des éléments affichés (rangeStart = 0 si vide). */
  rangeStart: number;
  rangeEnd: number;
  total: number;
  /** Libellé des éléments comptés, ex. « commande(s) ». */
  label: string;
  className?: string;
}

/**
 * Pied de tableau paginé : compteur réel (« Affichage de X à Y sur Z … »,
 * annoncé en aria-live) + navigation par pages. À placer sous le tableau
 * dans le même panneau. Les totaux portent toujours sur la liste complète,
 * seule la page courante est affichée (voir lib/pagination.ts).
 */
export const TablePaginationFooter: React.FC<TablePaginationFooterProps> = ({
  page,
  pageCount,
  onPageChange,
  rangeStart,
  rangeEnd,
  total,
  label,
  className,
}) => (
  <div className={cn('flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4', className)}>
    <p aria-live="polite" className="text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
      {total === 0
        ? 'Aucun résultat'
        : `Affichage de ${rangeStart} à ${rangeEnd} sur ${total} ${label} · Page ${page} sur ${pageCount}`}
    </p>
    <TablePagination page={page} pageCount={pageCount} onPageChange={onPageChange} />
  </div>
);
