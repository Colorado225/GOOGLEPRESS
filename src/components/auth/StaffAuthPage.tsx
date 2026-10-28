import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { getSupabaseConfigStatus, supabase } from '../../lib/supabase';
import {
  mapStaffAuthError,
  validateStaffLogin,
  validateStaffRegistration,
} from '../../lib/staffAuth';

export type StaffAuthMode = 'login' | 'register';
export type StaffNavigate = (path: string, options?: { replace?: boolean }) => void;

interface StaffAuthPageProps {
  mode: StaffAuthMode;
  onNavigate: StaffNavigate;
}

const AuthBrand = () => (
  <div className="flex items-center gap-3">
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f9a51a] text-xl font-black text-[#302d43] shadow-lg shadow-black/15">
      P
    </span>
    <span>
      <span className="block text-[16px] font-black leading-tight">PressingPro CI</span>
      <span className="mt-0.5 block text-[11px] font-medium tracking-wide text-white/65">
        PRESSING &amp; BLANCHISSERIE
      </span>
    </span>
  </div>
);

const AuthMessage: React.FC<{ kind: 'error' | 'success'; children: React.ReactNode }> = ({
  kind,
  children,
}) => (
  <div
    role={kind === 'error' ? 'alert' : 'status'}
    aria-live="polite"
    className={[
      'mb-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed',
      kind === 'error'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800',
    ].join(' ')}
  >
    {kind === 'error' ? (
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    ) : (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    )}
    <span>{children}</span>
  </div>
);

const fieldClass =
  'h-11 w-full rounded-lg border border-zinc-200 bg-white px-3.5 text-[13px] text-[#302d43] outline-none transition placeholder:text-zinc-400 focus:border-[#3b3760] focus:ring-4 focus:ring-[#3b3760]/10 disabled:cursor-not-allowed disabled:bg-zinc-100';

const Label: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({
  htmlFor,
  children,
}) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-bold text-zinc-600">
    {children}
  </label>
);

