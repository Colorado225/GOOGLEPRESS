import type { PickupOption, ServiceCategory } from '../../types';

export interface OrderFlowDeps {
  setSelectedServiceCategory: (cat: ServiceCategory | null) => void;
  setOrderStep: (step: 1 | 2 | 3 | 4) => void;
  resetLogisticsDraft: (option?: PickupOption) => void;
  clearCart: () => void;
}

export interface OrderFlowActions {
  resetNewOrderFlow: (category?: ServiceCategory) => void;
}

/**
 * Parcours guidé de nouvelle commande : choix de l'univers (pressing ou
 * blanchisserie, ou retour à l'écran de choix), retour à l'étape 1, et
 * remise à zéro du brouillon logistique et du panier.
 */
export const createOrderFlowActions = ({
  setSelectedServiceCategory,
  setOrderStep,
  resetLogisticsDraft,
  clearCart,
}: OrderFlowDeps): OrderFlowActions => {
  const resetNewOrderFlow = (category?: ServiceCategory) => {
    if (category) {
      setSelectedServiceCategory(category);
      setOrderStep(1);
    } else {
      setSelectedServiceCategory(null);
      setOrderStep(1);
    }
    resetLogisticsDraft();
    clearCart();
  };

  return { resetNewOrderFlow };
};
