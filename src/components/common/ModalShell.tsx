import React, { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

/**
 * Coquilles d'overlay partagées par les nouveaux modules, reprenant le
 * langage visuel des modales existantes (en-tête sombre #09090b, coins
 * arrondis, animation discrète). Gestion d'Échap intégrée : si le
 * formulaire a des modifications non enregistrées (`isDirty`), la
 * fermeture demande d'abord confirmation.
 */

interface ModalShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  isDirty?: boolean;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export const ModalShell: React.FC<ModalShellProps> = ({
  title,
  subtitle,
  icon,
  onClose,
  isDirty = false,
  maxWidthClass = 'max-w-md',
  children,
}) => {
  const [confirmAbandonOpen, setConfirmAbandonOpen] = useState(false);

  const requestClose = () => {
    if (isDirty) setConfirmAbandonOpen(true);
    else onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (confirmAbandonOpen) setConfirmAbandonOpen(false);
        else requestClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, confirmAbandonOpen]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white rounded-2xl border border-zinc-200 shadow-2xl ${maxWidthClass} w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto`}
      >
        <div className="bg-[#09090b] text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <div className="min-w-0">
              <h3 className="font-bold text-[16px] leading-tight truncate">{title}</h3>
              {subtitle && <p className="text-[11.5px] text-zinc-400 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Fermer la fenêtre"
            className="text-zinc-400 hover:text-white transition-colors shrink-0 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>

      {confirmAbandonOpen && (
        <ConfirmModal
          title="Abandonner les modifications ?"
          description="Des informations saisies n'ont pas été enregistrées. Fermer sans enregistrer les perdra définitivement."
          confirmLabel="Oui, abandonner"
          cancelLabel="Continuer la saisie"
          danger
          onConfirm={onClose}
          onCancel={() => setConfirmAbandonOpen(false)}
        />
      )}
    </div>
  );
};

interface SlidePanelProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** Panneau latéral de détail (fiche employé, produit, dépense…). */
export const SlidePanel: React.FC<SlidePanelProps> = ({ title, subtitle, onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Évite que le gestionnaire global ferme en même temps une autre fenêtre.
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col"
      >
        <div className="bg-[#09090b] text-white px-5 py-4 flex items-center justify-between gap-3 sticky top-0 z-10">
          <div className="min-w-0">
            <h3 className="font-bold text-[16px] leading-tight truncate">{title}</h3>
            {subtitle && <p className="text-[11.5px] text-zinc-400 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le détail"
            className="text-zinc-400 hover:text-white transition-colors shrink-0 p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-5 flex-1">{children}</div>
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

/** Confirmation d'action sensible (désactivation, annulation, correction…). */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annuler',
  danger = false,
  onConfirm,
  onCancel,
  children,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-sm w-full p-5 space-y-3 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto ${danger ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-[16px] text-zinc-900 text-center">{title}</h3>
        <div className="text-[12.5px] text-zinc-500 text-center">{description}</div>
        {children}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-semibold py-2.5 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 text-white font-bold py-2.5 rounded-xl text-[13px] shadow focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              danger ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600' : 'bg-[#09090b] hover:bg-zinc-800 focus:ring-zinc-900'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
