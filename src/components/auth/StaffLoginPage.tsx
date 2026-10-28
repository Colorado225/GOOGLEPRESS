import React, { useEffect, useState } from 'react';
import { Loader2, LogIn, Mail } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { validateCustomerLogin } from '../../lib/customerAuth';
import {
  STAFF_REGISTER_PATH,
  mapStaffAuthError,
  resolveStaffPostAuthPath,
} from '../../lib/staffAuth';
import { listCurrentMemberships } from '../../lib/supabaseOrders';
import { resolveStaffReturnPath } from '../../lib/routes';
import {
  StaffAuthAlert,
  StaffAuthLoading,
} from './StaffAuthCommon';
import { StaffPremiumAuthLayout } from './StaffPremiumAuthLayout';

interface StaffLoginPageProps {
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
}

type AuthView = 'login' | 'forgot';

const resolveLoginDestination = (
  memberships: Parameters<typeof resolveStaffPostAuthPath>[0],
): string => {
  const fallback = resolveStaffPostAuthPath(memberships);
  if (fallback !== '/') return fallback;
  return resolveStaffReturnPath(window.location.search) ?? '/';
};

const staffPremiumInputClassName =
  'w-full rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-3 text-[14px] text-[#171936] shadow-sm outline-none transition placeholder:text-[#9CA3AF] focus:border-[#5145E5] focus:ring-4 focus:ring-[#5145E5]/15 disabled:cursor-not-allowed disabled:bg-[#F3F4F6] disabled:text-[#6B7280]';

const staffPremiumLabelClassName =
  'mb-2 block text-[12px] font-semibold uppercase tracking-wider text-[#6B7280]';

