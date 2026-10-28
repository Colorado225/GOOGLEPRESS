import { useEffect, useRef, useState } from 'react';
import { useApp, type ScreenId } from '../../context/AppContext';
import {
  ERP_NOT_FOUND_TITLE,
  erpPathForScreen,
  getErpScreenTitle,
  parseErpRoute,
} from '../../lib/routes';

export interface ErpRouteSync {
  /** Chemin demandé qui ne correspond à aucun écran (afficher « Page introuvable »). */
  unknownPath: string | null;
  /** Navigation explicite vers un écran (bouton de retour de la page introuvable). */
  goToScreen: (screen: ScreenId) => void;
}

/**
 * Synchronise l'écran ERP actif (`activeScreen` du contexte) avec l'URL :
 *
 * - **URL → écran** au chargement (lien profond, actualisation) et sur les
 *   boutons Précédent/Suivant du navigateur (`popstate`) ;
 * - **Écran → URL** lors des navigations internes existantes (barre
 *   latérale, raccourcis clavier, actions rapides), sans réécrire l'URL
 *   si elle désigne déjà l'écran actif — alias compris — afin de ne pas
 *   polluer l'historique ;
 * - un chemin inconnu n'est plus absorbé silencieusement : il est exposé
 *   via `unknownPath` pour afficher l'écran « Page introuvable ».
 *
 * Le titre du document suit l'écran affiché.
 */
export const useErpRouteSync = (): ErpRouteSync => {
  const { activeScreen, setActiveScreen } = useApp();
  const [unknownPath, setUnknownPath] = useState<string | null>(() =>
    parseErpRoute(window.location.pathname) === null
      ? window.location.pathname
      : null
  );
  const skipFirstPush = useRef(true);
  // Écran en cours d'application depuis l'URL : tant qu'il n'est pas
  // absorbé par l'état, le sens écran → URL reste silencieux (robuste y
  // compris face à un double montage type StrictMode).
  const pendingFromUrl = useRef<ScreenId | null>(null);

  useEffect(() => {
    const applyFromUrl = () => {
      const screen = parseErpRoute(window.location.pathname);
      if (screen) {
        pendingFromUrl.current = screen;
        setUnknownPath(null);
        setActiveScreen(screen);
      } else {
        pendingFromUrl.current = null;
        setUnknownPath(window.location.pathname);
      }
    };
    applyFromUrl();
    window.addEventListener('popstate', applyFromUrl);
    return () => window.removeEventListener('popstate', applyFromUrl);
  }, [setActiveScreen]);

  useEffect(() => {
    // Au premier rendu, seul le sens URL → écran s'applique : ne jamais
    // réécrire l'adresse demandée (notamment une route inconnue).
    if (skipFirstPush.current) {
      skipFirstPush.current = false;
      return;
    }
    if (pendingFromUrl.current !== null) {
      if (activeScreen === pendingFromUrl.current) {
        pendingFromUrl.current = null;
      }
      return;
    }
    if (parseErpRoute(window.location.pathname) === activeScreen) return;
    window.history.pushState({}, '', erpPathForScreen(activeScreen));
    setUnknownPath(null);
  }, [activeScreen]);

  useEffect(() => {
    document.title = unknownPath
      ? ERP_NOT_FOUND_TITLE
      : getErpScreenTitle(activeScreen);
  }, [activeScreen, unknownPath]);

  const goToScreen = (screen: ScreenId) => {
    setUnknownPath(null);
    setActiveScreen(screen);
    const canonicalPath = erpPathForScreen(screen);
    if (window.location.pathname !== canonicalPath) {
      window.history.pushState({}, '', canonicalPath);
    }
  };

  return { unknownPath, goToScreen };
};