export const StaffAuthPage: React.FC<StaffAuthPageProps> = ({ mode, onNavigate }) => {
  const config = getSupabaseConfigStatus();
  const [view, setView] = useState<StaffAuthMode>(mode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setView(mode);
    setError(null);
    setSuccess(null);
  }, [mode]);

  useEffect(() => {
    document.title =
      view === 'register'
        ? 'Créer un compte — PressingPro CI'
        : 'Connexion — PressingPro CI';
  }, [view]);

  const switchMode = (next: StaffAuthMode) => {
    setError(null);
    setSuccess(null);
    setView(next);
    onNavigate(next === 'register' ? '/inscription' : '/connexion');
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy) return;

    setError(null);
    setSuccess(null);

    if (view === 'login') {
      const validationError = validateStaffLogin({ email, password });
      if (validationError) {
        setError(validationError);
        return;
      }

      setBusy(true);
      try {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (authError) {
          setError(mapStaffAuthError(authError));
          return;
        }
        if (data.session) {
          setPassword('');
          onNavigate('/', { replace: true });
        } else {
          setSuccess('La connexion nécessite une étape supplémentaire. Suivez les instructions envoyées par le service.');
        }
      } catch (authError) {
        setError(mapStaffAuthError(authError));
      } finally {
        setBusy(false);
      }
      return;
    }

    const registrationError = validateStaffRegistration({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    });
    if (registrationError) {
      setError(registrationError);
      return;
    }

    const cleanFirstName = firstName.trim().replace(/\s+/g, ' ');
    const cleanLastName = lastName.trim().replace(/\s+/g, ' ');
    const fullName = cleanFirstName + ' ' + cleanLastName;

    setBusy(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: window.location.origin + '/connexion',
          data: {
            full_name: fullName,
            first_name: cleanFirstName,
            last_name: cleanLastName,
          },
        },
      });

      if (signUpError) {
        setError(mapStaffAuthError(signUpError));
        return;
      }

      setPassword('');
      setConfirmPassword('');
      if (data.session) {
        // L'inscription crée une identité, jamais un rôle ou un accès métier.
        onNavigate('/', { replace: true });
        return;
      }

      setSuccess(
        'Votre compte a été créé. Vérifiez votre e-mail pour le confirmer. Pour protéger les données du pressing, un responsable doit ensuite vous attribuer un accès actif.'
      );
    } catch (signUpError) {
      setError(mapStaffAuthError(signUpError));
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || !config.configured;
  const isRegister = view === 'register';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7a51b] px-3 py-5 text-[#302d43] sm:px-6 lg:px-8">
      <div className="grid min-h-[min(720px,calc(100vh-40px))] w-full max-w-[1120px] overflow-hidden rounded-[4px] bg-white shadow-[0_18px_45px_rgba(49,39,27,0.30)] lg:grid-cols-[0.98fr_1.02fr]">
        <section className="relative hidden min-h-[650px] overflow-hidden bg-[#302d43] p-9 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
          <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-[#f7a51b]/10 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-10 left-[-70px] h-64 w-64 rounded-full bg-indigo-300/10 blur-3xl" aria-hidden="true" />
          <div className="relative z-10">
            <AuthBrand />
            <h1 className="mt-12 max-w-[350px] text-[34px] font-black leading-[1.12] tracking-tight xl:text-[40px]">
              Votre pressing,
              <span className="block text-[#f9a51a]">bien organisé.</span>
            </h1>
            <p className="mt-4 max-w-[335px] text-[13.5px] leading-6 text-white/70">
              Commandes, atelier, clients et encaissements réunis dans un seul espace de travail.
            </p>
          </div>

          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 560 720"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
            aria-hidden="true"
          >
            <g opacity="0.75">
              <circle cx="84" cy="127" r="5" fill="#F9A51A" />
              <circle cx="147" cy="98" r="3.8" fill="#F9A51A" />
              <circle cx="375" cy="76" r="5" fill="#F9A51A" />
              <circle cx="441" cy="145" r="2.7" fill="#FFFFFF" />
              <circle cx="101" cy="303" r="4" fill="#FFFFFF" opacity=".4" />
              <circle cx="410" cy="301" r="4.5" fill="#F9A51A" />
              <circle cx="472" cy="369" r="3" fill="#FFFFFF" opacity=".6" />
              <circle cx="72" cy="507" r="4" fill="#F9A51A" />
              <circle cx="439" cy="559" r="4" fill="#F9A51A" opacity=".6" />
              <circle cx="125" cy="605" r="2.5" fill="#FFFFFF" opacity=".6" />
            </g>
            <circle cx="123" cy="187" r="35" fill="#F9A51A" />
            <circle cx="111" cy="174" r="7" fill="#E58C0B" opacity=".75" />
            <circle cx="139" cy="194" r="5" fill="#E58C0B" opacity=".7" />
            <circle cx="118" cy="205" r="4" fill="#E58C0B" opacity=".8" />
            <circle cx="354" cy="171" r="20" fill="#F6F3EA" />
            <circle cx="349" cy="166" r="3" fill="#CDD0D5" />
            <circle cx="362" cy="176" r="2" fill="#CDD0D5" />
            <path d="M75 252 C45 238 32 263 43 286 C52 304 85 302 91 281" stroke="#F6F3EA" strokeOpacity=".55" strokeWidth="1.5" />
            <path d="M160 560 C207 515 268 510 313 554 C345 585 389 577 418 542 C441 515 468 520 491 548 L491 654 L90 654 C108 618 127 589 160 560Z" fill="#F6F3EA" opacity=".13" />
            <path d="M178 596 L194 551 L224 572 L242 538 L276 557 L298 535 L333 566 L358 543 L386 575 L410 557 L438 600 L438 654 L178 654Z" fill="#FFFFFF" opacity=".10" />
            <g transform="translate(0 70)" filter="url(#washerShadow)">
              <rect x="181" y="213" width="139" height="375" rx="20" fill="#F9A51A" />
              <rect x="201" y="230" width="99" height="18" rx="9" fill="#F9A51A" />
              <rect x="212" y="272" width="76" height="82" rx="2" fill="#F9A51A" stroke="#FFF3DA" strokeOpacity=".95" strokeWidth="2" />
              <circle cx="249" cy="313" r="24" fill="#F2E8CE" />
              <circle cx="245" cy="309" r="16" fill="#FFFFFF" />
              <circle cx="254" cy="315" r="15" fill="#F6B04A" />
              <circle cx="262" cy="313" r="11" fill="#302D43" />
              <circle cx="207" cy="390" r="2.6" fill="#302D43" />
              <circle cx="207" cy="415" r="2.6" fill="#302D43" />
              <path d="M220 390 H296 M220 415 H296" stroke="#FFF3DA" strokeOpacity=".9" strokeWidth="1.6" strokeLinecap="round" />
              <rect x="267" y="444" width="27" height="11" rx="1.5" fill="#302D43" />
              <rect x="200" y="476" width="101" height="3" rx="1.5" fill="#FBE3B2" opacity=".7" />
            </g>
            <defs>
              <filter id="washerShadow" x="145" y="190" width="216" height="440" filterUnits="userSpaceOnUse">
                <feDropShadow dx="0" dy="15" stdDeviation="12" floodColor="#000000" floodOpacity=".22" />
              </filter>
            </defs>
          </svg>

          <div className="relative z-10 mt-auto max-w-[340px] rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f9a51a]/15 text-[#f9a51a]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12.5px] font-bold">Un espace de travail sécurisé</p>
                <p className="mt-0.5 text-[11px] leading-5 text-white/60">
                  L'accès aux fonctions dépend des autorisations attribuées.
                </p>
              </div>
            </div>
          </div>

          <svg
            className="pointer-events-none absolute -right-px top-0 hidden h-full w-[76px] lg:block"
            viewBox="0 0 76 720"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M76 0 C39 48 15 67 33 105 C48 137 71 144 54 180 C31 227 18 242 43 279 C67 315 66 349 42 380 C12 418 20 448 45 483 C67 516 58 554 39 583 C19 614 30 658 76 720 L76 0 Z"
              fill="#FFFFFF"
            />
          </svg>
        </section>

        <section className="flex min-w-0 items-center justify-center px-5 py-8 sm:px-10 lg:px-12 xl:px-[72px]">
          <div className="w-full max-w-[390px]">
            <div className="mb-7 flex items-center gap-3 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#302d43] text-lg font-black text-white">P</span>
              <div>
                <p className="text-[15px] font-black">PressingPro CI</p>
                <p className="text-[11px] text-zinc-500">Pressing &amp; blanchisserie</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#8b879d]">
                <Sparkles className="h-3.5 w-3.5 text-[#f0a11b]" aria-hidden="true" />
                Espace professionnel
              </p>
              <h2 className="text-[27px] font-extrabold tracking-tight text-[#302d43]">
                {isRegister ? 'Créer un compte' : 'Bon retour !'}
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-5 text-zinc-500">
                {isRegister
                  ? 'Créez votre identité pour demander l’accès à votre pressing.'
                  : 'Connectez-vous pour retrouver votre espace de travail.'}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 border-b border-zinc-200" aria-label="Connexion ou inscription">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={[
                  'relative px-3 py-3 text-[12px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#302d43]',
                  !isRegister ? 'text-[#302d43]' : 'text-zinc-400 hover:text-zinc-700',
                ].join(' ')}
                aria-current={!isRegister ? 'page' : undefined}
              >
                Connexion
                {!isRegister && <span className="absolute inset-x-6 -bottom-px h-[3px] rounded-full bg-[#302d43]" />}
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={[
                  'relative px-3 py-3 text-[12px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#302d43]',
                  isRegister ? 'text-[#302d43]' : 'text-zinc-400 hover:text-zinc-700',
                ].join(' ')}
                aria-current={isRegister ? 'page' : undefined}
              >
                Inscription
                {isRegister && <span className="absolute inset-x-6 -bottom-px h-[3px] rounded-full bg-[#302d43]" />}
              </button>
            </div>

            {!config.configured && (
              <AuthMessage kind="error">
                Supabase n’est pas configuré dans cet environnement. Les formulaires sont visibles, mais la connexion et l’inscription sont désactivées.
              </AuthMessage>
            )}
            {error && <AuthMessage kind="error">{error}</AuthMessage>}
            {success && <AuthMessage kind="success">{success}</AuthMessage>}

            <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
              {isRegister && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="staff-first-name">Prénom</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                      <input
                        id="staff-first-name"
                        type="text"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        autoComplete="given-name"
                        placeholder="Awa"
                        required
                        disabled={disabled}
                        className={fieldClass + ' pl-9'}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="staff-last-name">Nom</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                      <input
                        id="staff-last-name"
                        type="text"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        autoComplete="family-name"
                        placeholder="Koné"
                        required
                        disabled={disabled}
                        className={fieldClass + ' pl-9'}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="staff-email">Adresse e-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                  <input
                    id="staff-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="vous@exemple.com"
                    required
                    disabled={disabled}
                    className={fieldClass + ' pl-9'}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="staff-password">Mot de passe</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                  <input
                    id="staff-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    placeholder={isRegister ? '8 caractères minimum' : 'Votre mot de passe'}
                    minLength={isRegister ? 8 : undefined}
                    required
                    disabled={disabled}
                    className={fieldClass + ' pl-9 pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-[#302d43] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#302d43]"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isRegister && (
                <div>
                  <Label htmlFor="staff-confirm-password">Confirmer le mot de passe</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                    <input
                      id="staff-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      placeholder="Saisissez à nouveau le mot de passe"
                      minLength={8}
                      required
                      disabled={disabled}
                      className={fieldClass + ' pl-9'}
                    />
                  </div>
                </div>
              )}

              {!isRegister && (
                <p className="text-right text-[11px] text-zinc-400">
                  Accès réservé au personnel autorisé
                </p>
              )}

              <button
                type="submit"
                disabled={disabled}
                className="group mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#302d43] px-4 text-[12px] font-bold text-white shadow-md shadow-[#302d43]/15 transition hover:bg-[#252237] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#302d43]/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    {isRegister ? 'Créer mon compte' : 'Se connecter'}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            {isRegister && (
              <p className="mt-4 text-[10.5px] leading-5 text-zinc-500">
                La création du compte ne donne pas automatiquement un rôle. Un responsable doit activer votre accès au pressing.
              </p>
            )}

            <div className="mt-6 flex items-center justify-center gap-2 border-t border-zinc-100 pt-4 text-[10.5px] text-zinc-400">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>PressingPro CI · Gestion professionnelle</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