const staffPremiumButtonClassName =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5145E5] px-4 py-3 text-[14px] font-black text-white shadow-sm transition hover:bg-[#33258E] focus:outline-none focus:ring-4 focus:ring-[#5145E5]/25 disabled:cursor-not-allowed disabled:opacity-60';

const staffPremiumSecondaryButtonClassName =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-2.5 text-[13px] font-bold text-[#171936] shadow-sm transition hover:bg-[#F9FAFB] focus:outline-none focus:ring-4 focus:ring-[#5145E5]/15 disabled:cursor-not-allowed disabled:opacity-60';

const togglePasswordVisibilityClassName =
  'absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#5145E5] transition focus:outline-none';

export const StaffLoginPage: React.FC<StaffLoginPageProps> = ({ onNavigate }) => {
  const authClient = supabase;
  const configured = isSupabaseConfigured && authClient !== null;

  const [authView, setAuthView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Connexion — PressingPro CI';
  }, []);

  useEffect(() => {
    if (!authClient) return;
    let cancelled = false;

    authClient.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled || !data.session) return;
        const memberships = await listCurrentMemberships(data.session.user.id);
        if (!cancelled) {
          onNavigate(resolveLoginDestination(memberships), { replace: true });
        }
      })
      .catch(() => {
        // Une session illisible ne bloque pas le formulaire de connexion.
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authClient, onNavigate]);

  if (checkingSession) {
    return (
      <StaffPremiumAuthLayout>
        <StaffAuthLoading label="Vérification de votre session…" />
      </StaffPremiumAuthLayout>
    );
  }

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !authClient) return;
    const validationError = validateCustomerLogin({ email, password });
    setMessage(null);
    setError(validationError);
    if (validationError) return;

    setBusy(true);
    try {
      const { error: signInError } = await authClient.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(mapStaffAuthError(signInError.message));
        return;
      }
      setMessage('Connexion réussie ! Redirection…');
    } catch (_err) {
      setError('Une erreur inattendue est survenue. Veuillez réessayer.');
    } finally {
      setBusy(false);
    }
  };

  const switchView = () =>
    setAuthView((prev) => (prev === 'login' ? 'forgot' : 'login'));

  return (
    <StaffPremiumAuthLayout>
      <form
        onSubmit={submitLogin}
        className="w-full space-y-4 mt-2 relative z-10"
        aria-label="Formulaire de connexion du personnel"
      >
        <div className="mb-2">
          <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-[#5145E5]">
            <span className="h-3 w-3" aria-hidden="true">◆</span> Accès personnel
          </p>
          <h1 className="mt-1 text-[26px] font-black tracking-tight text-[#171936]">
            Bon retour parmi nous
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6B7280]">
        {configured && (
          <StaffAuthAlert tone="success" className="hidden md:block">
            Le service de connexion est correctement configuré.
          </StaffAuthAlert>
        )}
        {configured && (
          <StaffAuthAlert tone="error" className="hidden md:block">
            Le service de connexion n’est pas configuré dans cet environnement.
            Le formulaire est désactivé : aucun compte ne peut être vérifié ici.
          </StaffAuthAlert>
        )}
        {error && <StaffAuthAlert tone="error">{error}</StaffAuthAlert>}
        {message && <StaffAuthAlert tone="success">{message}</StaffAuthAlert>}

        <div>
          <label htmlFor="staff-login-email" className={staffPremiumLabelClassName}>
            Adresse e-mail
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </span>
            <input
              id="staff-login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="votre@email.example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={staffPremiumInputClassName + ' pl-10 pr-3.5'}
              disabled={busy || !configured}
              required
            />
          </div>
        </div>
            Connectez-vous à votre espace de gestion PressingPro CI.
          </p>
        {authView === 'login' && (
          <div>
            <label htmlFor="staff-login-password" className={staffPremiumLabelClassName}>
              Mot de passe
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <input
                id="staff-login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={staffPremiumInputClassName + ' pl-10 pr-10'}
                disabled={busy || !configured}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={togglePasswordVisibilityClassName}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.06M9.99 3.24A10.07 10.07 0 0 1 12 4c7 0 11 8 11 8a18.45 18.45 0 0 1-5.06 5.06M12 20v-5M12 4v5"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
        )}
        </div>
    setMessage(null);
    setError(validationError);
    if (validationError) return;

    setBusy(true);
        {authView === 'forgot' && (
          <div>
            <label htmlFor="staff-reset-email" className={staffPremiumLabelClassName}>
              Adresse e-mail
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </span>
              <input
                id="staff-reset-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="votre@email.example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={staffPremiumInputClassName + ' pl-10 pr-3.5'}
                disabled={busy || !configured}
                required
              />
            </div>
          </div>
        )}

        {authView === 'login' && (
          <p className="text-right">
            <button
              type="button"
              className="text-[13px] font-bold text-[#5145E5] underline-offset-2 transition hover:underline focus:outline-none focus:ring-4 focus:ring-[#5145E5]/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              onClick={switchView}
            >
              Mot de passe oublié ?
            </button>
          </p>
        )}

        <button
          type="submit"
          className={staffPremiumButtonClassName}
          disabled={busy || !configured}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : authView === 'login' ? (
            <>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Se connecter
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" aria-hidden="true" />
              Envoyer le lien
            </>
          )}
        </button>

        {authView === 'forgot' && (
          <button
            type="button"
            className={staffPremiumSecondaryButtonClassName}
            disabled={busy}
            onClick={switchView}
          >
            Retour à la connexion
          </button>
        )}
      </form>

      <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
        <p className="text-[12px] text-[#6B7280] text-center sm:text-left">
          Nouveau sur la plateforme ?
        </p>
        <p className="mt-1 text-center sm:text-left">
          <button
            type="button"
            className="text-[13px] font-black text-[#5145E5] underline-offset-2 hover:underline focus:outline-none focus:ring-4 focus:ring-[#5145E5]/20 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onNavigate(STAFF_REGISTER_PATH)}
          >
            Créer un compte propriétaire
          </button>
        </p>
        <p className="mt-3 text-[11.5px] leading-relaxed text-[#9CA3AF] text-center sm:text-left">
          Employé(e) d’un pressing déjà inscrit : votre accès est activé par
          votre propriétaire ou votre responsable.
        </p>
      </div>
    </StaffPremiumAuthLayout>
  );
};
