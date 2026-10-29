import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import { ConfirmModal } from '../common/ModalShell';
import { useWorkspaceScope } from '../../context/WorkspaceScopeContext';
import { getSupabaseClient } from '../../lib/supabase';
import { mapStaffAuthError } from '../../lib/staffAuth';
import { getUserDisplayName, isLiveWorkspace } from '../../lib/workspaceScope';

/**
 * Déconnexion du compte professionnel.
 *
 * Le bouton n'existe que sur un espace réel authentifié : en démonstration
 * locale il n'y a aucune session à fermer, et afficher « Se déconnecter »
 * laisserait croire à un compte qui n'existe pas.
 *
 * Après `signOut()`, la perte de session est détectée par `StaffAccessGate`,
 * qui renvoie vers la page de connexion en conservant la destination visée.
 * Rien n'est effacé sur l'appareil : les données déjà enregistrées restent
 * intactes pour le prochain compte qui se connecte.
 */
export const SignOutButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const workspace = useWorkspaceScope();
  const client = getSupabaseClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Démonstration locale ou configuration sans Supabase : aucune session.
  if (!isLiveWorkspace(workspace) || !client) return null;

  const displayName = getUserDisplayName(workspace);

  const requestSignOut = () => {
    setError(null);
    setConfirmOpen(true);
  };

  const confirmSignOut = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) {
        setError(mapStaffAuthError(signOutError));
        return;
      }
      setConfirmOpen(false);
      // La redirection est prise en charge par la garde d'accès.
    } catch (signOutError: unknown) {
      setError(mapStaffAuthError(signOutError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={requestSignOut}
        title={`Se déconnecter (${displayName})`}
        aria-label="Se déconnecter"
        className={`group inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[12px] font-semibold text-zinc-600 shadow-2xs transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-200 ${className}`}
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Déconnexion</span>
      </button>

      {confirmOpen && (
        <ConfirmModal
          title="Se déconnecter ?"
          description={
            <>
              La session de <strong className="font-semibold">{displayName}</strong> va être fermée
              sur cet appareil. Vous devrez vous reconnecter pour revenir dans l’espace, et les
              données déjà enregistrées restent intactes.
            </>
          }
          confirmLabel={busy ? 'Déconnexion…' : 'Se déconnecter'}
          cancelLabel="Rester connecté"
          danger
          onConfirm={() => void confirmSignOut()}
          onCancel={() => {
            if (!busy) setConfirmOpen(false);
          }}
        >
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
            >
              {error}
            </p>
          )}
        </ConfirmModal>
      )}
    </>
  );
};
