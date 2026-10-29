import { useState } from 'react';
import type { NotifyFn } from './types';

export interface ToastStore {
  notificationToast: string | null;
  showToast: NotifyFn;
}

/**
 * Notification éphémère affichée en bas d'écran. Chaque message s'efface au
 * bout de 4 secondes, sauf s'il a déjà été remplacé par un suivant.
 */
export const useToast = (): ToastStore => {
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotificationToast(msg);
    setTimeout(() => {
      setNotificationToast((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  return { notificationToast, showToast };
};
