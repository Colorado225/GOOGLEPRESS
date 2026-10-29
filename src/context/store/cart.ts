import { useState, type Dispatch, type SetStateAction } from 'react';
import type { OrderLine } from '../../types';

export interface CartStore {
  cartLines: OrderLine[];
  setCartLines: Dispatch<SetStateAction<OrderLine[]>>;
  selectedGarmentColor: string | undefined;
  setSelectedGarmentColor: (color: string | undefined) => void;
}

/**
 * Panier du POS. État seul et volontairement non persisté : le contenu du
 * ticket en cours ne survit pas au rechargement. Les ajouts, quantités et
 * couleurs vivent dans la fabrique d'actions du panier.
 */
export const useCartStore = (): CartStore => {
  // Default pre-populated cart to replicate Mockup 2:
  // 3x Chemise (4 500 FCFA), 1x Boubou bazin (4 500 FCFA), Remise fidélité -10% (-900 FCFA) -> Total 8 100 FCFA. Acompte: 5 000 FCFA. Reste: 3 100 FCFA.
  const [cartLines, setCartLines] = useState<OrderLine[]>([
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
  ]);

  const [selectedGarmentColor, setSelectedGarmentColor] = useState<string | undefined>(undefined);

  return { cartLines, setCartLines, selectedGarmentColor, setSelectedGarmentColor };
};
