import type { Dispatch, SetStateAction } from 'react';
import type { CartLineDetails, ClothingItem, OrderLine } from '../../types';
import { calculateLineSubtotal } from '../../lib/pricing';
import { createLocalId as genId } from '../../lib/localPersistence';
import type { NotifyFn } from './types';

export interface CartActionsDeps {
  /** Prestation active du catalogue, appliquée par défaut aux ajouts. */
  selectedServiceFilter: string;
  selectedGarmentColor: string | undefined;
  setCartLines: Dispatch<SetStateAction<OrderLine[]>>;
  setDepositAmount: (amt: number) => void;
  notify: NotifyFn;
}

export interface CartActions {
  addCartItem: (
    item: ClothingItem,
    serviceType?: string,
    quantity?: number,
    weightKg?: number,
    details?: CartLineDetails
  ) => void;
  removeCartItem: (lineId: string) => void;
  updateCartItemQty: (lineId: string, delta: number) => void;
  updateCartLineColor: (lineId: string, color: string | undefined) => void;
  clearCart: () => void;
}

/**
 * Écritures du panier : ajouts (avec fusion des doublons à prestation et
 * couleur égales), quantités au pas de 0,5 kg pour le linge au kilo,
 * recoloriage (avec fusion vers le jumeau) et vidage.
 */
export const createCartActions = ({
  selectedServiceFilter,
  selectedGarmentColor,
  setCartLines,
  setDepositAmount,
  notify,
}: CartActionsDeps): CartActions => {
  const addCartItem = (
    item: ClothingItem,
    serviceType = selectedServiceFilter,
    quantity = 1,
    weightKg?: number,
    details?: CartLineDetails
  ) => {
    setCartLines((prev) => {
      const existing = prev.find(
        (line) =>
          line.clothingItemId === item.id &&
          line.serviceType === serviceType &&
          (line.color ?? undefined) === selectedGarmentColor
      );
      const isKilo = item.pricingType === 'kilo';
      const actualQty = isKilo ? (weightKg || 1) : quantity;
      const calcSubtotal = calculateLineSubtotal(item.unitPrice, actualQty);

      if (existing) {
        const newQty = existing.quantity + actualQty;
        const newSubtotal = calculateLineSubtotal(item.unitPrice, newQty);

        return prev.map((line) =>
          line.id === existing.id
            ? {
                ...line,
                quantity: newQty,
                weightKg: isKilo ? newQty : undefined,
                garments:
                  details?.garments != null
                    ? (line.garments ?? 0) + details.garments
                    : line.garments,
                subtotal: newSubtotal,
              }
            : line
        );
      }
      return [
        ...prev,
        {
          id: genId('cl'),
          clothingItemId: item.id,
          name: item.name,
          quantity: actualQty,
          pricingType: item.pricingType,
          weightKg: isKilo ? actualQty : undefined,
          garments: details?.garments,
          pricingBasis: details?.pricingBasis,
          blanchisserieService: details?.blanchisserieService,
          unitLabel: item.unitLabel,
          unitPrice: item.unitPrice,
          subtotal: calcSubtotal,
          serviceType: serviceType,
          color: selectedGarmentColor,
        },
      ];
    });
    notify(`✓ ${item.name} ajouté au panier`);
  };

  const removeCartItem = (lineId: string) => {
    setCartLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const updateCartItemQty = (lineId: string, delta: number) => {
    setCartLines((prev) =>
      prev
        .map((line) => {
          if (line.id === lineId) {
            const isKilo = line.pricingType === 'kilo';
            const step = isKilo ? 0.5 : 1;
            const newQty = Math.max(0, Math.round((line.quantity + delta * step) * 10) / 10);
            return newQty > 0
              ? {
                  ...line,
                  quantity: newQty,
                  weightKg: isKilo ? newQty : undefined,
                  subtotal: calculateLineSubtotal(line.unitPrice, newQty),
                }
              : null;
          }
          return line;
        })
        .filter(Boolean) as OrderLine[]
    );
  };

  const updateCartLineColor = (lineId: string, color: string | undefined) => {
    setCartLines((prev) => {
      const target = prev.find((l) => l.id === lineId);
      if (!target || (target.color ?? undefined) === color) return prev;
      const twin = prev.find(
        (l) =>
          l.id !== lineId &&
          l.clothingItemId === target.clothingItemId &&
          l.serviceType === target.serviceType &&
          (l.color ?? undefined) === color
      );
      if (!twin) return prev.map((l) => (l.id === lineId ? { ...l, color } : l));
      const isKilo = target.pricingType === 'kilo';
      const newQty = twin.quantity + target.quantity;
      return prev
        .filter((l) => l.id !== lineId)
        .map((l) =>
          l.id === twin.id
            ? {
                ...l,
                quantity: newQty,
                weightKg: isKilo ? newQty : undefined,
                subtotal: calculateLineSubtotal(l.unitPrice, newQty),
              }
            : l
        );
    });
  };

  const clearCart = () => {
    setCartLines([]);
    setDepositAmount(0);
    notify('Panier vidé');
  };

  return { addCartItem, removeCartItem, updateCartItemQty, updateCartLineColor, clearCart };
};
