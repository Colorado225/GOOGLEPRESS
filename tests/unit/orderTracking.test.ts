import { describe, expect, it } from 'vitest';
import {
  canMembershipTransitionOrder,
  canTransitionProductionStatus,
  getAdjacentOrderStatuses,
  getOrderEventActorLabel,
  getOrderEventLabel,
  getOrderEventNote,
  getOrderProgressPercent,
  getProductionTransitionTargets,
  isLogisticsTaskStatus,
  isOrderStatus,
  upsertByUpdatedAt,
} from '../../src/lib/orderTracking';

describe('orderTracking', () => {
  it('valide les statuts de commande et de tournée connus', () => {
    expect(isOrderStatus('washing')).toBe(true);
    expect(isOrderStatus('quality_control')).toBe(false);
    expect(isLogisticsTaskStatus('en_route')).toBe(true);
    expect(isLogisticsTaskStatus('ready')).toBe(false);
  });

  it('autorise une seule étape de production, sans remise générique', () => {
    expect(canTransitionProductionStatus('received', 'washing')).toBe(true);
    expect(canTransitionProductionStatus('ironing', 'washing')).toBe(true);
    expect(canTransitionProductionStatus('washing', 'ready')).toBe(false);
    expect(canTransitionProductionStatus('ready', 'delivered')).toBe(false);
    expect(canTransitionProductionStatus('delivered', 'ready')).toBe(false);
    expect(canTransitionProductionStatus('ready', 'ready')).toBe(false);
  });

  it('calcule les étapes voisines et la progression client', () => {
    expect(getAdjacentOrderStatuses('received')).toEqual({ next: 'washing' });
    expect(getAdjacentOrderStatuses('ready')).toEqual({
      previous: 'ironing',
      next: 'delivered',
    });
    expect(getProductionTransitionTargets('ready')).toEqual({ previous: 'ironing' });
    expect(getProductionTransitionTargets('delivered')).toEqual({});
    expect(getOrderProgressPercent('received')).toBe(20);
    expect(getOrderProgressPercent('ready')).toBe(80);
    expect(getOrderProgressPercent('delivered')).toBe(100);
  });

  it('lit uniquement une note textuelle non vide dans le payload', () => {
    expect(getOrderEventNote({ note: '  Casier A-02  ' })).toBe('Casier A-02');
    expect(getOrderEventNote({ note: '   ' })).toBeNull();
    expect(getOrderEventNote({ note: 42 })).toBeNull();
    expect(getOrderEventNote(null)).toBeNull();
  });

  it('produit des libellés d’événements et d’acteurs lisibles en français', () => {
    expect(
      getOrderEventLabel({
        event_type: 'order.created',
        from_status: null,
        to_status: 'received',
      })
    ).toBe('Commande reçue');
    expect(
      getOrderEventLabel({
        event_type: 'order.status_changed',
        from_status: 'ironing',
        to_status: 'ready',
      })
    ).toBe('Statut : Prête');
    expect(getOrderEventActorLabel('staff')).toBe('Équipe de la boutique');
    expect(getOrderEventActorLabel('unknown')).toBe('Acteur non renseigné');
  });

  it('réserve la transition aux rôles de production du bon périmètre', () => {
    const order = { organization_id: 'org-a', shop_id: 'shop-a1' };

    expect(
      canMembershipTransitionOrder(
        [{ organization_id: 'org-a', shop_id: null, role: 'organization_owner', status: 'active' }],
        order
      )
    ).toBe(true);
    expect(
      canMembershipTransitionOrder(
        [{ organization_id: 'org-a', shop_id: 'shop-a1', role: 'workshop', status: 'active' }],
        order
      )
    ).toBe(true);
    expect(
      canMembershipTransitionOrder(
        [{ organization_id: 'org-a', shop_id: 'shop-a1', role: 'courier', status: 'active' }],
        order
      )
    ).toBe(false);
    expect(
      canMembershipTransitionOrder(
        [{ organization_id: 'org-a', shop_id: 'shop-a2', role: 'workshop', status: 'active' }],
        order
      )
    ).toBe(false);
    expect(
      canMembershipTransitionOrder(
        [{ organization_id: 'org-a', shop_id: 'shop-a1', role: 'cashier', status: 'disabled' }],
        order
      )
    ).toBe(false);
  });

  it('insère ou remplace une ligne distante sans accepter une version périmée', () => {
    const initial = [
      { id: 'b', updated_at: '2026-10-28T10:00:00.000Z', label: 'B' },
      { id: 'a', updated_at: '2026-10-28T09:00:00.000Z', label: 'A' },
    ];

    expect(
      upsertByUpdatedAt(initial, {
        id: 'c',
        updated_at: '2026-10-28T11:00:00.000Z',
        label: 'C',
      }).map((row) => row.id)
    ).toEqual(['c', 'b', 'a']);

    expect(
      upsertByUpdatedAt(initial, {
        id: 'b',
        updated_at: '2026-10-28T08:00:00.000Z',
        label: 'ancien B',
      })[0].label
    ).toBe('B');
  });
});
