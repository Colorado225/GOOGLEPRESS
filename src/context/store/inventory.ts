import { useEffect, useState } from 'react';
import type {
  ActionResult,
  InventoryProduct,
  ProductFormData,
  StockMovement,
  StockMovementInput,
} from '../../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_STOCK_MOVEMENTS,
} from '../../data/demoData';
import { computeMovement } from '../../lib/inventory';
import { normalizeText } from '../../lib/utils';
import { createLocalId as genId, loadPersistedState, persistState } from '../../lib/localPersistence';
import type { NotifyFn } from './types';

export interface InventoryDeps {
  storageKey: (name: string) => string;
  seedList: <T>(demoValue: readonly T[]) => T[];
  notify: NotifyFn;
}

export interface InventoryStore {
  products: InventoryProduct[];
  stockMovements: StockMovement[];
  createProduct: (data: ProductFormData, initialQuantity: number, initialDateISO: string) => ActionResult & { product?: InventoryProduct };
  updateProduct: (id: string, data: ProductFormData) => ActionResult;
  setProductActive: (id: string, isActive: boolean) => void;
  recordStockMovement: (input: StockMovementInput) => ActionResult;
}

/**
 * Module Stocks : catalogue produits et mouvements d'entrée/sortie/ajustement.
 * La quantité d'un produit ne change que par un mouvement tracé.
 */
export const useInventoryStore = ({
  storageKey,
  seedList,
  notify,
}: InventoryDeps): InventoryStore => {
  const [products, setProducts] = useState<InventoryProduct[]>(() =>
    loadPersistedState(storageKey('pressingpro_inventory_products'), seedList(INITIAL_PRODUCTS))
  );
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() =>
    loadPersistedState(storageKey('pressingpro_stock_movements'), seedList(INITIAL_STOCK_MOVEMENTS))
  );

  useEffect(() => {
    persistState(storageKey('pressingpro_inventory_products'), products);
  }, [products]);
  useEffect(() => {
    persistState(storageKey('pressingpro_stock_movements'), stockMovements);
  }, [stockMovements]);

  const isReferenceTaken = (reference: string, exceptId?: string): boolean =>
    products.some(
      (p) => p.id !== exceptId && normalizeText(p.reference) === normalizeText(reference)
    );

  const createProduct = (
    data: ProductFormData,
    initialQuantity: number,
    initialDateISO: string
  ): ActionResult & { product?: InventoryProduct } => {
    if (isReferenceTaken(data.reference)) {
      return { ok: false, error: `La référence « ${data.reference} » est déjà utilisée par un autre produit.` };
    }
    if (initialQuantity < 0) {
      return { ok: false, error: 'La quantité initiale ne peut pas être négative.' };
    }
    const product: InventoryProduct = {
      ...data,
      id: genId('prod'),
      currentQuantity: initialQuantity,
    };
    setProducts((prev) => [product, ...prev]);
    // Toute quantité initiale est tracée par un mouvement d'entrée.
    if (initialQuantity > 0) {
      setStockMovements((prev) => [
        {
          id: genId('mov'),
          productId: product.id,
          type: 'in',
          quantity: initialQuantity,
          quantityBefore: 0,
          quantityAfter: initialQuantity,
          date: initialDateISO,
          reason: 'Stock initial à la création du produit',
          unitCostXof: data.unitCostXof,
        },
        ...prev,
      ]);
    }
    notify(`✓ Produit créé : ${product.name}`);
    return { ok: true, product };
  };

  const updateProduct = (id: string, data: ProductFormData): ActionResult => {
    if (isReferenceTaken(data.reference, id)) {
      return { ok: false, error: `La référence « ${data.reference} » est déjà utilisée par un autre produit.` };
    }
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data, id: p.id } : p)));
    notify('✓ Produit mis à jour');
    return { ok: true };
  };

  const setProductActive = (id: string, isActive: boolean) => {
    const product = products.find((p) => p.id === id);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, isActive } : p)));
    if (product) {
      notify(
        isActive
          ? `✓ Produit réactivé : ${product.name}`
          : `Produit désactivé : ${product.name} (historique conservé)`
      );
    }
  };

  /**
   * Point d'écriture UNIQUE du stock : quantité du produit et historique des
   * mouvements sont toujours mis à jour ensemble (voir lib/inventory.ts).
   */
  const recordStockMovement = (input: StockMovementInput): ActionResult => {
    const product = products.find((p) => p.id === input.productId);
    if (!product) return { ok: false, error: 'Produit introuvable.' };
    if (!product.isActive) {
      return { ok: false, error: 'Produit désactivé : réactivez-le avant d’enregistrer un mouvement.' };
    }
    if (input.type === 'adjustment' && !input.reason.trim()) {
      return { ok: false, error: 'Un ajustement exige un motif (ex. inventaire, casse…).' };
    }
    const { quantityBefore, quantityAfter, error } = computeMovement(
      product.currentQuantity,
      input.type,
      input.quantity
    );
    if (error) return { ok: false, error };

    const movement: StockMovement = {
      id: genId('mov'),
      productId: product.id,
      type: input.type,
      quantity: input.quantity,
      quantityBefore,
      quantityAfter,
      date: input.date,
      reason: input.reason.trim(),
      unitCostXof: input.unitCostXof,
      note: input.note?.trim() || undefined,
    };
    setStockMovements((prev) => [movement, ...prev]);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id
          ? {
              ...p,
              currentQuantity: quantityAfter,
              // Une entrée avec coût met à jour le « dernier coût d'achat » du produit.
              unitCostXof:
                input.type === 'in' && typeof input.unitCostXof === 'number'
                  ? input.unitCostXof
                  : p.unitCostXof,
            }
          : p
      )
    );
    notify(`✓ Mouvement enregistré — ${product.name} : nouveau stock ${quantityAfter} ${product.unit}`);
    return { ok: true };
  };

  return {
    products,
    stockMovements,
    createProduct,
    updateProduct,
    setProductActive,
    recordStockMovement,
  };
};
