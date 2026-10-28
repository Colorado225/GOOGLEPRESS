import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ImagePlus, Info, Plus, Save, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { fileToGarmentImageDataUrl } from '../../lib/imageDownscale';
import {
  GARMENT_CATEGORIES,
  MAX_GARMENT_NAME_LENGTH,
  MAX_GARMENT_PRICE_XOF,
  buildGarmentId,
  getGarmentCatalog,
  validateCustomGarment,
} from '../../lib/garmentCatalog';
import { MAX_LOGO_FILE_BYTES } from '../../lib/shopIdentity';
import {
  MAX_PRESSING_SERVICES,
  MAX_PRESSING_PRICE_XOF,
  normalizePressingSettings,
  pressingPriceKey,
  validatePressingSettings,
} from '../../lib/pressing';
import type { CustomGarment, PressingSettings } from '../../types';

/**
 * Réglage des prestations du pressing.
 *
 * Deux choses s'y définissent :
 *
 * - les **types de prestation** (traitements) proposés au comptoir, avec leur
 *   nom modifiable ;
 * - le **prix de chaque vêtement pour chaque prestation**. Un prix laissé vide
 *   reprend le prix de base du catalogue (affiché en gris).
 *
 * « Express 24h » n'apparaît pas ici : ce n'est pas un traitement mais un type
 * de service qui double le montant des prestations.
 */
