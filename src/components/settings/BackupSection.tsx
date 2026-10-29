import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Badge } from '../common/DataTable';
import {
  createBackup,
  createBackupFileName,
  encryptBackup,
  getBackupSummary,
  getLastBackupExportedAt,
  markBackupExported,
  parseBackupFile,
  restoreBackup,
  type PressingProBackup,
} from '../../lib/backup';

const inputClassName =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-100 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400';

const primaryButtonClassName =
  'inline-flex items-center gap-2 rounded-lg bg-[#09090b] px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus:ring-zinc-100';

const secondaryButtonClassName =
  'inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-[13px] font-bold text-zinc-800 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:ring-zinc-100';

const formatExportDate = (iso: string | null): string => {
  if (!iso) return 'Non renseignée';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'Non renseignée'
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const readLastExportedAt = (): string | null => {
  try {
    return getLastBackupExportedAt();
  } catch {
    return null;
  }
};

/**
 * Export/import chiffré des données encore hébergées dans ce navigateur.
 * Ce n'est ni une synchronisation serveur ni une sauvegarde cloud automatique :
 * l'utilisateur choisit où conserver le fichier téléchargé.
 */
export const BackupSection: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [exportConfirmation, setExportConfirmation] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzedBackup, setAnalyzedBackup] = useState<PressingProBackup | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(readLastExportedAt);

  const currentState = useMemo(() => {
    void refreshKey;
    try {
      const backup = createBackup();
      return { backup, summary: getBackupSummary(backup), error: null as string | null };
    } catch (caught) {
      return {
        backup: null,
        summary: [],
        error: caught instanceof Error ? caught.message : 'Données locales illisibles.',
      };
    }
  }, [refreshKey]);

  const importedSummary = analyzedBackup ? getBackupSummary(analyzedBackup) : [];
  const exportIsOld =
    lastExportedAt !== null &&
    Date.now() - Date.parse(lastExportedAt) > 7 * 24 * 60 * 60 * 1000;

  const handleExport = async () => {
    if (exportBusy) return;
    setMessage(null);
    setError(null);

    if (exportPassphrase !== exportConfirmation) {
      setError('La phrase secrète et sa confirmation ne correspondent pas.');
      return;
    }

    setExportBusy(true);
    try {
      const backup = createBackup();
      const encrypted = await encryptBackup(backup, exportPassphrase);
      const blob = new Blob([JSON.stringify(encrypted, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = createBackupFileName(new Date(backup.exportedAt));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      markBackupExported(localStorage, backup.exportedAt);
      setLastExportedAt(backup.exportedAt);
      setExportPassphrase('');
      setExportConfirmation('');
      setMessage(
        'Export chiffré lancé. Conservez le fichier hors de cet appareil ; sans la phrase secrète, il ne pourra pas être relu.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Export impossible.');
    } finally {
      setExportBusy(false);
    }
  };

  const handleAnalyze = async () => {
    if (importBusy) return;
    setMessage(null);
    setError(null);
    setAnalyzedBackup(null);
    setRestoreConfirmed(false);

    if (!selectedFile) {
      setError('Choisissez d’abord un fichier de sauvegarde JSON.');
      return;
    }

    setImportBusy(true);
    try {
      const text = await selectedFile.text();
      const backup = await parseBackupFile(text, importPassphrase || undefined);
      setAnalyzedBackup(backup);
      setMessage('Sauvegarde analysée. Vérifiez son contenu avant toute restauration.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Analyse impossible.');
    } finally {
      setImportBusy(false);
    }
  };

  const handleRestore = () => {
    if (!analyzedBackup || !restoreConfirmed || importBusy) return;
    setMessage(null);
    setError(null);
    setImportBusy(true);

    try {
      restoreBackup(analyzedBackup);
      setImportPassphrase('');
      setImportBusy(false);
      setMessage(
        'Sauvegarde restaurée dans ce navigateur. Cliquez sur « Actualiser » dans l’en-tête quand vous souhaitez charger les données restaurées.'
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Restauration impossible.');
      setImportBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="backup-title"
      className="space-y-4 rounded-xl border border-zinc-200/90 bg-white p-5 text-[13px] shadow-2xs dark:border-zinc-700/90 dark:bg-zinc-900"
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault();
      }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800">
        <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <h2 id="backup-title" className="text-[14.5px] font-bold text-zinc-900 dark:text-zinc-100">
          Sauvegarde locale chiffrée
        </h2>
        <Badge variant="success" size="sm">
          AES-GCM
        </Badge>
      </div>

      <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
        Exportez les données encore conservées dans ce navigateur, puis gardez le fichier sur un
        support distinct (clé USB, cloud privé…). Cette sauvegarde manuelle ne synchronise rien et
        ne remplace pas le futur backend ; elle réduit le risque de perte si ce navigateur est
        effacé. Enregistrez d’abord les réglages modifiés dans les autres onglets.
      </p>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
          <dt className="text-[11.5px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
            Dernière exportation lancée depuis cet appareil
          </dt>
          <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
            {formatExportDate(lastExportedAt)}
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
          <dt className="text-[11.5px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
            Contenu actuel détecté
          </dt>
          <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
            {currentState.error
              ? 'Lecture impossible'
              : `${currentState.summary.filter((item) => item.present).length} groupe(s) présent(s) sur ${currentState.summary.length}`}
          </dd>
        </div>
      </dl>

      {(lastExportedAt === null || exportIsOld) && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {lastExportedAt === null
              ? 'Aucune exportation n’est mémorisée sur cet appareil. Créez une première sauvegarde avant de continuer à travailler uniquement en local.'
              : 'La dernière exportation mémorisée date de plus de 7 jours. Exportez une copie récente.'}
          </span>
        </p>
      )}

      {currentState.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
          {currentState.error}
        </p>
      )}

      {currentState.summary.length > 0 && (
        <details className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <summary className="cursor-pointer font-bold text-zinc-900 dark:text-zinc-100">
            Détail des données incluses
          </summary>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {currentState.summary.map((item) => (
              <li key={item.key} className="flex items-start justify-between gap-3 text-[12px]">
                <span className="text-zinc-600 dark:text-zinc-400">{item.label}</span>
                <strong className="text-right text-zinc-900 dark:text-zinc-100">{item.detail}</strong>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            className={`${secondaryButtonClassName} mt-3`}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Actualiser l’aperçu
          </button>
        </details>
      )}

      <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
          <Download className="h-4 w-4" aria-hidden="true" /> Exporter
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="backup-export-passphrase" className="mb-1 block text-[11.5px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
              Phrase secrète (8 caractères minimum)
            </label>
            <input
              id="backup-export-passphrase"
              type="password"
              autoComplete="new-password"
              value={exportPassphrase}
              onChange={(event) => setExportPassphrase(event.target.value)}
              disabled={exportBusy}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="backup-export-confirmation" className="mb-1 block text-[11.5px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
              Confirmer la phrase secrète
            </label>
            <input
              id="backup-export-confirmation"
              type="password"
              autoComplete="new-password"
              value={exportConfirmation}
              onChange={(event) => setExportConfirmation(event.target.value)}
              disabled={exportBusy}
              className={inputClassName}
            />
          </div>
        </div>
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>La phrase secrète n’est ni stockée ni récupérable par PressingPro. Notez-la séparément du fichier.</span>
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exportBusy || Boolean(currentState.error)}
          className={primaryButtonClassName}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exportBusy ? 'Chiffrement…' : 'Télécharger la sauvegarde chiffrée'}
        </button>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
          <Upload className="h-4 w-4" aria-hidden="true" /> Restaurer
        </h3>
        <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
          L’analyse ne modifie rien. La restauration, elle, remplace les données locales suivies par
          PressingPro puis recharge l’application. Exportez d’abord l’état actuel si vous voulez
          pouvoir revenir en arrière.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="backup-file" className="mb-1 block text-[11.5px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
              Fichier JSON de sauvegarde
            </label>
            <input
              id="backup-file"
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setAnalyzedBackup(null);
                setRestoreConfirmed(false);
              }}
              disabled={importBusy}
              className={inputClassName}
            />
            <p className="mt-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
              {selectedFile ? selectedFile.name : 'Aucun fichier sélectionné'}
            </p>
          </div>
          <div>
            <label htmlFor="backup-import-passphrase" className="mb-1 block text-[11.5px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
              Phrase secrète du fichier
            </label>
            <input
              id="backup-import-passphrase"
              type="password"
              autoComplete="current-password"
              value={importPassphrase}
              onChange={(event) => setImportPassphrase(event.target.value)}
              disabled={importBusy}
              className={inputClassName}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={importBusy || !selectedFile}
          className={secondaryButtonClassName}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          {importBusy ? 'Analyse…' : 'Analyser sans restaurer'}
        </button>

        {analyzedBackup && (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="flex items-start gap-2 font-semibold text-emerald-900 dark:text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Sauvegarde du {formatExportDate(analyzedBackup.exportedAt)}</span>
            </p>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {importedSummary.map((item) => (
                <li key={item.key} className="flex items-start justify-between gap-3 text-[12px]">
                  <span className="text-emerald-800 dark:text-emerald-300">{item.label}</span>
                  <strong className="text-right text-emerald-950 dark:text-emerald-100">{item.detail}</strong>
                </li>
              ))}
            </ul>
            <label className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-relaxed text-emerald-900 dark:text-emerald-100">
              <input
                type="checkbox"
                checked={restoreConfirmed}
                onChange={(event) => setRestoreConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-black"
              />
              <span>Je comprends que cette restauration remplacera les données locales de ce navigateur.</span>
            </label>
            <button
              type="button"
              onClick={handleRestore}
              disabled={importBusy || !restoreConfirmed}
              className={primaryButtonClassName}
            >
              Restaurer et recharger
            </button>
          </div>
        )}
      </div>

      {message && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] leading-relaxed text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
          {error}
        </p>
      )}
    </section>
  );
};
