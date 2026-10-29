import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { Customer } from '../../types';
import { INITIAL_CUSTOMERS } from '../../data/demoData';
import { loadPersistedState, persistState } from '../../lib/localPersistence';

export interface CustomersDeps {
  storageKey: (name: string) => string;
  seedList: <T>(demoValue: readonly T[]) => T[];
}

export interface CustomersStore {
  customers: Customer[];
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
}

/**
 * Fichier clients. État seul : les écritures croisées (création de commande,
 * encaissements, ramassages) vivent dans les fabriques d'actions, qui
 * reçoivent cet état en dépendance explicite.
 */
export const useCustomersStore = ({ storageKey, seedList }: CustomersDeps): CustomersStore => {
  const [customers, setCustomers] = useState<Customer[]>(() =>
    loadPersistedState(storageKey('pressingpro_customers'), seedList(INITIAL_CUSTOMERS))
  );

  useEffect(() => {
    persistState(storageKey('pressingpro_customers'), customers);
  }, [customers]);

  return { customers, setCustomers };
};
