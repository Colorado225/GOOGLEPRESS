import { describe, expect, it } from 'vitest';
import {
  DEMO_WORKSPACE_SCOPE,
  getWorkspaceLabel,
  getWorkspaceStoragePrefix,
  isLiveWorkspace,
  scopeStorageKey,
  type WorkspaceScope,
} from '../../src/lib/workspaceScope';

const liveScope = (overrides: Partial<WorkspaceScope> = {}): WorkspaceScope => ({
  mode: 'live',
  organizationId: '11111111-2222-3333-4444-555555555555',
  organizationName: 'Pressing Éclat',
  shopName: 'Agence Cocody',
  ...overrides,
});

describe('workspaceScope', () => {
  it('conserve les clés historiques en démonstration locale', () => {
    expect(getWorkspaceStoragePrefix(DEMO_WORKSPACE_SCOPE)).toBe('');
    expect(scopeStorageKey(DEMO_WORKSPACE_SCOPE, 'pressingpro_orders')).toBe(
      'pressingpro_orders'
    );
  });

  it('isole la persistance d’un espace réel par organisation', () => {
    const scope = liveScope();
    expect(getWorkspaceStoragePrefix(scope)).toBe(
      'pressingpro_workspace_11111111-2222-3333-4444-555555555555__'
    );
    expect(scopeStorageKey(scope, 'pressingpro_orders')).toBe(
      'pressingpro_workspace_11111111-2222-3333-4444-555555555555__pressingpro_orders'
    );
  });

  it('sépare deux organisations ouvertes dans le même navigateur', () => {
    const first = scopeStorageKey(liveScope(), 'pressingpro_customers');
    const second = scopeStorageKey(
      liveScope({ organizationId: '99999999-8888-7777-6666-555555555555' }),
      'pressingpro_customers'
    );
    expect(first).not.toBe(second);
    expect(first).not.toBe('pressingpro_customers');
  });

  it('ne préfixe pas un espace réel privé de son organisation', () => {
    // Cas défensif : sans identifiant, on retombe sur les clés historiques
    // plutôt que d'inventer une portée commune à tous les comptes.
    expect(getWorkspaceStoragePrefix(liveScope({ organizationId: null }))).toBe('');
    expect(getWorkspaceStoragePrefix(liveScope({ organizationId: '   ' }))).toBe('');
  });

  it('neutralise les caractères étrangers dans l’identifiant d’organisation', () => {
    expect(getWorkspaceStoragePrefix(liveScope({ organizationId: 'org/1 :*?' }))).toBe(
      'pressingpro_workspace_org1__'
    );
  });

  it('distingue démonstration et espace réel', () => {
    expect(isLiveWorkspace(DEMO_WORKSPACE_SCOPE)).toBe(false);
    expect(isLiveWorkspace(liveScope())).toBe(true);
  });

  it('affiche le nom réel de l’enseigne, sans nom d’exemple', () => {
    expect(getWorkspaceLabel(liveScope())).toBe('Pressing Éclat — Agence Cocody');
    expect(getWorkspaceLabel(liveScope({ shopName: null }))).toBe('Pressing Éclat');
    expect(getWorkspaceLabel(liveScope({ shopName: 'Pressing Éclat' }))).toBe(
      'Pressing Éclat'
    );
    expect(
      getWorkspaceLabel({ mode: 'live', organizationId: 'org', organizationName: null, shopName: null })
    ).toBe('Espace professionnel');
    expect(
      getWorkspaceLabel(
        { mode: 'live', organizationId: 'org', organizationName: '  ', shopName: '  ' },
        'Mon pressing'
      )
    ).toBe('Mon pressing');
  });

  it('ne reprend jamais un nom de démonstration comme repli', () => {
    expect(getWorkspaceLabel(DEMO_WORKSPACE_SCOPE)).not.toContain('Cocody');
    expect(getWorkspaceLabel(DEMO_WORKSPACE_SCOPE)).toBe('Espace professionnel');
  });
});
