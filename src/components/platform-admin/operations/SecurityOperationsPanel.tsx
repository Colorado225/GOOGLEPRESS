import React, { useCallback, useEffect, useState } from 'react';
import { Download, KeyRound, Laptop, Loader2, LogOut, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatPlatformDate } from '../../../lib/platformOperations';
import { OperationBadge, OperationEmpty, OperationMetric, OperationPanel, OperationSubmit, operationFieldLabel, operationInputClass, operationSecondaryClass, type PlatformOperationPanelProps } from './ui';

interface TotpFactor { id: string; friendly_name?: string; status: string }
interface Enrollment { id: string; qrCode: string; secret: string }

export const SecurityOperationsPanel: React.FC<PlatformOperationPanelProps> = ({ snapshot, refresh }) => {
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(Boolean(supabase));
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const verified = factors.filter((factor) => factor.status === 'verified');

  const loadFactors = useCallback(async () => {
    if (!supabase) { setLoadingFactors(false); return; }
    setLoadingFactors(true); setError(null);
    try {
      const { data, error: factorError } = await supabase.auth.mfa.listFactors();
      if (factorError) throw factorError;
      setFactors(data.totp);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Impossible de lire les facteurs MFA.'); }
    finally { setLoadingFactors(false); }
  }, []);
  useEffect(() => { void loadFactors(); }, [loadFactors]);

  const enroll = async () => {
    if (!supabase || busy) return;
    setBusy(true); setError(null); setFeedback(null);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'PressingPro CI super-admin' });
      if (enrollError) throw enrollError;
      setEnrollment({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: data.id });
      if (challengeError) throw challengeError;
      setChallengeId(challenge.id);
    } catch (enrollFailure) { setError(enrollFailure instanceof Error ? enrollFailure.message : 'Inscription MFA impossible.'); }
    finally { setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !enrollment || !challengeId || code.length !== 6) return;
    setBusy(true); setError(null);
    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: enrollment.id, challengeId, code });
      if (verifyError) throw verifyError;
      setEnrollment(null); setChallengeId(null); setCode(''); setFeedback('Double authentification activée. Les prochaines connexions exigeront un code TOTP.');
      await loadFactors();
    } catch (verifyFailure) { setError(verifyFailure instanceof Error ? verifyFailure.message : 'Code TOTP refusé.'); }
    finally { setBusy(false); }
  };
  const unenroll = async (factorId: string) => {
    if (!supabase || !window.confirm('Désactiver ce facteur de double authentification ?')) return;
    setBusy(true); setError(null);
    try { const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId }); if (unenrollError) throw unenrollError; setFeedback('Facteur TOTP désactivé.'); await loadFactors(); }
    catch (unenrollFailure) { setError(unenrollFailure instanceof Error ? unenrollFailure.message : 'Désactivation impossible.'); }
    finally { setBusy(false); }
  };
  const signOutOthers = async () => {
    if (!supabase || !window.confirm('Déconnecter toutes les autres sessions du compte super-admin ?')) return;
    setBusy(true); setError(null);
    try { const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' }); if (signOutError) throw signOutError; setFeedback('Les autres sessions ont été déconnectées.'); refresh(); }
    catch (signOutFailure) { setError(signOutFailure instanceof Error ? signOutFailure.message : 'Déconnexion distante impossible.'); }
    finally { setBusy(false); }
  };
  const downloadRecoveryProcedure = () => {
    const content = `PressingPro CI — Récupération du super-admin unique\n\nCe document ne contient ni mot de passe, ni secret TOTP, ni code contournant Supabase Auth.\n\n1. Conserver l’accès au projet Supabase Pressing_Pro et à l’adresse e-mail du compte.\n2. En cas de perte de l’appareil TOTP, utiliser la réinitialisation d’accès administrateur du propriétaire du projet Supabase.\n3. Après vérification d’identité hors bande, le propriétaire du projet utilise Supabase Auth Admin pour retirer le facteur TOTP perdu. Ne pas désactiver la ligne platform_admins pendant cette opération.\n4. Réinitialiser le mot de passe par le flux Auth si nécessaire, déconnecter les autres sessions, puis vérifier qu’il existe toujours exactement une ligne platform_admins active.\n5. Ne jamais créer un second super-admin ni partager la clé service_role. Enrôler immédiatement un nouveau facteur TOTP.\n6. Ouvrir une note d’incident dans le journal d’audit après récupération.\n\nGénéré le ${new Date().toISOString()}.\n`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'recuperation-super-admin-pressingpro.txt'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <div className="space-y-5">
    {(error || feedback) && <div aria-live="polite" className={`rounded-xl border px-4 py-3 text-[12px] font-semibold ${error ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40'}`}>{error || feedback}</div>}
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><OperationMetric label="Facteurs TOTP" value={verified.length} detail={verified.length ? 'AAL2 exigé à la connexion' : 'MFA à activer'} icon={ShieldCheck} tone={verified.length ? 'success' : 'warning'} /><OperationMetric label="Sessions Auth" value={snapshot.sessions.length} detail="Sessions connues du compte" icon={Laptop} /><OperationMetric label="Connexions journalisées" value={snapshot.security_events.length} detail="Historique du compte unique" icon={KeyRound} /><OperationMetric label="Alertes sécurité" value={snapshot.notifications.filter((entry) => entry.kind === 'security' && !entry.read_at).length} detail="Nouvel appareil ou réseau" icon={ShieldAlert} tone="danger" /></section>

    <div className="grid items-start gap-5 xl:grid-cols-2">
      <OperationPanel title="Double authentification TOTP" description="Compatible avec les applications d’authentification. Une fois le facteur vérifié, la porte /administration exige AAL2 avant de monter la console.">
        {!supabase ? <OperationEmpty>La MFA réelle nécessite une session Supabase. Elle n’est pas simulée en démonstration locale.</OperationEmpty> : loadingFactors ? <p className="flex items-center gap-2 text-[12px] text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Lecture des facteurs…</p> : <>
          {verified.length > 0 && <ul className="mb-4 space-y-2">{verified.map((factor) => <li key={factor.id} className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><div><p className="text-[12px] font-black">{factor.friendly_name || 'Application d’authentification'}</p><p className="text-[10.5px] text-emerald-700 dark:text-emerald-300">Facteur vérifié · AAL2 actif</p></div><button type="button" className="text-[11px] font-bold text-red-600 hover:underline" disabled={busy} onClick={() => void unenroll(factor.id)}>Désactiver</button></li>)}</ul>}
          {!enrollment ? <OperationSubmit busy={busy} onClick={() => void enroll()}><Smartphone className="h-4 w-4" /> {verified.length ? 'Ajouter un autre facteur' : 'Activer la double authentification'}</OperationSubmit> : <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20"><h4 className="text-[13px] font-black">Scanner puis valider</h4><img src={enrollment.qrCode} alt="QR code TOTP du super-admin" className="mx-auto mt-3 h-48 w-48 rounded-xl bg-white p-2" /><p className="mt-2 break-all text-center text-[10.5px] text-zinc-500">Secret manuel : <strong>{enrollment.secret}</strong></p><form className="mt-3" onSubmit={(event) => void verify(event)}><label className={operationFieldLabel}>Code à 6 chiffres<input required aria-label="Code TOTP d’activation" inputMode="numeric" autoComplete="one-time-code" className={`${operationInputClass} mt-1 text-center text-[18px] font-black tracking-[0.3em]`} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><OperationSubmit busy={busy} type="submit" className={`${operationSecondaryClass} mt-2 w-full`}><KeyRound className="h-4 w-4" /> Vérifier et activer</OperationSubmit></form></div>}
        </>}
      </OperationPanel>

      <OperationPanel title="Sessions et récupération" description="Fermez les autres appareils sans interrompre la session courante. La récupération d’urgence reste une procédure Supabase contrôlée, pas un code fictif de contournement.">
        <div className="flex flex-wrap gap-2"><button type="button" className={operationSecondaryClass} disabled={busy || !supabase} onClick={() => void signOutOthers()}><LogOut className="h-4 w-4" /> Déconnecter les autres sessions</button><button type="button" className={operationSecondaryClass} onClick={downloadRecoveryProcedure}><Download className="h-4 w-4" /> Procédure de récupération</button></div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><strong>Pas de second super-admin.</strong> La procédure utilise uniquement le propriétaire du projet Supabase et ne partage jamais la clé service_role. Les codes de récupération ne sont pas inventés côté interface.</div>
      </OperationPanel>
    </div>

    <div className="grid items-start gap-5 xl:grid-cols-2">
      <OperationPanel title="Sessions et appareils"><OperationEmpty>{snapshot.sessions.length === 0 ? 'Aucune session Auth visible dans ce contexte.' : `${snapshot.sessions.length} session(s) enregistrée(s).`}</OperationEmpty>{snapshot.sessions.length > 0 && <ul className="mt-3 space-y-2">{snapshot.sessions.map((session) => <li key={session.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"><div className="flex items-center justify-between gap-2"><OperationBadge tone="info">{session.aal ?? 'AAL inconnu'}</OperationBadge><time className="text-[10px] text-zinc-400">{formatPlatformDate(session.created_at)}</time></div><p className="mt-2 break-words text-[11px] font-bold">{session.user_agent || 'Navigateur non renseigné'}</p><p className="mt-1 text-[10.5px] text-zinc-500">IP {session.ip || 'non renseignée'} · Expire {formatPlatformDate(session.not_after)}</p></li>)}</ul>}</OperationPanel>
      <OperationPanel title="Historique des connexions">{snapshot.security_events.length === 0 ? <OperationEmpty>Les nouvelles connexions du compte super-admin seront consignées ici.</OperationEmpty> : <ul className="space-y-2">{snapshot.security_events.map((event) => <li key={event.id} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950/50"><div className="flex justify-between gap-2 text-[11px] font-bold"><span>{event.event_type}</span><time>{formatPlatformDate(event.created_at)}</time></div><p className="mt-1 break-words text-[10.5px] text-zinc-500">{event.user_agent || 'Appareil inconnu'} · {event.ip || 'IP inconnue'}</p></li>)}</ul>}</OperationPanel>
    </div>
  </div>;
};
