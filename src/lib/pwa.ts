/**
 * PWA PressingPro : enregistrement du service worker (public/sw.js),
 * détection des mises à jour et invitation à l'installation.
 * La communication avec l'UI passe par des événements `window`
 * (toast de mise à jour dans App.tsx, carte d'installation dans Paramètres),
 * sans coupler ce module à React.
 */
export const PWA_UPDATE_EVENT = 'pressingpro:pwa-update';
export const PWA_INSTALLABLE_EVENT = 'pressingpro:pwa-installable';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

/** L'application tourne-t-elle en mode installé (fenêtre autonome) ? */
export function isRunningStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function canPromptInstall(): boolean {
  return deferredInstallPrompt !== null;
}

/** Affiche la boîte d'installation du navigateur ; retourne true si elle est acceptée. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) return false;
  await deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    deferredInstallPrompt = null;
    window.dispatchEvent(new Event(PWA_INSTALLABLE_EVENT));
    return true;
  }
  return false;
}

export function registerPwa(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(PWA_INSTALLABLE_EVENT));
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    window.dispatchEvent(new Event(PWA_INSTALLABLE_EVENT));
  });

  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new Event(PWA_UPDATE_EVENT));
            }
          });
        });
      })
      .catch(() => {
        // Service worker indisponible (contexte non sécurisé…) : l'application reste utilisable en ligne.
      });
  });
}
