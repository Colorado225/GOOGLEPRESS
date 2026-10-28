import React, { useMemo, useState } from 'react';
import { MapPin, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ModalShell } from '../common/ModalShell';
import type { StorageLocation, StorageZone } from '../../types';
import {
  STORAGE_ZONE_DESCRIPTIONS,
  STORAGE_ZONE_LABELS,
  isValidStorageCode,
  normalizeStorageCode,
} from '../../lib/storage';

interface StorageLocationFormModalProps {
  /** null = nouvel emplacement ; objet = adaptation du plan existant. */
  location: StorageLocation | null;
  onClose: () => void;
}

interface FormState {
  code: string;
  label: string;
  zone: StorageZone;
  capacityPackages: string;
  description: string;
  isActive: boolean;
}

const STORAGE_ZONES = Object.keys(STORAGE_ZONE_LABELS) as StorageZone[];

export const StorageLocationFormModal: React.FC<StorageLocationFormModalProps> = ({
  location,
  onClose,
}) => {
  const { storageLocations, createStorageLocation, updateStorageLocation } = useApp();
  const isEdit = location !== null;

  const initial = useMemo<FormState>(
    () => ({
      code: location?.code ?? '',
      label: location?.label ?? '',
      zone: location?.zone ?? 'folded',
      capacityPackages: location ? String(location.capacityPackages) : '20',
      description: location?.description ?? '',
      isActive: location?.isActive ?? true,
    }),
    [location]
  );

  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitError(null);
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    const code = normalizeStorageCode(form.code);
    if (!isValidStorageCode(code)) {
      next.code = 'Code de 2 à 16 lettres/chiffres, ex. A-01 ou B-12.';
    } else if (
      storageLocations.some(
        (item) => item.id !== location?.id && normalizeStorageCode(item.code) === code
      )
    ) {
      next.code = `Le code ${code} est déjà utilisé.`;
    }
    if (!form.label.trim()) next.label = 'Le libellé est obligatoire.';
    const capacity = Number(form.capacityPackages);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 999) {
      next.capacityPackages = 'Capacité entière entre 1 et 999 paquets.';
    }
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !validate()) return;
    setIsSubmitting(true);

    const data = {
      code: normalizeStorageCode(form.code),
      label: form.label,
      zone: form.zone,
      capacityPackages: Number(form.capacityPackages),
      description: form.description || undefined,
      isActive: form.isActive,
    };
    const result = isEdit
      ? updateStorageLocation(location.id, data)
      : createStorageLocation(data);
    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    onClose();
  };

  const inputClass = (hasError = false) =>
    `w-full border rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-400 focus:ring-red-500'
        : 'border-zinc-300 dark:border-zinc-600 focus:ring-zinc-900 dark:focus:ring-zinc-100'
    }`;
  const labelClass = 'block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1';
  const errorClass = 'text-[11.5px] text-red-600 dark:text-red-400 font-medium mt-1';

  return (
    <ModalShell
      title={isEdit ? 'Modifier l’emplacement' : 'Nouvel emplacement'}
      subtitle={isEdit ? `${location.code} • ${location.label}` : 'À reporter sur l’étiquette physique'}
      icon={<MapPin className="w-5 h-5 text-teal-400" aria-hidden="true" />}
      onClose={onClose}
      isDirty={isDirty}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} noValidate className="p-5 space-y-3.5 text-[13px]">
        <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
          <div>
            <label htmlFor="storage-location-code" className={labelClass}>
              Code physique *
            </label>
            <input
              id="storage-location-code"
              type="text"
              value={form.code}
              onChange={(e) => setField('code', e.target.value.toUpperCase())}
              placeholder="A-01"
              autoComplete="off"
              className={`${inputClass(Boolean(errors.code))} font-mono font-bold uppercase`}
              aria-invalid={Boolean(errors.code)}
            />
            {errors.code && <p className={errorClass}>{errors.code}</p>}
          </div>

          <div>
            <label htmlFor="storage-location-label" className={labelClass}>
              Libellé *
            </label>
            <input
              id="storage-location-label"
              type="text"
              value={form.label}
              onChange={(e) => setField('label', e.target.value)}
              placeholder="Ex. Portant près de la finition"
              className={inputClass(Boolean(errors.label))}
              aria-invalid={Boolean(errors.label)}
            />
            {errors.label && <p className={errorClass}>{errors.label}</p>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="storage-location-zone" className={labelClass}>
              Mode de rangement *
            </label>
            <select
              id="storage-location-zone"
              value={form.zone}
              onChange={(e) => setField('zone', e.target.value as StorageZone)}
              className={inputClass()}
            >
              {STORAGE_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {STORAGE_ZONE_LABELS[zone]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {STORAGE_ZONE_DESCRIPTIONS[form.zone]}
            </p>
          </div>

          <div>
            <label htmlFor="storage-location-capacity" className={labelClass}>
              Capacité indicative *
            </label>
            <input
              id="storage-location-capacity"
              type="number"
              min={1}
              max={999}
              step={1}
              inputMode="numeric"
              value={form.capacityPackages}
              onChange={(e) => setField('capacityPackages', e.target.value)}
              className={inputClass(Boolean(errors.capacityPackages))}
              aria-invalid={Boolean(errors.capacityPackages)}
            />
            <p className="mt-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
              En paquets/sacs. Elle sert à signaler la saturation, sans bloquer un rangement urgent.
            </p>
            {errors.capacityPackages && <p className={errorClass}>{errors.capacityPackages}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="storage-location-description" className={labelClass}>
            Repères / contenu prévu
          </label>
          <textarea
            id="storage-location-description"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            rows={3}
            placeholder="Ex. deuxième portant à droite de la table de finition, housses longues uniquement…"
            className={`${inputClass()} resize-y`}
          />
        </div>

        <label htmlFor="storage-location-active" className="flex items-start gap-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 cursor-pointer">
          <input
            id="storage-location-active"
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setField('isActive', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
          <span>
            <span className="block font-semibold text-zinc-900 dark:text-zinc-100">Emplacement utilisable</span>
            <span className="block text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Un emplacement désactivé n’apparaît plus dans les nouveaux rangements, mais son historique reste visible.
            </span>
          </span>
        </label>

        {isEdit && (
          <p className="text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Si le code ou le libellé change, les commandes déjà rangées seront resynchronisées automatiquement.
          </p>
        )}

        {submitError && (
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
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 dark:bg-zinc-100 px-3.5 py-2 text-[13px] font-bold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {isEdit ? 'Enregistrer l’emplacement' : 'Ajouter l’emplacement'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
