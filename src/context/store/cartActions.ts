import type { Dispatch, SetStateAction } from 'react';
import type { CartLineDetails, ClothingItem, OrderLine, PickupOption } from '../../types';
import { calculateLineSubtotal, isOrderLineExpress } from '../../lib/pricing';
import { createLocalId as genId } from '../../lib/localPersistence';
import type { NotifyFn } from './types';

export interface CartActionsDeps {
  /** Prestation active du catalogue, appliquée par défaut aux ajouts. */
  selectedServiceFilter: string;
  /** Délai global utilisé pour les nouveaux lots et les anciennes lignes. */
  pickupOption: PickupOption;
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
  /** Bascule une seule ligne entre Normal et Express, avec fusion du jumeau. */
  setCartLineExpress: (lineId: string, isExpress: boolean) => void;
  updateCartLineColor: (lineId: string, color: string | undefined) => void;
  clearCart: () => void;
}

const weightPerUnit = (line: Pick<OrderLine, 'quantity' | 'weightKg'>): number | undefined =>
  line.weightKg !== undefined && line.quantity > 0 ? line.weightKg / line.quantity : undefined;

const hasSamePackageWeight = (
  line: OrderLine,
  weightKg: number | undefined,
  quantity = 1
): boolean =>
  line.pricingType === 'kilo' ||
  weightPerUnit(line) === (weightKg !== undefined && quantity > 0 ? weightKg / quantity : undefined);

const sumOptionalWeights = (
  current: number | undefined,
  added: number | undefined
): number | undefined =>
  current === undefined && added === undefined
    ? undefined
    : Math.round(((current ?? 0) + (added ?? 0)) * 100) / 100;

/**
 * Écritures du panier : ajouts (avec fusion des doublons à prestation et
 * couleur égales), quantités au pas de 0,5 kg pour le linge au kilo,
 * recoloriage (avec fusion vers le jumeau) et vidage.
 */
export const createCartActions = ({
  selectedServiceFilter,
  pickupOption,
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
    const isExpress = details?.isExpress ?? pickupOption === 'express';
    setCartLines((prev) => {
      const existing = prev.find(
        (line) =>
          line.clothingItemId === item.id &&
          line.serviceType === serviceType &&
          isOrderLineExpress(line, pickupOption) === isExpress &&
          (line.color ?? undefined) === selectedGarmentColor &&
          hasSamePackageWeight(line, details?.weightKg, quantity)
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
                isExpress,
                quantity: newQty,
                weightKg: isKilo
                  ? newQty
                  : sumOptionalWeights(line.weightKg, details?.weightKg),
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
          weightKg: isKilo ? actualQty : details?.weightKg,
          garments: details?.garments,
          pricingBasis: details?.pricingBasis,
          blanchisserieService: details?.blanchisserieService,
          unitLabel: item.unitLabel,
          unitPrice: item.unitPrice,
          subtotal: calcSubtotal,
          serviceType: serviceType,
          isExpress,
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
            const previousUnitWeight = weightPerUnit(line);
            return newQty > 0
              ? {
                  ...line,
                  quantity: newQty,
                  weightKg: isKilo
                    ? newQty
                    : previousUnitWeight !== undefined
                      ? Math.round(previousUnitWeight * newQty * 100) / 100
                      : undefined,
                  subtotal: calculateLineSubtotal(line.unitPrice, newQty),
                }
              : null;
          }
          return line;
        })
        .filter(Boolean) as OrderLine[]
    );
  };

  const setCartLineExpress = (lineId: string, isExpress: boolean) => {
    setCartLines((prev) => {
      const target = prev.find((line) => line.id === lineId);
      if (!target || isOrderLineExpress(target, pickupOption) === isExpress) return prev;

      // Si le même lot existe déjà avec l'autre délai, réunir les quantités
      // au lieu de créer deux lignes Normal (ou deux lignes Express).
      const twin = prev.find(
        (line) =>
          line.id !== lineId &&
          line.clothingItemId === target.clothingItemId &&
          line.serviceType === target.serviceType &&
          (line.color ?? undefined) === (target.color ?? undefined) &&
          isOrderLineExpress(line, pickupOption) === isExpress &&
          hasSamePackageWeight(line, target.weightKg, target.quantity)
      );
      if (!twin) {
        return prev.map((line) => (line.id === lineId ? { ...line, isExpress } : line));
      }

      const quantity = twin.quantity + target.quantity;
      const isKilo = twin.pricingType === 'kilo';
      return prev
        .filter((line) => line.id !== lineId)
        .map((line) =>
          line.id === twin.id
            ? {
                ...line,
                isExpress,
                quantity,
                weightKg: isKilo
                  ? quantity
                  : sumOptionalWeights(line.weightKg, target.weightKg),
                garments:
                  line.garments != null || target.garments != null
                    ? (line.garments ?? 0) + (target.garments ?? 0)
                    : undefined,
                subtotal: calculateLineSubtotal(line.unitPrice, quantity),
              }
            : line
        );
    });
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
          isOrderLineExpress(l, pickupOption) === isOrderLineExpress(target, pickupOption) &&
          (l.color ?? undefined) === color &&
          hasSamePackageWeight(l, target.weightKg, target.quantity)
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
                weightKg: isKilo
                  ? newQty
                  : sumOptionalWeights(l.weightKg, target.weightKg),
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

  return {
    addCartItem,
    removeCartItem,
    updateCartItemQty,
    setCartLineExpress,
    updateCartLineColor,
    clearCart,
  };
};
