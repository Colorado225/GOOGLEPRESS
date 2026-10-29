import React from 'react';
import { AlertTriangle, Cloud, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * Où vivent les réglages.
 *
 * Sur un compte réel, chaque enregistrement part vers la base et l'écran dit
 * franchement s'il est arrivé. Hors ligne ou sans agence rattachée, il ne
 * prétend pas le contraire : la copie locale reste, la synchronisation non.
 */
export const SettingsSyncStatus: React.FC = () => {
  const { workspace, settingsSync, retryShopSettingsSync, showToast } = useApp();

  if (workspace.mode !== 'live' || !workspace.shopId) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-[11.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        <Cloud className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Démonstration locale : les réglages restent dans ce navigateur.</span>
      </p>
    );
  }

  if (settingsSync.status === 'loading') {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-[11.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        <Cloud className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Lecture des réglages enregistrés pour cette agence…</span>
      </p>
    );
  }

  if (settingsSync.status === 'error') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-red-900 dark:text-red-200"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">
          <strong className="font-bold">Non enregistré dans la base.</strong>{' '}
          {settingsSync.error ?? 'Enregistrement impossible pour le moment.'} La configuration reste
          enregistrée sur cet appareil.
        </span>
        <button
          type="button"
          onClick={() => {
            retryShopSettingsSync();
            showToast('Nouvelle tentative d’enregistrement dans la base…');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-red-950 px-2.5 py-1 text-[11.5px] font-bold text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Réessayer
        </button>
      </div>
    );
  }

  if (settingsSync.status === 'saving') {
    return (
      <p
        aria-live="polite"
        className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50 px-3 py-2.5 text-[11.5px] leading-relaxed text-blue-900 dark:text-blue-200"
      >
        <Cloud className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Enregistrement dans la base de l’agence…</span>
      </p>
    );
  }

  // Succès : aucune ligne permanente. L'écran l'annonce déjà par un toast au
  // moment de l'enregistrement ; seul un avertissement mérite de rester.
  if (!settingsSync.warning) return null;

  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-900 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{settingsSync.warning}</span>
    </p>
  );
};
