import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { LogisticsTask } from '../../types';
import { INITIAL_LOGISTICS_TASKS } from '../../data/demoData';
import {
  LOGISTICS_TASKS_STORAGE_KEY,
  normalizeStoredLogisticsTask,
} from '../../lib/logistics';
import {
  COURIER_POSITIONS_STORAGE_KEY,
  normalizeCourierPositions,
  pruneCourierPositions,
  type CourierPositions,
} from '../../lib/courierPositions';
import {
  hasPersistedValue,
  loadPersistedState,
  persistState,
} from '../../lib/localPersistence';

export interface LogisticsDeps {
  storageKey: (name: string) => string;
  liveWorkspace: boolean;
}

export interface LogisticsStore {
  logisticsTasks: LogisticsTask[];
  setLogisticsTasks: Dispatch<SetStateAction<LogisticsTask[]>>;
  courierPositions: CourierPositions;
  setCourierPositions: Dispatch<SetStateAction<CourierPositions>>;
}

/**
 * Tournées de ramassage/livraison et dernières positions coursier connues.
 * État seul : le cycle de vie des tournées vit dans la fabrique d'actions
 * logistiques.
 */
export const useLogisticsStore = ({ storageKey, liveWorkspace }: LogisticsDeps): LogisticsStore => {
  // Tournées ramassage/livraison. Une première installation reçoit tous les
  // exemples fictifs. Sur un jeu de données antérieur à cette fonctionnalité,
  // on ne charge que les deux ramassages non convertis : ils ne dépendent
  // d'aucun total de commande déjà enregistré, contrairement aux exemples
  // liés à un ticket de démonstration.
  const [logisticsTasks, setLogisticsTasks] = useState<LogisticsTask[]>(() => {
    const saved = loadPersistedState<LogisticsTask[] | null>(
      storageKey(LOGISTICS_TASKS_STORAGE_KEY),
      null
    );
    if (saved) return saved.map(normalizeStoredLogisticsTask);
    // Espace réel : aucune tournée fictive, même sur un poste où la
    // démonstration a déjà été utilisée.
    if (liveWorkspace) return [];
    if (hasPersistedValue(storageKey('pressingpro_orders'))) {
      return INITIAL_LOGISTICS_TASKS.filter((task) => task.kind === 'pickup' && !task.orderId);
    }
    return INITIAL_LOGISTICS_TASKS;
  });

  const [courierPositions, setCourierPositions] = useState<CourierPositions>(() =>
    pruneCourierPositions(
      normalizeCourierPositions(
        loadPersistedState<CourierPositions | null>(
          storageKey(COURIER_POSITIONS_STORAGE_KEY),
          null
        )
      ),
      new Date()
    )
  );

  useEffect(() => {
    persistState(storageKey(LOGISTICS_TASKS_STORAGE_KEY), logisticsTasks);
  }, [logisticsTasks]);
  useEffect(() => {
    persistState(storageKey(COURIER_POSITIONS_STORAGE_KEY), courierPositions);
  }, [courierPositions]);

  return { logisticsTasks, setLogisticsTasks, courierPositions, setCourierPositions };
};
