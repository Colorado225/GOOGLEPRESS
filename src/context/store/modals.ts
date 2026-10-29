import { useState, type Dispatch, type SetStateAction } from 'react';
import type { LaundryOrder } from '../../types';
import { isHomeDeliveryOrder } from '../../lib/logistics';

export interface ModalsDeps {
  /** Commandes lues au premier rendu pour la remise comptoir initiale. */
  orders: LaundryOrder[];
}

export interface SmsModalData {
  isOpen: boolean;
  order?: LaundryOrder;
  text?: string;
}

export interface ModalsStore {
  previewTicket: LaundryOrder | null;
  setPreviewTicket: (order: LaundryOrder | null) => void;
  closingZModalOpen: boolean;
  setClosingZModalOpen: (open: boolean) => void;
  newCustomerModalOpen: boolean;
  setNewCustomerModalOpen: (open: boolean) => void;
  smsModalData: SmsModalData | null;
  setSmsModalData: (data: SmsModalData | null) => void;
  activeHandoverOrder: LaundryOrder | null;
  setActiveHandoverOrder: (order: LaundryOrder | null) => void;
  shortcutHelpOpen: boolean;
  /** Bascule fonctionnelle utilisée par les raccourcis clavier (F9 / ?). */
  setShortcutHelpOpen: Dispatch<SetStateAction<boolean>>;
}

/**
 * Fenêtres et aperçu du ticket : états d'ouverture, commande remise au
 * comptoir et aide des raccourcis. Volontairement non persistés.
 */
export const useModals = ({ orders }: ModalsDeps): ModalsStore => {
  const [previewTicket, setPreviewTicket] = useState<LaundryOrder | null>(null);
  const [closingZModalOpen, setClosingZModalOpen] = useState(false);
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);
  const [smsModalData, setSmsModalData] = useState<SmsModalData | null>(null);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState<boolean>(false);

  // Active handover in workshop : uniquement une commande prête en retrait
  // comptoir (les livraisons à domicile passent par l'onglet Tournées).
  const [activeHandoverOrder, setActiveHandoverOrder] = useState<LaundryOrder | null>(() => {
    return orders.find((o) => o.status === 'ready' && !isHomeDeliveryOrder(o)) || null;
  });

  return {
    previewTicket,
    setPreviewTicket,
    closingZModalOpen,
    setClosingZModalOpen,
    newCustomerModalOpen,
    setNewCustomerModalOpen,
    smsModalData,
    setSmsModalData,
    activeHandoverOrder,
    setActiveHandoverOrder,
    shortcutHelpOpen,
    setShortcutHelpOpen,
  };
};
