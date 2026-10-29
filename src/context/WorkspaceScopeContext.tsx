import React, { createContext, useContext } from 'react';
import { DEMO_WORKSPACE_SCOPE, type WorkspaceScope } from '../lib/workspaceScope';

/**
 * Portée transmise par la frontière d'accès (`StaffAccessGate`) au shell ERP.
 *
 * Le contexte est volontairement lu par `AppProvider` au montage : c'est lui
 * qui décide si l'état local démarre vide (compte réel) ou amorcé avec les
 * jeux d'exemple (démonstration locale explicite).
 */
const WorkspaceScopeContext = createContext<WorkspaceScope>(DEMO_WORKSPACE_SCOPE);

export const WorkspaceScopeProvider: React.FC<{
  scope: WorkspaceScope;
  children: React.ReactNode;
}> = ({ scope, children }) => (
  <WorkspaceScopeContext.Provider value={scope}>{children}</WorkspaceScopeContext.Provider>
);

/** Portée courante ; démonstration locale hors de toute frontière d'accès. */
export const useWorkspaceScope = (): WorkspaceScope =>
  useContext(WorkspaceScopeContext);

export { WorkspaceScopeContext };
