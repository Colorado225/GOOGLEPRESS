import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { OrderLine } from '../../types';
import { loadPersistedState, persistState } from '../../lib/localPersistence';
import { POS_CART_STORAGE_KEY } from '../../lib/sessionPersistence';

export { POS_CART_STORAGE_KEY } from '../../lib/sessionPersistence';

export interface CartDeps {
  /** Isole le ticket en cours entre la démonstration et chaque organisation. */
  storageKey: (name: string) => string;
  /** Aucun article fictif dans une nouvelle session d'un espace réel. */
  liveWorkspace: boolean;
}

export interface CartStore {
  cartLines: OrderLine[];
  setCartLines: Dispatch<SetStateAction<OrderLine[]>>;
  selectedGarmentColor: string | undefined;
  setSelectedGarmentColor: (color: string | undefined) => void;
}

interface CartSnapshot {
  lines: OrderLine[];
  selectedGarmentColor: string | null;
}

// Panier initial de la maquette de démonstration. Il n'est utilisé que si
// aucun brouillon n'a encore été sauvegardé dans ce navigateur.
const createDefaultSnapshot = (liveWorkspace: boolean): CartSnapshot => ({
  lines: liveWorkspace ? [] : [
    {
      id: 'cl-1',
      clothingItemId: 'c1',
      name: 'Chemise',
      quantity: 3,
      unitPrice: 1500,
      subtotal: 4500,
      serviceType: 'Lavage + Repassage',
      color: 'Blanc',
      notes: 'Dont une rayée',
    },
    {
      id: 'cl-2',
      clothingItemId: 'c3',
      name: 'Boubou bazin',
      quantity: 1,
      unitPrice: 4500,
      subtotal: 4500,
      serviceType: 'Lavage délicat',
      color: 'Multicolore',
      notes: 'Brodé or • détachage inclus',
    },
  ],
  selectedGarmentColor: null,
});

const loadSnapshot = (key: string, liveWorkspace: boolean): CartSnapshot => {
  const fallback = createDefaultSnapshot(liveWorkspace);
  const saved = loadPersistedState<unknown>(key, null);
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) {
    return fallback;
  }

  const record = saved as Record<string, unknown>;
  return {
    // Un tableau vide est une sauvegarde valide : « Vider le panier » doit
    // rester effectif après rechargement au lieu de ressusciter la démo.
    lines: Array.isArray(record.lines) ? (record.lines as OrderLine[]) : fallback.lines,
    selectedGarmentColor:
      typeof record.selectedGarmentColor === 'string'
        ? record.selectedGarmentColor
        : null,
  };
};

/**
 * Panier du POS et couleur courante, sauvegardés automatiquement avec le
 * brouillon de commande. Les ajouts, quantités et couleurs vivent dans la
 * fabrique d'actions du panier ; un rechargement restaure ce même ticket.
 */
export const useCartStore = ({ storageKey, liveWorkspace }: CartDeps): CartStore => {
  const cartStorageKey = storageKey(POS_CART_STORAGE_KEY);
  const [initialCart] = useState<CartSnapshot>(() =>
    loadSnapshot(cartStorageKey, liveWorkspace)
  );
  const [cartLines, setCartLines] = useState<OrderLine[]>(initialCart.lines);
  const [selectedGarmentColor, setSelectedGarmentColor] = useState<string | undefined>(
    initialCart.selectedGarmentColor ?? undefined
  );

  useEffect(() => {
    const snapshot: CartSnapshot = {
      lines: cartLines,
      selectedGarmentColor: selectedGarmentColor ?? null,
    };
    persistState(cartStorageKey, snapshot);
  }, [cartStorageKey, cartLines, selectedGarmentColor]);

  return { cartLines, setCartLines, selectedGarmentColor, setSelectedGarmentColor };
};
