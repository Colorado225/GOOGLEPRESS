import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { CashRegisterData, LaundryOrder } from '../../types';
import { INITIAL_CASH_REGISTER, INITIAL_ORDERS } from '../../data/demoData';
import { createEmptyCashRegister, normalizeCashRegister } from '../../lib/cashRegister';
import {
  TICKET_COUNTER_STORAGE_KEY as TICKET_COUNTER_KEY,
  loadPersistedState,
  loadPersistedString,
  parseTicketNumber,
  persistState,
  persistString,
} from '../../lib/localPersistence';

export interface OrdersDeps {
  storageKey: (name: string) => string;
  seedList: <T>(demoValue: readonly T[]) => T[];
  liveWorkspace: boolean;
}

export interface OrdersStore {
  orders: LaundryOrder[];
  setOrders: Dispatch<SetStateAction<LaundryOrder[]>>;
  nextTicketNumber: number;
  setNextTicketNumber: Dispatch<SetStateAction<number>>;
  cashRegister: CashRegisterData;
  setCashRegister: Dispatch<SetStateAction<CashRegisterData>>;
}

/**
 * Commandes, compteur séquentiel de tickets et caisse du jour. État seul :
 * les transitions (création, statuts, remises, livraisons) vivent dans les
 * fabriques d'actions.
 */
export const useOrdersStore = ({ storageKey, seedList, liveWorkspace }: OrdersDeps): OrdersStore => {
  const [orders, setOrders] = useState<LaundryOrder[]>(() =>
    loadPersistedState(storageKey('pressingpro_orders'), seedList(INITIAL_ORDERS))
  );

  // Caisse du jour : montants réels uniquement. Aucun objectif ni fond de
  // caisse d'exemple n'est repris sur un compte réel.
  const [cashRegister, setCashRegister] = useState<CashRegisterData>(() => {
    const fallback = liveWorkspace ? createEmptyCashRegister() : INITIAL_CASH_REGISTER;
    return normalizeCashRegister(
      loadPersistedState(storageKey('pressingpro_cash_register'), fallback),
      fallback
    );
  });

  useEffect(() => {
    persistState(storageKey('pressingpro_orders'), orders);
  }, [orders]);

  useEffect(() => {
    persistState(storageKey('pressingpro_cash_register'), cashRegister);
  }, [cashRegister]);

  // Compteur séquentiel de tickets, persisté dans localStorage.
  // Remplace l'ancienne formule fragile basée sur orders.length (qui
  // réattribuait des numéros dès qu'une commande disparaissait de la liste).
  // Initialisation : valeur sauvegardée si elle existe, sinon max des
  // tickets existants + 1 (migration transparente des anciennes données).
  const [nextTicketNumber, setNextTicketNumber] = useState<number>(() => {
    const fallback =
      orders.reduce((max, o) => Math.max(max, parseTicketNumber(o.ticketNumber)), 0) + 1;
    const saved = parseInt(loadPersistedString(storageKey(TICKET_COUNTER_KEY)) || '', 10);
    return Number.isNaN(saved) ? fallback : Math.max(saved, fallback);
  });

  useEffect(() => {
    persistString(storageKey(TICKET_COUNTER_KEY), String(nextTicketNumber));
  }, [nextTicketNumber]);

  return { orders, setOrders, nextTicketNumber, setNextTicketNumber, cashRegister, setCashRegister };
};
