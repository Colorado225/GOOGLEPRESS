import React, { useEffect, useRef, useState } from 'react';
import { ABIDJAN_CENTER, DEFAULT_MAP_ZOOM } from '../../lib/geo';

/**
 * Carte des tournées — Leaflet + tuiles OpenStreetMap.
 *
 * Trois précautions :
 * 1. **Aucune clé, aucun compte** : Leaflet est une bibliothèque libre et les
 *    tuiles OSM sont gratuites, avec attribution obligatoire (affichée).
 * 2. **Jamais rendue côté serveur** : Leaflet touche `window` au chargement,
 *    il est donc importé dynamiquement dans un effet, uniquement dans le
 *    navigateur. Le rendu SSR ne voit qu'un conteneur vide.
 * 3. **Dégradation propre** : si Leaflet ou les tuiles ne chargent pas (réseau
 *    coupé), la carte affiche un message et la liste des tournées reste la
 *    source d'information.
 */

type LeafletModule = typeof import('leaflet');

export interface TourMapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  detail?: string;
  kind: 'stop' | 'courier';
}

interface TourMapProps {
  markers: TourMapMarker[];
  /** Point en cours de choix (non enregistré), affiché en évidence. */
  selected?: { lat: number; lng: number } | null;
  center?: { lat: number; lng: number };
  zoom?: number;
  heightClass?: string;
  /** Fourni = la carte devient cliquable pour choisir un point. */
  onPick?: (point: { lat: number; lng: number }) => void;
  ariaLabel?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const TourMap: React.FC<TourMapProps> = ({
  markers,
  selected = null,
  center = ABIDJAN_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  heightClass = 'h-[320px]',
  onPick,
  ariaLabel = 'Carte des tournées',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const layersRef = useRef<import('leaflet').LayerGroup | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const [leaflet] = await Promise.all([
        import('leaflet'),
        // La feuille de style suit le même chemin que la bibliothèque : elle
        // n'est téléchargée que lorsqu'une carte est réellement affichée.
        import('leaflet/dist/leaflet.css'),
      ]);
      if (cancelled || !containerRef.current) return;
      // Leaflet est publié en CommonJS : selon le mode (dev pré-bundlé ou build
      // Rollup), le module arrive avec ou sans `default`.
      const mod = leaflet as unknown as LeafletModule & { default?: LeafletModule };
      const L = (mod.default ?? mod) as LeafletModule;
      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        scrollWheelZoom: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on('click', (event) => {
        onPickRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      layersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setStatus('ready');
      // Une taille correcte est calculée après l'insertion dans la page.
      window.setTimeout(() => map.invalidateSize(), 0);
    };

    boot().catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = null;
      leafletRef.current = null;
    };
    // La carte est créée une seule fois : les points sont redessinés ensuite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const layer = layersRef.current;
    if (!leaflet || !map || !layer || status !== 'ready') return;
    const L = leaflet;

    layer.clearLayers();
    const bounds: [number, number][] = [];

    markers.forEach((marker) => {
      const isCourier = marker.kind === 'courier';
      L.circleMarker([marker.lat, marker.lng], {
        radius: isCourier ? 8 : 7,
        weight: 2,
        color: '#ffffff',
        fillColor: isCourier ? '#2563eb' : '#0d9488',
        fillOpacity: 1,
      })
        .bindPopup(
          `<strong>${escapeHtml(marker.label)}</strong>${
            marker.detail ? `<br/>${escapeHtml(marker.detail)}` : ''
          }`
        )
        .addTo(layer);
      bounds.push([marker.lat, marker.lng]);
    });

    if (selected) {
      L.circleMarker([selected.lat, selected.lng], {
        radius: 10,
        weight: 3,
        color: '#f59e0b',
        fillColor: '#fbbf24',
        fillOpacity: 0.85,
      })
        .bindPopup('Point choisi')
        .addTo(layer);
      bounds.push([selected.lat, selected.lng]);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], Math.max(map.getZoom(), 14));
    }
  }, [markers, selected, status]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
      <div ref={containerRef} className={`${heightClass} w-full bg-zinc-100 dark:bg-zinc-800`} aria-label={ariaLabel} />
      {status !== 'ready' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-100/80 p-4 text-center text-[12.5px] text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300">
          {status === 'loading'
            ? 'Chargement de la carte…'
            : 'Carte indisponible hors ligne. Les tournées restent consultables dans la liste.'}
        </div>
      )}
    </div>
  );
};
