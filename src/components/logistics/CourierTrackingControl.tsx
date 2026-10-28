import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed, LocateOff, MapPin } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { shouldRecordPosition } from '../../lib/courierPositions';
import { formatPositionAge } from '../../lib/geo';

/**
 * Partage ponctuel de la position du coursier.
 *
 * Le suivi n'est **jamais** implicite : il démarre sur un appui explicite, il
 * s'arrête quand le coursier appuie sur « Arrêter » ou quitte l'écran, et il
 * n'existe aucun suivi en arrière-plan (un onglet fermé ne remonte rien). C'est
 * la limite honnête du web, et la condition pour que les coursiers acceptent
 * l'outil.
 */

/** Un seul partage actif à la fois, même si plusieurs tournées sont en route. */
let activeWatch: { taskId: string; watchId: number } | null = null;

const stopWatch = () => {
  if (!activeWatch) return;
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(activeWatch.watchId);
  }
  activeWatch = null;
};

interface CourierTrackingControlProps {
  taskId: string;
  /** Réglage du propriétaire : autorise le partage depuis un téléphone. */
  allowed: boolean;
}

export const CourierTrackingControl: React.FC<CourierTrackingControlProps> = ({ taskId, allowed }) => {
  const { courierPositions, recordCourierPosition, showToast } = useApp();
  const [active, setActive] = useState(false);
  const positionsRef = useRef(courierPositions);
  positionsRef.current = courierPositions;
  const recordRef = useRef(recordCourierPosition);
  recordRef.current = recordCourierPosition;

  const position = courierPositions[taskId];

  useEffect(
    () => () => {
      // Quitter l'écran coupe le partage : aucun suivi résiduel.
      if (activeWatch?.taskId === taskId) stopWatch();
    },
    [taskId]
  );

  const stop = () => {
    if (activeWatch?.taskId === taskId) stopWatch();
    setActive(false);
  };

  const start = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Ce navigateur ne fournit pas de position. Le suivi GPS est indisponible ici.');
      return;
    }
    stopWatch();
    const watchId = navigator.geolocation.watchPosition(
      (measured) => {
        const point = {
          lat: measured.coords.latitude,
          lng: measured.coords.longitude,
          accuracyM: Number.isFinite(measured.coords.accuracy)
            ? Math.round(measured.coords.accuracy)
            : undefined,
          source: 'device' as const,
          recordedAt: new Date().toISOString(),
        };
        if (!shouldRecordPosition(positionsRef.current[taskId], point)) return;
        recordRef.current(taskId, point);
      },
      (error) => {
        showToast(
          error.code === error.PERMISSION_DENIED
            ? 'Position refusée. Autorisez la géolocalisation pour partager votre position.'
            : 'Position indisponible pour le moment. Réessayez à l’extérieur.'
        );
        if (activeWatch?.taskId === taskId) stopWatch();
        setActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }
    );
    activeWatch = { taskId, watchId };
    setActive(true);
  };

  if (!allowed) {
    return (
      <p className="text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        Le partage de position est désactivé. Le responsable peut l’autoriser dans Paramètres →
        Ramassage &amp; livraison.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {active ? (
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-[12px] font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <LocateOff className="h-3.5 w-3.5" aria-hidden="true" />
          Arrêter le partage
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-[12px] font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
        >
          <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
          Partager ma position
        </button>
      )}
      {position && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
          <MapPin className="h-3 w-3" aria-hidden="true" />
          {active ? 'Suivi actif' : 'Dernière position'} {formatPositionAge(position, new Date())}
          {position.accuracyM !== undefined ? ` · ±${position.accuracyM} m` : ''}
        </span>
      )}
      {active && (
        <span className="w-full text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Partage tant que cet écran reste ouvert. Aucune position n’est envoyée écran éteint.
        </span>
      )}
    </div>
  );
};
