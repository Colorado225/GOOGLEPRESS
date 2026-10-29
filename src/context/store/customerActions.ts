import type { Dispatch, SetStateAction } from 'react';
import type { Customer, LaundryOrder } from '../../types';
import type { NotifyFn } from './types';

export interface CustomerActionsDeps {
  orders: LaundryOrder[];
  setOrders: Dispatch<SetStateAction<LaundryOrder[]>>;
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  setSelectedCustomer: (customer: Customer) => void;
  setNewCustomerModalOpen: (open: boolean) => void;
  notify: NotifyFn;
}

export interface CustomerActions {
  addNewCustomer: (cust: Omit<Customer, 'id' | 'depositsCount' | 'balance'>) => Customer;
  markReadyOrdersAsNotifiedLocally: () => void;
}

/**
 * Écritures du fichier clients : création de fiche (qui devient aussitôt le
 * client actif du POS) et marquage local des commandes prêtes comme
 * notifiées — ce marquage ne prouve aucun SMS réellement envoyé.
 */
export const createCustomerActions = ({
  orders,
  setOrders,
  setCustomers,
  setSelectedCustomer,
  setNewCustomerModalOpen,
  notify,
}: CustomerActionsDeps): CustomerActions => {
  const addNewCustomer = (custData: Omit<Customer, 'id' | 'depositsCount' | 'balance'>): Customer => {
    const newCust: Customer = {
      ...custData,
      id: `cust-${Date.now()}`,
      depositsCount: 1,
      balance: 0,
    };
    setCustomers((prev) => [newCust, ...prev]);
    setSelectedCustomer(newCust);
    setNewCustomerModalOpen(false);
    notify(`✓ Fiche client créée pour ${newCust.name}`);
    return newCust;
  };

  const markReadyOrdersAsNotifiedLocally = () => {
    const readyOrders = orders.filter((o) => o.status === 'ready');
    const toMarkCount = readyOrders.filter((o) => !o.smsSent).length;

    if (toMarkCount > 0) {
      setOrders((prev) =>
        prev.map((o) => (o.status === 'ready' && !o.smsSent ? { ...o, smsSent: true } : o))
      );
      notify(
        `✓ ${toMarkCount} commande(s) prête(s) marquée(s) comme notifiée(s) dans l’application — aucun SMS externe envoyé.`
      );
      return;
    }

    notify(
      readyOrders.length > 0
        ? 'Toutes les commandes prêtes sont déjà marquées comme notifiées dans l’application.'
        : 'Aucune commande prête à marquer pour le moment.'
    );
  };

  return { addNewCustomer, markReadyOrdersAsNotifiedLocally };
};
