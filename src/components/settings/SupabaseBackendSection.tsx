import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  RadioTower,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '../common/DataTable';
import { useApp } from '../../context/AppContext';
import { getSupabaseConfigStatus, supabase } from '../../lib/supabase';

interface ProbeResult {
  shops: number;
  orders: number;
}

const inputClassName =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-100 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400';

const primaryButtonClassName =
  'inline-flex items-center gap-2 rounded-lg bg-[#09090b] px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus:ring-zinc-100';

const secondaryButtonClassName =
  'inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-[13px] font-bold text-zinc-800 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:ring-zinc-100';

/**
 * Premier branchement front du backend : configuration, session Auth et sonde
 * PostgREST. L’onglet Atelier → Suivi distant lit déjà les commandes
 * Supabase et leurs transitions, tandis que les écrans métier historiques
 * restent sur leurs données locales tant que leur bascule n’est pas testée.
 */
export const SupabaseBackendSection: React.FC = () => {
  const { requestWorkshopTab } = useApp();
  const config = getSupabaseConfigStatus();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(supabase));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [probeBusy, setProbeBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
      return;
    }

    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (cancelled) return;
        if (sessionError) setError(sessionError.message);
        setSession(data.session);
      })
      .finally(() => {
        if (!cancelled) setLoadingSession(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = async () => {
    if (!supabase || authBusy) return;
    setAuthBusy(true);
    setMessage(null);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setAuthBusy(false);
    setPassword('');
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setMessage('Connexion Supabase réussie. Vous pouvez tester l’accès PostgREST.');
  };

  const signOut = async () => {
    if (!supabase || authBusy) return;
    setAuthBusy(true);
    setMessage(null);
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    setAuthBusy(false);
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    setProbeResult(null);
    setMessage('Session Supabase fermée sur cet appareil.');
  };

  const probeApi = async () => {
    if (!supabase || probeBusy) return;
    setProbeBusy(true);
    setMessage(null);
    setError(null);

    const shops = await supabase.from('shops').select('id, name').order('name');
    if (shops.error) {
      setProbeResult(null);
      if (session) {
        setError(`Accès API refusé pour cette session : ${shops.error.message}`);
      } else {
        setMessage(`Accès anonyme refusé comme attendu : ${shops.error.message}`);
      }
      setProbeBusy(false);
      return;
    }

    const orders = await supabase.from('orders').select('id', { count: 'exact', head: true });
    setProbeBusy(false);
    if (orders.error) {
      setError(`Commandes non lisibles pour cette session : ${orders.error.message}`);
      return;
    }

    setProbeResult({ shops: shops.data?.length ?? 0, orders: orders.count ?? 0 });
    setMessage('Sonde PostgREST terminée avec les droits de la session courante.');
  };

  return (
    <section
      aria-labelledby="supabase-backend-title"
      className="space-y-4 rounded-xl border border-zinc-200/90 bg-white p-5 text-[13px] shadow-2xs dark:border-zinc-700/90 dark:bg-zinc-900"
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault();
      }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800">
        <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <h2 id="supabase-backend-title" className="text-[14.5px] font-bold text-zinc-900 dark:text-zinc-100">
          Backend Supabase
        </h2>
        {config.configured ? (
          <Badge variant="success" size="sm">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Configuré
          </Badge>
        ) : (
          <Badge variant="warning" size="sm">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Non configuré
          </Badge>
        )}
      </div>

      <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
        Cet onglet branche progressivement l’Auth et PostgREST. Un premier écran
        Atelier → Suivi distant lit les commandes déjà présentes dans Supabase,
        s’abonne à Realtime et change leurs étapes par RPC. La création au POS,
        les clientes et la caisse restent locales tant que chaque domaine n’est
        pas basculé et testé séparément.
      </p>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
          <dt className="text-[11.5px] font-bold uppercase text-zinc-500 dark:text-zinc-400">URL du projet</dt>
          <dd className="mt-1 break-all font-semibold text-zinc-900 dark:text-zinc-100">
            {config.url ?? 'Non renseignée'}
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
          <dt className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Clé publique
          </dt>
          <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
            {config.publicKeyConfigured ? 'Renseignée (jamais affichée)' : 'Non renseignée'}
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800 sm:col-span-2">
          <dt className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Session sur cet appareil
          </dt>
          <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
            {loadingSession
              ? 'Vérification…'
              : session
                ? session.user.email ?? session.user.id
                : 'Aucune session'}
          </dd>
        </div>
      </dl>

      {!config.configured && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Renseignez <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code>{' '}
            dans l’environnement de build, puis redéployez. Ne mettez jamais de clé
            secrète dans le navigateur.
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="supabase-email" className="mb-1 block text-[11.5px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
            E-mail du compte
          </label>
          <input
            id="supabase-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={!config.configured || Boolean(session)}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="supabase-password" className="mb-1 block text-[11.5px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
            Mot de passe
          </label>
          <input
            id="supabase-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={!config.configured || Boolean(session)}
            className={inputClassName}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {session ? (
          <button type="button" onClick={() => void signOut()} disabled={authBusy} className={secondaryButtonClassName}>
            {authBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogOut className="h-4 w-4" aria-hidden="true" />}
            Se déconnecter
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={!config.configured || authBusy || !email.trim() || !password}
            className={primaryButtonClassName}
          >
            {authBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
            Se connecter
          </button>
        )}
        <button
          type="button"
          onClick={() => void probeApi()}
          disabled={!config.configured || probeBusy}
          className={secondaryButtonClassName}
        >
          {probeBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Tester l’accès PostgREST
        </button>
        <button
          type="button"
          onClick={() => requestWorkshopTab('remote')}
          className={secondaryButtonClassName}
        >
          <RadioTower className="h-4 w-4" aria-hidden="true" />
          Ouvrir Atelier → Suivi distant
        </button>
        <a href="/client/connexion" className={secondaryButtonClassName}>
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Ouvrir l’espace client
        </a>
      </div>

      {probeResult && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] font-semibold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
          Agences visibles : {probeResult.shops} · Commandes visibles : {probeResult.orders}
        </p>
      )}
      {message && (
        <p aria-live="polite" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[12px] leading-relaxed text-blue-900 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] leading-relaxed text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
          {error}
        </p>
      )}
    </section>
  );
};
