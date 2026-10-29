import React from 'react';
import { AlertTriangle, CheckCircle2, Cloud, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatLongDateTime } from '../../lib/dates';

/**
 * Où vit le plan de rangement.
 *
 * Sur un compte réel, les casiers sont enregistrés dans la base et suivent les
 * appareils ; l'écran ne prétend jamais le contraire quand ce n'est pas le cas.
 */
export const StorageSyncBanner: React.FC = () => {
  const { workspace, storageSync, retryStorageSync, showToast } = useApp();

  if (workspace.mode !== 'live' || !workspace.shopId) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-[11.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Démonstration locale : le plan de rangement reste dans ce navigateur. Sur un compte réel,
          il est enregistré dans la base et partagé entre les appareils du pressing.
        </span>
      </p>
    );
  }

  if (storageSync.status === 'error') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 px-3 py-2 text-[11.5px] leading-relaxed text-red-900 dark:text-red-200"
      >
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1">
          <strong className="font-bold">Plan non enregistré dans la base.</strong>{' '}
          {storageSync.error ?? 'Enregistrement impossible pour le moment.'} Il reste conservé sur
          cet appareil.
        </span>
        <button
          type="button"
          onClick={() => {
            retryStorageSync();
            showToast('Nouvelle tentative d’enregistrement du plan de rangement…');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-red-950 px-2.5 py-1 text-[11.5px] font-bold text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Réessayer
        </button>
      </div>
    );
  }

  const label =
    storageSync.status === 'saving'
      ? 'Enregistrement du plan de rangement dans la base…'
      : storageSync.status === 'loading'
        ? 'Lecture du plan de rangement enregistré pour cette agence…'
        : `Plan de rangement enregistré dans la base${
            storageSync.savedAt ? ` · ${formatLongDateTime(new Date(storageSync.savedAt))}` : ''
          }.`;

  const tone =
    storageSync.status === 'saved'
      ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
      : 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200';

  return (
    <p
      aria-live="polite"
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed ${tone}`}
    >
      {storageSync.status === 'saved' ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{label}</span>
    </p>
  );
};
