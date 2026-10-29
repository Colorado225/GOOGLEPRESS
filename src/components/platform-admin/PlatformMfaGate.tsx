import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { StaffAuthAlert, StaffAuthHeader, StaffAuthLoading, staffPanelClassName, staffShellClassName } from '../auth/StaffAuthCommon';
import { authPrimaryButtonClassName, authSecondaryButtonClassName } from '../auth/authStyles';

/** Exige AAL2 dès qu’un facteur TOTP vérifié existe sur le compte admin. */
export const PlatformMfaGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [required, setRequired] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
        if (factorError) throw factorError;
        const factor = factors.totp.find((entry) => entry.status === 'verified');
        if (factor) { setFactorId(factor.id); setRequired(true); return; }
      }
      setRequired(false);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : 'Impossible de vérifier le niveau de sécurité de la session.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void check(); }, [check]);

  if (loading) return <StaffAuthLoading label="Vérification de la double authentification…" />;
  if (!required && !error) return <>{children}</>;

  const startChallenge = async () => {
    if (!supabase || !factorId || busy) return;
    setBusy(true); setError(null);
    try {
      const { data, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      setChallengeId(data.id);
    } catch (challengeFailure) {
      setError(challengeFailure instanceof Error ? challengeFailure.message : 'Impossible de créer le défi MFA.');
    } finally { setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !factorId || !challengeId || !code.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId, code: code.trim() });
      if (verifyError) throw verifyError;
      setCode(''); setChallengeId(null); setRequired(false);
    } catch (verifyFailure) {
      setError(verifyFailure instanceof Error ? verifyFailure.message : 'Code de vérification refusé.');
    } finally { setBusy(false); }
  };

  return <main className={staffShellClassName}><section className={staffPanelClassName}>
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300"><ShieldCheck className="h-5 w-5" /></div>
    <StaffAuthHeader title="Vérification en deux étapes requise" description="Le compte super-admin possède un facteur TOTP vérifié. La console ne se monte qu’après validation du code de votre application d’authentification." />
    <div className="mt-5 space-y-4">
      {error && <StaffAuthAlert tone="error">{error}</StaffAuthAlert>}
      {!factorId ? <div className="flex flex-wrap gap-2"><button type="button" className={authSecondaryButtonClassName} onClick={() => void check()} disabled={busy}><Loader2 className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Revérifier la session</button><button type="button" className={authPrimaryButtonClassName} onClick={() => void supabase?.auth.signOut()}><LogOut className="h-4 w-4" /> Se déconnecter</button></div> : !challengeId ? <button type="button" className={authPrimaryButtonClassName} onClick={() => void startChallenge()} disabled={busy}><KeyRound className="h-4 w-4" /> Préparer la vérification</button> : <form onSubmit={(event) => void verify(event)}><label className="block text-[12px] font-bold text-zinc-600 dark:text-zinc-300">Code à 6 chiffres<input autoFocus required inputMode="numeric" autoComplete="one-time-code" aria-label="Code MFA super-admin" className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-center text-[20px] font-black tracking-[0.35em] dark:border-zinc-700 dark:bg-zinc-950" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button type="submit" className={`${authPrimaryButtonClassName} mt-3 w-full`} disabled={busy || code.length !== 6}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Vérifier et ouvrir la console</button></form>}
    </div>
  </section></main>;
};
