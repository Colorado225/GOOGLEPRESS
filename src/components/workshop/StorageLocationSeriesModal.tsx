import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ModalShell } from '../common/ModalShell';
import type { StorageZone } from '../../types';
import {
  STORAGE_ZONE_DESCRIPTIONS,
  STORAGE_ZONE_LABELS,
  buildStorageLocationSeries,
} from '../../lib/storage';

interface StorageLocationSeriesModalProps {
  onClose: () => void;
}

interface FormState {
  codePrefix: string;
  startNumber: string;
  count: string;
  labelTemplate: string;
  zone: StorageZone;
  capacityPackages: string;
  description: string;
  isActive: boolean;
}

const STORAGE_ZONES = Object.keys(STORAGE_ZONE_LABELS) as StorageZone[];

export const StorageLocationSeriesModal: React.FC<StorageLocationSeriesModalProps> = ({
  onClose,
}) => {
  const { storageLocations, shopSettings, createStorageLocationSeries } = useApp();

  const initial = useMemo<FormState>(
    () => ({
      codePrefix: 'B',
      startNumber: '1',
      count: '6',
      labelTemplate: 'Étagère {code}',
      zone: 'folded',
      capacityPackages: String(shopSettings.storageDefaultCapacityPackages),
      description: '',
      isActive: true,
    }),
    [shopSettings.storageDefaultCapacityPackages]
  );

  const [form, setForm] = useState<FormState>(initial);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const seriesInput = useMemo(
    () => ({
      codePrefix: form.codePrefix,
      startNumber: Number(form.startNumber),
      count: Number(form.count),
      labelTemplate: form.labelTemplate,
      zone: form.zone,
      capacityPackages: Number(form.capacityPackages),
      description: form.description || undefined,
      isActive: form.isActive,
    }),
    [form]
  );
  const preview = useMemo(
    () => buildStorageLocationSeries(seriesInput, storageLocations),
    [seriesInput, storageLocations]
  );

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);
  const previewCodes = preview.locations.map((location) => location.code);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSubmitError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (preview.error) {
      setSubmitError(preview.error);
      return;
    }

    setIsSubmitting(true);
    const result = createStorageLocationSeries(seriesInput);
    setIsSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    onClose();
  };

  const labelClass = 'block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1';
  const inputClass =
    'w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100';
  const helpClass = 'mt-1 text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400';

  return (
    <ModalShell
      title="Créer une série d’emplacements"
      subtitle="Reproduisez vos casiers numérotés en une seule fois"
      icon={<Layers className="w-5 h-5 text-teal-400" aria-hidden="true" />}
      onClose={onClose}
      isDirty={isDirty}
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={handleSubmit} noValidate className="p-5 space-y-3.5 text-[13px]">
        <p className="rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50/80 dark:bg-blue-950/70 px-3 py-2.5 text-[12.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          Exemple : préfixe <strong>B</strong>, premier numéro <strong>1</strong>, quantité{' '}
          <strong>12</strong> crée <strong>B-01 → B-12</strong>. La série est créée en bloc :
          si un seul code existe déjà, rien n’est ajouté.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="storage-series-prefix" className={labelClass}>
              Préfixe du code *
            </label>
            <input
              id="storage-series-prefix"
              type="text"
              value={form.codePrefix}
              onChange={(e) => setField('codePrefix', e.target.value.toUpperCase())}
              placeholder="B"
              autoComplete="off"
              className={`${inputClass} font-mono font-bold uppercase`}
            />
            <p className={helpClass}>B, RAYON-2, PORTANT…</p>
          </div>

          <div>
            <label htmlFor="storage-series-start" className={labelClass}>
              Premier numéro *
            </label>
            <input
              id="storage-series-start"
              type="number"
              min={0}
              max={9999}
              step={1}
              inputMode="numeric"
              value={form.startNumber}
              onChange={(e) => setField('startNumber', e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="storage-series-count" className={labelClass}>
              Quantité *
            </label>
            <input
              id="storage-series-count"
              type="number"
              min={1}
              max={50}
              step={1}
              inputMode="numeric"
              value={form.count}
              onChange={(e) => setField('count', e.target.value)}
              className={inputClass}
            />
            <p className={helpClass}>50 emplacements maximum par série.</p>
          </div>
        </div>

        <div>
          <label htmlFor="storage-series-label" className={labelClass}>
            Modèle de libellé *
          </label>
          <input
            id="storage-series-label"
            type="text"
            value={form.labelTemplate}
            onChange={(e) => setField('labelTemplate', e.target.value)}
            placeholder="Étagère {code} — casier {n}"
            className={inputClass}
          />
          <p className={helpClass}>
            Variables disponibles : <code>{'{code}'}</code> = B-01, <code>{'{nn}'}</code> = 01,{' '}
            <code>{'{n}'}</code> = 1.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="storage-series-zone" className={labelClass}>
              Type fonctionnel *
            </label>
            <select
              id="storage-series-zone"
              value={form.zone}
              onChange={(e) => setField('zone', e.target.value as StorageZone)}
              className={inputClass}
            >
              {STORAGE_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {STORAGE_ZONE_LABELS[zone]}
                </option>
              ))}
            </select>
            <p className={helpClass}>{STORAGE_ZONE_DESCRIPTIONS[form.zone]}</p>
          </div>

          <div>
            <label htmlFor="storage-series-capacity" className={labelClass}>
              Capacité de chacun *
            </label>
            <input
              id="storage-series-capacity"
              type="number"
              min={1}
              max={999}
              step={1}
              inputMode="numeric"
              value={form.capacityPackages}
              onChange={(e) => setField('capacityPackages', e.target.value)}
              className={inputClass}
            />
            <p className={helpClass}>En paquets/housses par emplacement.</p>
          </div>
        </div>

        <div>
          <label htmlFor="storage-series-description" className={labelClass}>
            Repère commun
          </label>
          <input
            id="storage-series-description"
            type="text"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Ex. mur de gauche, près du comptoir…"
            className={inputClass}
          />
        </div>

        <label
          htmlFor="storage-series-active"
          className="flex items-start gap-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 cursor-pointer"
        >
          <input
            id="storage-series-active"
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setField('isActive', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
          <span>
            <span className="block font-semibold text-zinc-900 dark:text-zinc-100">
              Emplacements utilisables immédiatement
            </span>
            <span className="block text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Décochez pour préparer le plan sans encore proposer ces casiers au rangement.
            </span>
          </span>
        </label>

        <div
          aria-live="polite"
          className={`rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed ${
            preview.error
              ? 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-200'
              : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-100'
          }`}
        >
          {preview.error ? (
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{preview.error}</span>
            </p>
          ) : (
            <>
              <p className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Aperçu : {previewCodes.length} emplacement(s) prêt(s) à créer
              </p>
              <p className="mt-1 font-mono text-[12px] font-bold">
                {previewCodes.slice(0, 8).join(' · ')}
                {previewCodes.length > 8 ? ` · … · ${previewCodes[previewCodes.length - 1]}` : ''}
              </p>
              {preview.locations[0] && (
                <p className="mt-0.5">Premier libellé : {preview.locations[0].label}</p>
              )}
            </>
          )}
        </div>

        {submitError && submitError !== preview.error && (
          <p role="alert" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 px-3 py-2 text-[12.5px] font-medium text-red-700 dark:text-red-300">
            {submitError}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3.5 py-2 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting || Boolean(preview.error)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 px-3.5 py-2 text-[13px] font-bold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            Créer la série
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
