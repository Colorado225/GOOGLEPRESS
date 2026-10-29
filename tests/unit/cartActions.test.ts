import { describe, expect, it } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';
import { createCartActions } from '../../src/context/store/cartActions';
import { quotePressingWeightService } from '../../src/lib/pressing';
import { calculateOrderTotals } from '../../src/lib/pricing';
import type { OrderLine, PressingServiceType } from '../../src/types';

const setup = () => {
  let lines: OrderLine[] = [];
  const setCartLines: Dispatch<SetStateAction<OrderLine[]>> = (action) => {
    lines = typeof action === 'function' ? action(lines) : action;
  };
  const actions = createCartActions({
    selectedServiceFilter: 'Forfait famille',
    pickupOption: 'standard',
    selectedGarmentColor: undefined,
    setCartLines,
    setDepositAmount: () => undefined,
    notify: () => undefined,
  });
  return { actions, getLines: () => lines };
};

const packageService: PressingServiceType = {
  id: 'family',
  label: 'Forfait famille',
  pricingMode: 'forfait',
  packageWeightKg: 5,
  packagePrice: 2500,
  extraKiloPrice: 600,
};

const addQuote = (
  actions: ReturnType<typeof setup>['actions'],
  weightKg: number,
  isExpress = false
) => {
  const { quote, error } = quotePressingWeightService(packageService, weightKg);
  expect(error).toBeNull();
  for (const block of quote?.blocks ?? []) {
    actions.addCartItem(block.item, packageService.label, block.quantity, block.weightKg, {
      isExpress,
      ...(block.kind === 'forfait'
        ? { weightKg: block.weightKg, pricingBasis: 'forfait' as const }
        : {}),
    });
  }
};

describe('cartActions — prestations Pressing au poids', () => {
  it('conserve forfait, kilos supplémentaires et majoration de la seule ligne Express', () => {
    const { actions, getLines } = setup();
    addQuote(actions, 6.5);

    let lines = getLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ quantity: 1, weightKg: 5, subtotal: 2500 });
    expect(lines[1]).toMatchObject({ quantity: 1.5, weightKg: 1.5, subtotal: 900 });

    actions.setCartLineExpress(lines[1].id, true);
    lines = getLines();
    expect(calculateOrderTotals(lines, { pickupOption: 'standard' })).toMatchObject({
      subtotal: 3400,
      expressFee: 900,
      total: 4300,
    });
  });

  it('fusionne les lots identiques en additionnant leurs poids et leurs sous-totaux', () => {
    const { actions, getLines } = setup();
    addQuote(actions, 6.5);
    addQuote(actions, 6.5);

    const lines = getLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ quantity: 2, weightKg: 10, subtotal: 5000 });
    expect(lines[1]).toMatchObject({ quantity: 3, weightKg: 3, subtotal: 1800 });

    actions.setCartLineExpress(lines[0].id, true);
    actions.updateCartItemQty(lines[0].id, 1);
    const updated = getLines().find((line) => line.unitLabel === 'forfait');
    expect(updated).toMatchObject({ quantity: 3, weightKg: 15, subtotal: 7500, isExpress: true });
  });
});
