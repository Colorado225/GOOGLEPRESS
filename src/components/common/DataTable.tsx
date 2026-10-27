import React from 'react';
import { cn } from '../../lib/utils';

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
    className={cn('ui-frame space-y-1.5 rounded-2xl border border-zinc-200 bg-zinc-100/70 p-1.5 shadow-card', className)}
    {...props}
  >
    {children}
  </div>
);

export const FramePanel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div
    className={cn('ui-frame-panel overflow-hidden rounded-[10px] border border-zinc-200 bg-white shadow-2xs', className)}
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
  <thead className={cn('bg-zinc-50/80 [&_tr]:border-b [&_tr]:border-zinc-200 [&_tr]:hover:bg-transparent', className)} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, children, ...props }) => (
  <tbody className={cn('divide-y divide-zinc-100', className)} {...props}>
    {children}
  </tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className, children, ...props }) => (
  <tr className={cn('transition-colors hover:bg-zinc-50/70', className)} {...props}>
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className, children, ...props }) => (
  <th
    className={cn('px-3 py-2.5 align-middle text-[11px] font-bold uppercase tracking-wide whitespace-nowrap text-zinc-500', className)}
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
  default: 'border-zinc-900 bg-zinc-900 text-white',
  secondary: 'border-zinc-200 bg-zinc-200/80 text-zinc-700',
  outline: 'border-zinc-300 bg-transparent text-zinc-700',
  success: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  info: 'border-blue-200 bg-blue-100 text-blue-700',
  warning: 'border-amber-200 bg-amber-100 text-amber-800',
  destructive: 'border-red-200 bg-red-100 text-red-700',
  purple: 'border-purple-200 bg-purple-100 text-purple-700',
  teal: 'border-teal-200 bg-teal-100 text-teal-700',
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
