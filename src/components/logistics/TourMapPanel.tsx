import React from 'react';
import { Info, MapPin, TriangleAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TourMap, type TourMapMarker } from './TourMap';
import { formatPositionAge, isPositionFresh } from '../../lib/geo';
import type { LogisticsTask } from '../../types';

/**
 * Vue carte des tournées filtrées.
 *
 * On n'affiche que ce qui est utile sur une carte : les arrêts encore à faire
 * avec un point enregistré, et la position des coursiers en route. Les tournées
 * sans point restent visibles au-dessus, en texte, avec le rappel du geste à
 * faire (« Placer le point »).
 */
export const TourMapPanel: React.FC<{ tasks: LogisticsTask[] }> = ({ tasks }) => {
  const { courierPositions, shopSettings } = useApp();
  const gps = shopSettings.deliveryGps;
  const now = new Date();

  const openTasks = tasks.filter(
    (task) => task.status !== 'completed' && task.status !== 'cancelled'
  );
  const located = openTasks.filter((task) => task.destination);
  const missingPoint = openTasks.filter((task) => !task.destination);

  const markers: TourMapMarker[] = [];
  located.forEach((task) => {
    if (!task.destination) return;
    markers.push({
      id: `stop-${task.id}`,
      lat: task.destination.lat,
      lng: task.destination.lng,
      label: `${task.kind === 'pickup' ? 'Ramassage' : 'Livraison'} — ${task.customerName}`,
      detail: task.address,
      kind: 'stop',
    });
  });

  let staleCouriers = 0;
  openTasks
    .filter((task) => task.status === 'en_route')
    .forEach((task) => {
      const position = courierPositions[task.id];
      if (!position) return;
      if (!isPositionFresh(position, now, gps.maxAgeSeconds)) {
        staleCouriers += 1;
        return;
      }
      markers.push({
        id: `courier-${task.id}`,
        lat: position.lat,
        lng: position.lng,
        label: `Coursier — ${task.assignedEmployeeName ?? 'Non assigné'}`,
        detail: `${task.customerName} · position ${formatPositionAge(position, now)}`,
        kind: 'courier',
      });
    });

  return (
    <div className="space-y-2.5">
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xs">
        <TourMap markers={markers} heightClass="h-[420px]" ariaLabel="Carte des tournées du jour" />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-zinc-600 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-teal-600" aria-hidden="true" />
          Arrêt à faire ({located.length})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-white bg-blue-600" aria-hidden="true" />
          Coursier en route
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" aria-hidden="true" /> Carte Leaflet · tuiles OpenStreetMap
        </span>
      </div>

      {markers.length === 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Aucun point sur la carte pour le moment. Ouvrez une tournée puis « Placer le point » pour
          enregistrer l’adresse exacte.
        </p>
      )}

      {missingPoint.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {missingPoint.length} tournée(s) sans point sur la carte : elles utilisent uniquement
          l’adresse écrite pour l’itinéraire.
        </p>
      )}

      {staleCouriers > 0 && (
        <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
          {staleCouriers} position(s) ne sont plus actualisées : le coursier a peut-être fermé la
          page. Aucune heure d’arrivée n’est calculée pour ces tournées.
        </p>
      )}
    </div>
  );
};