interface StaffAccessGateProps {
  children: React.ReactNode;
  onNavigate: StaffNavigate;
}

/**
 * Garde d'entrée de l'ERP. L'absence de configuration garde le mode local
 * disponible en développement, mais bloque l'application en production.
 * L'autorisation métier est lue dans memberships; l'UI seule ne remplace pas RLS.
 */
export const StaffAccessGate: React.FC<StaffAccessGateProps> = ({ children, onNavigate }) => {
  const client = supabase;
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [membershipState, setMembershipState] = useState<
    'none' | 'checking' | 'authorized' | 'pending' | 'error'
  >('none');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!client) {
      setInitialized(true);
      return;
    }

    let active = true;
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setSessionError(false);
      setInitialized(true);
    });

    void client.auth.getSession()
      .then(({ data: sessionData, error: authError }) => {
        if (!active) return;
        setSession(sessionData.session);
        setSessionError(Boolean(authError));
        setInitialized(true);
      })
      .catch(() => {
        if (!active) return;
        setSessionError(true);
        setInitialized(true);
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, retryCount]);

  useEffect(() => {
    if (!client || !initialized) return;
    if (!session) {
      setMembershipState('none');
      return;
    }

    let active = true;
    setMembershipState('checking');
    void client
      .from('memberships')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
      .then(
        ({ data, error: membershipError }) => {
          if (!active) return;
          setMembershipState(membershipError ? 'error' : data ? 'authorized' : 'pending');
        },
        () => {
          if (active) setMembershipState('error');
        }
      );

    return () => {
      active = false;
    };
  }, [client, initialized, session, retryCount]);

  if (!client) {
    return import.meta.env.DEV ? (
      <>{children}</>
    ) : (
      <StaffAuthPage mode="login" onNavigate={onNavigate} />
    );
  }

  if (!initialized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7a51b] p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-[#302d43] shadow-xl">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          Vérification de la session…
        </div>
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7a51b] p-4">
        <section className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-xl">
          <AlertCircle className="mx-auto h-9 w-9 text-red-600" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-extrabold text-[#302d43]">Session indisponible</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Impossible de vérifier la session auprès de Supabase. Aucun accès à l’ERP n’est accordé.
          </p>
          <button
            type="button"
            onClick={() => {
              setSessionError(false);
              setInitialized(false);
              setRetryCount((count) => count + 1);
            }}
            className="mt-5 rounded-lg bg-[#302d43] px-4 py-2.5 text-sm font-bold text-white"
          >
            Réessayer
          </button>
        </section>
      </main>
    );
  }

  if (!session) {
    return <StaffAuthPage mode="login" onNavigate={onNavigate} />;
  }

  if (membershipState === 'checking' || membershipState === 'none') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7a51b] p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-[#302d43] shadow-xl">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          Vérification de vos autorisations…
        </div>
      </main>
    );
  }

  if (membershipState === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7a51b] p-4">
        <section className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-xl">
          <AlertCircle className="mx-auto h-9 w-9 text-red-600" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-extrabold text-[#302d43]">Accès non vérifié</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Les autorisations du compte n’ont pas pu être vérifiées. Vérifiez que les migrations d’identité Supabase sont installées, puis réessayez.
          </p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="mt-5 rounded-lg bg-[#302d43] px-4 py-2.5 text-sm font-bold text-white"
          >
            Réessayer
          </button>
        </section>
      </main>
    );
  }

  if (membershipState === 'pending') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7a51b] p-4">
        <section className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-xl sm:p-9">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-[#302d43]">Accès en attente</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Votre compte existe, mais aucun accès actif à un pressing ne lui a été attribué. Demandez au propriétaire ou au responsable de votre établissement de valider votre accès.
          </p>
          <button
            type="button"
            onClick={() => {
              void client.auth.signOut();
            }}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#302d43] px-4 text-sm font-bold text-white hover:bg-[#252237]"
          >
            Se déconnecter
          </button>
        </section>
      </main>
    );
  }

  return <>{children}</>;
};
