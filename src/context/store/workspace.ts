import {
  isLiveWorkspace,
  scopeStorageKey,
  type WorkspaceScope,
} from '../../lib/workspaceScope';
import { useWorkspaceScope } from '../WorkspaceScopeContext';

export interface WorkspaceData {
  /**
   * Portée des données (lib/workspaceScope.ts) :
   * - démonstration locale explicite → amorçage avec les jeux d'exemple ;
   * - compte réel rattaché à une organisation → aucune donnée inventée, les
   *   écrans démarrent vides et se remplissent des seules saisies réelles.
   */
  workspace: WorkspaceScope;
  liveWorkspace: boolean;
  /** Clé de persistance isolée par organisation en espace réel. */
  storageKey: (name: string) => string;
  /** Jeu d'exemple en démonstration, liste vide sur un compte réel. */
  seedList: <T>(demoValue: readonly T[]) => T[];
}

/**
 * Socle de tous les modules persistés : portée, clés isolées par espace et
 * amorçage démo. Volontairement sans mémoïsation, comme le code d'origine :
 * des fermetures fraîches à chaque rendu, sans effet de bord.
 */
export const useWorkspaceData = (): WorkspaceData => {
  const workspace = useWorkspaceScope();
  const liveWorkspace = isLiveWorkspace(workspace);
  const storageKey = (name: string) => scopeStorageKey(workspace, name);
  const seedList = <T,>(demoValue: readonly T[]): T[] =>
    liveWorkspace ? [] : [...demoValue];
  return { workspace, liveWorkspace, storageKey, seedList };
};