export const PressingSettingsSection: React.FC = () => {
  const { shopSettings, updateShopSettings, showToast } = useApp();
  const [draft, setDraft] = useState<PressingSettings>(shopSettings.pressing);
  const [error, setError] = useState<string | null>(null);

  // Catalogue réel : vêtements créés ici + catalogue fourni.
  const items = useMemo(
    () =>
      getGarmentCatalog(shopSettings).filter(
        (item) => item.serviceCategory === 'pressing' || item.serviceCategory === 'both'
      ),
    [shopSettings]
  );

  // --- Création d'un vêtement (nom, catégorie, prix de base, photo) ---
  const [garmentName, setGarmentName] = useState('');
  const [garmentCategory, setGarmentCategory] = useState<CustomGarment['category']>('all');
  const [garmentPrice, setGarmentPrice] = useState('');
  const [garmentImage, setGarmentImage] = useState<string | null>(null);
  const [garmentImageError, setGarmentImageError] = useState<string | null>(null);
  const [garmentImageBusy, setGarmentImageBusy] = useState(false);
  const [garmentError, setGarmentError] = useState<string | null>(null);
  const garmentImageRef = useRef<HTMLInputElement>(null);

  const patch = (updater: (current: PressingSettings) => PressingSettings) => {
    setError(null);
    setDraft((current) => updater(current));
  };

  const renameService = (serviceId: string, label: string) => {
    patch((current) => ({
      ...current,
      services: current.services.map((service) =>
        service.id === serviceId ? { ...service, label } : service
      ),
    }));
  };

  const addService = () => {
    patch((current) => {
      if (current.services.length >= MAX_PRESSING_SERVICES) return current;
      const used = new Set(current.services.map((service) => service.id));
      let index = current.services.length + 1;
      let id = `svc-${index}`;
      while (used.has(id)) {
        index += 1;
        id = `svc-${index}`;
      }
      return {
        ...current,
        services: [...current.services, { id, label: 'Nouvelle prestation' }],
      };
    });
  };

  const removeService = (serviceId: string) => {
    patch((current) => ({
      ...current,
      services: current.services.filter((service) => service.id !== serviceId),
    }));
  };

  const handleGarmentImage = async (file: File | null) => {
    if (!file) return;
    setGarmentImageError(null);
    setGarmentImageBusy(true);
    try {
      setGarmentImage(await fileToGarmentImageDataUrl(file));
    } catch (error) {
      setGarmentImageError(
        error instanceof Error ? error.message : 'Cette image n’a pas pu être lue.'
      );
    } finally {
      setGarmentImageBusy(false);
      if (garmentImageRef.current) garmentImageRef.current.value = '';
    }
  };

  const addGarment = () => {
    if (!garmentPrice.trim()) {
      setGarmentError('Indiquez le prix de base du vêtement.');
      return;
    }
    const price = Math.round(Number(garmentPrice.replace(/[\s\u00a0]/g, '')));
    const validationError = validateCustomGarment({
      name: garmentName,
      unitPrice: price,
      category: garmentCategory,
    });
    if (validationError) {
      setGarmentError(validationError);
      return;
    }

    const garment: CustomGarment = {
      id: buildGarmentId(garmentName, shopSettings.customGarments),
      name: garmentName.trim().replace(/\s+/g, ' '),
      category: garmentCategory,
      unitPrice: price,
      unitLabel: 'pièce',
      emoji: '👕',
      imageDataUrl: garmentImage,
    };

    updateShopSettings({
      ...shopSettings,
      customGarments: [garment, ...shopSettings.customGarments],
    });
    setGarmentName('');
    setGarmentPrice('');
    setGarmentImage(null);
    setGarmentCategory('all');
    setGarmentError(null);
    setGarmentImageError(null);
    showToast(`✓ ${garment.name} ajouté au catalogue`);
  };

  const removeGarment = (garment: CustomGarment) => {
    // Les prix saisis pour ce vêtement partent avec lui.
    const prices = { ...draft.prices };
    for (const key of Object.keys(prices)) {
      if (key.startsWith(`${garment.id}:`)) delete prices[key];
    }
    const nextDraft = { ...draft, prices };
    setDraft(nextDraft);
    updateShopSettings({
      ...shopSettings,
      customGarments: shopSettings.customGarments.filter((item) => item.id !== garment.id),
      pressing: nextDraft,
    });
    showToast(`${garment.name} retiré du catalogue`);
  };

  const setPrice = (itemId: string, serviceId: string, rawValue: string) => {
    const key = pressingPriceKey(itemId, serviceId);
    patch((current) => {
      const prices = { ...current.prices };
      if (rawValue.trim() === '') {
        delete prices[key];
        return { ...current, prices };
      }
      const numeric = Math.round(Number(rawValue.replace(/[\s\u00a0]/g, '')));
      if (!Number.isFinite(numeric) || numeric < 0) return current;
      prices[key] = Math.min(MAX_PRESSING_PRICE_XOF, numeric);
      return { ...current, prices };
    });
  };

  const save = () => {
    const normalized = normalizePressingSettings(draft);
    const validationError = validatePressingSettings(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }
    updateShopSettings({ ...shopSettings, pressing: normalized });
    setDraft(normalized);
    setError(null);
    showToast('✓ Prestations du pressing enregistrées');
  };

  const inputClass =
    'w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[13px] tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600';

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-5 shadow-2xs space-y-5 text-[13px]">
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <span className="text-blue-600 dark:text-blue-400" aria-hidden="true">
          🧴
        </span>
        <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100">
          Prestations du pressing
        </h2>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-[12px] leading-snug text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>Express 24h</strong> n’est pas une prestation : c’est un type de service choisi
          sur la commande, qui <strong>double le montant</strong> des prestations. Les traitements
          se règlent ici, vêtement par vêtement.
        </span>
      </p>

      {/* Types de prestation */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
            Types de prestation
          </h3>
          <button
            type="button"
            onClick={addService}
            disabled={draft.services.length >= MAX_PRESSING_SERVICES}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Ajouter une prestation
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {draft.services.map((service) => (
            <div key={service.id} className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`service-${service.id}`}>
                Nom de la prestation
              </label>
              <input
                id={`service-${service.id}`}
                type="text"
                value={service.label}
                maxLength={40}
                onChange={(event) => renameService(service.id, event.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeService(service.id)}
                disabled={draft.services.length <= 1}
                aria-label={`Supprimer la prestation ${service.label || 'sans nom'}`}
                title={
                  draft.services.length <= 1
                    ? 'Au moins une prestation est nécessaire'
                    : 'Supprimer cette prestation'
                }
                className="shrink-0 rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Création d'un vêtement */}
      <section className="space-y-2">
        <h3 className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
          Ajouter un vêtement au catalogue
        </h3>
        <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
          Nom, catégorie, prix de base et photo : le vêtement apparaît aussitôt au comptoir,
          avec sa vignette, et son prix peut être affiné par prestation dans le tableau
          ci-dessous.
        </p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="new-garment-name"
              className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              Nom du vêtement
            </label>
            <input
              id="new-garment-name"
              type="text"
              maxLength={MAX_GARMENT_NAME_LENGTH}
              value={garmentName}
              placeholder="Ex. Chemise en lin"
              onChange={(event) => {
                setGarmentName(event.target.value);
                setGarmentError(null);
              }}
              className={`${inputClass} mt-1`}
            />
          </div>

          <div>
            <label
              htmlFor="new-garment-category"
              className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              Catégorie
            </label>
            <select
              id="new-garment-category"
              value={garmentCategory}
              onChange={(event) =>
                setGarmentCategory(event.target.value as CustomGarment['category'])
              }
              className={`${inputClass} mt-1`}
            >
              {GARMENT_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="new-garment-price"
              className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              Prix de base (FCFA)
            </label>
            <input
              id="new-garment-price"
              type="number"
              min={0}
              max={MAX_GARMENT_PRICE_XOF}
              step={50}
              value={garmentPrice}
              placeholder="1500"
              onChange={(event) => {
                setGarmentPrice(event.target.value);
                setGarmentError(null);
              }}
              className={`${inputClass} mt-1`}
            />
          </div>

          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Photo (facultatif)
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                {garmentImage ? (
                  <img src={garmentImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden="true">👕</span>
                )}
              </span>
              <input
                ref={garmentImageRef}
                id="new-garment-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => void handleGarmentImage(event.target.files?.[0] ?? null)}
              />
              <label
                htmlFor="new-garment-image"
                aria-disabled={garmentImageBusy}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-[11.5px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 ${
                  garmentImageBusy ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                {garmentImageBusy ? 'Traitement…' : garmentImage ? 'Changer' : 'Choisir'}
              </label>
              {garmentImage && (
                <button
                  type="button"
                  onClick={() => setGarmentImage(null)}
                  className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                  aria-label="Retirer la photo"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="mt-1 text-[10.5px] text-zinc-500 dark:text-zinc-400">
              PNG, JPEG ou WebP — {Math.round(MAX_LOGO_FILE_BYTES / (1024 * 1024))} Mo maximum.
            </p>
          </div>
        </div>

        {garmentImageError && (
          <p role="alert" className="text-[11.5px] font-semibold text-red-600 dark:text-red-400">
            {garmentImageError}
          </p>
        )}
        {garmentError && (
          <p role="alert" className="text-[11.5px] font-semibold text-red-600 dark:text-red-400">
            {garmentError}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={addGarment}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[12px] font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Ajouter au catalogue
          </button>
        </div>

        {shopSettings.customGarments.length > 0 && (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {shopSettings.customGarments.map((garment) => (
              <li
                key={garment.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-700"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
                  {garment.imageDataUrl ? (
                    <img src={garment.imageDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden="true">{garment.emoji}</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100">
                    {garment.name}
                  </span>
                  <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                    {formatFCFA(garment.unitPrice)} •{' '}
                    {GARMENT_CATEGORIES.find((category) => category.id === garment.category)?.label}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeGarment(garment)}
                  aria-label={`Retirer ${garment.name} du catalogue`}
                  title="Retirer du catalogue"
                  className="shrink-0 rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Prix par vêtement */}
      <section className="space-y-2">
        <h3 className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
          Prix par vêtement
        </h3>
        <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
          Laissez une case vide pour utiliser le prix de base du catalogue (indiqué en gris).
        </p>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="w-full min-w-[620px] text-[12.5px]">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60">
              <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <th className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 font-bold dark:bg-zinc-800">
                  Vêtement
                </th>
                <th className="px-3 py-2 font-bold">Base</th>
                {draft.services.map((service) => (
                  <th key={service.id} className="px-3 py-2 font-bold">
                    {service.label || '—'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-semibold text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                  >
                    {item.name}
                  </th>
                  <td className="px-3 py-1.5 tabular-nums text-zinc-500 dark:text-zinc-400">
                    {formatFCFA(item.unitPrice)}
                  </td>
                  {draft.services.map((service) => {
                    const key = pressingPriceKey(item.id, service.id);
                    return (
                      <td key={service.id} className="px-2 py-1.5">
                        <label className="sr-only" htmlFor={`price-${key}`}>
                          Prix de {item.name} pour {service.label}
                        </label>
                        <input
                          id={`price-${key}`}
                          type="number"
                          min={0}
                          max={MAX_PRESSING_PRICE_XOF}
                          step={50}
                          value={draft.prices[key] ?? ''}
                          placeholder={String(item.unitPrice)}
                          onChange={(event) => setPrice(item.id, service.id, event.target.value)}
                          className={`${inputClass} w-24 pl-2.5 placeholder:text-zinc-400 dark:placeholder:text-zinc-600`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[12px] font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-blue-700"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Enregistrer les prestations
        </button>
      </div>
    </div>
  );
};
