import React, { useState } from 'react';
import { Crosshair, Loader2, MapPinned, Trash2 } from 'lucide-react';
import { ModalShell } from '../common/ModalShell';
import { TourMap } from './TourMap';
import { useApp } from '../../context/AppContext';
import { ABIDJAN_CENTER } from '../../lib/geo';
import type { LogisticsTask } from '../../types';

/**
 * Choix du point de livraison sur la carte.
 *
 * Pas de géocodage automatique : sur une adresse ivoirienne libre
 * (« Rue des Jardins, Cocody »), un service de géocodage se trompe souvent de
 * quartier. On préfère un clic au bon endroit, ou la position du téléphone de
 * l'équipe quand elle est sur place.
 */

interface DestinationPickerModalProps {
  task: LogisticsTask;
  onClose: () => void;
}

type PickedPoint = { lat: number; lng: number; source: 'manual' | 'device' };

export const DestinationPickerModal: React.FC<DestinationPickerModalProps> = ({ task, onClose }) => {
  const { setLogisticsTaskDestination, showToast } = useApp();
  const initial = task.destination
    ? { lat: task.destination.lat, lng: task.destination.lng, source: task.destination.source }
    : null;
  const [point, setPoint] = useState<PickedPoint | null>(initial);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moved =
    !initial || !point || initial.lat !== point.lat || initial.lng !== point.lng;

  const locate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Ce navigateur ne fournit pas la position. Choisissez le point sur la carte.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: 'device',
        });
        setLocating(false);
      },
      (geoError) => {
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? 'Position refusée. Autorisez la géolocalisation dans le navigateur, ou choisissez le point à la main.'
            : 'Position indisponible pour le moment. Choisissez le point sur la carte.'
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }
    );
  };

  const save = () => {
    if (!point) return;
    const result = setLogisticsTaskDestination(task.id, {
      lat: point.lat,
      lng: point.lng,
      source: point.source,
      recordedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  const remove = () => {
    const result = setLogisticsTaskDestination(task.id, null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    showToast('Point de livraison retiré.');
    onClose();
  };

  return (
    <ModalShell
      title="Point de livraison"
      subtitle={`${task.orderTicketNumber ?? 'Tournée'} • ${task.customerName}`}
      icon={<MapPinned className="h-5 w-5 text-teal-400" aria-hidden="true" />}
      onClose={onClose}
      isDirty={moved}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-3 p-5 text-[13px]">
        <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
          Placez le point exact sur la carte (portail, immeuble, repère). L’itinéraire du coursier et
          l’heure d’arrivée s’appuieront dessus ; sans point, seule l’adresse écrite est utilisée.
        </p>

        <TourMap
          markers={[]}
          selected={point}
          center={point ?? ABIDJAN_CENTER}
          zoom={point ? 15 : 12}
          heightClass="h-[300px]"
          onPick={(next) => {
            setPoint({ ...next, source: 'manual' });
            setError(null);
          }}
          ariaLabel="Carte de choix du point de livraison"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[12.5px] font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Crosshair className="h-4 w-4" aria-hidden="true" />
            )}
            Utiliser ma position
          </button>
          {task.destination && (
            <button
              type="button"
              onClick={remove}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-[12.5px] font-bold text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Retirer le point
            </button>
          )}
          <span className="ml-auto text-[11.5px] text-zinc-500 dark:text-zinc-400">
            {point
              ? `Point : ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
              : 'Aucun point choisi'}
          </span>
        </div>

        <p className="text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Les coordonnées restent dans ce navigateur, comme le reste du module logistique. Carte :
          Leaflet + tuiles OpenStreetMap (gratuites, attribution conservée).
        </p>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse justify-end gap-2 pt-1 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 px-4 py-2.5 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!point}
            className="rounded-xl bg-[#09090b] px-5 py-2.5 text-[13px] font-bold text-white shadow hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            Enregistrer le point
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
