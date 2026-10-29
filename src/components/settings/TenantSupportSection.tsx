import React, { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, Loader2, Paperclip, Plus, RefreshCw, Send } from 'lucide-react';
import type { WorkspaceScope } from '../../lib/workspaceScope';
import { fetchMySupportSnapshot, formatPlatformDate, runTenantSupportCommand, type PlatformSupportAttachment, type PlatformSupportTicket } from '../../lib/platformOperations';
import { openPlatformSupportFile, uploadPlatformSupportFile } from '../../lib/platformSupportFiles';

const inputClass = 'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[12.5px] outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 dark:border-zinc-700 dark:bg-zinc-950';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-blue-700 disabled:opacity-50';

export const TenantSupportSection: React.FC<{ workspace: WorkspaceScope }> = ({ workspace }) => {
  const [tickets, setTickets] = useState<PlatformSupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<PlatformSupportTicket['priority']>('normal');
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const selected = tickets.find((entry) => entry.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setTickets(await fetchMySupportSnapshot()); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Support indisponible.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const submitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspace.organizationId || !subject.trim() || !body.trim()) return;
    setBusy(true); setError(null); setFeedback(null);
    try {
      const next = await runTenantSupportCommand('create', { organization_id: workspace.organizationId, shop_id: workspace.shopId, subject, body, priority });
      setTickets(next); setSelectedId(next[0]?.id ?? null); setSubject(''); setBody(''); setShowCreate(false); setFeedback('Votre ticket a été transmis à PressingPro CI.');
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Création du ticket impossible.'); }
    finally { setBusy(false); }
  };
  const submitReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true); setError(null);
    try {
      const attachments: PlatformSupportAttachment[] = [];
      for (const file of files) attachments.push(await uploadPlatformSupportFile(selected.organization_id, selected.id, file));
      const next = await runTenantSupportCommand('reply', { ticket_id: selected.id, body: reply, attachments });
      setTickets(next); setReply(''); setFiles([]); setFeedback('Votre réponse a été ajoutée au ticket.');
    } catch (replyError) { setError(replyError instanceof Error ? replyError.message : 'Réponse impossible.'); }
    finally { setBusy(false); }
  };

  if (workspace.mode !== 'live' || !workspace.organizationId) return <section className="card-3d max-w-2xl rounded-2xl p-5"><LifeBuoy className="h-5 w-5 text-blue-600" /><h2 className="mt-2 text-[15px] font-black">Assistance PressingPro CI</h2><p className="mt-2 text-[12px] leading-relaxed text-zinc-500">Le support avec tickets et pièces jointes est disponible sur un compte Supabase réel. Aucun ticket fictif n’est créé dans la démonstration tenant.</p></section>;

  return <section className="max-w-4xl space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"><div><h2 className="flex items-center gap-2 text-[15px] font-black"><LifeBuoy className="h-5 w-5 text-blue-600" /> Assistance PressingPro CI</h2><p className="mt-1 text-[11.5px] text-zinc-500">Échangez avec l’éditeur sans exposer vos tickets aux autres pressings.</p></div><div className="flex gap-2"><button type="button" className="rounded-xl border border-zinc-300 px-3 py-2 text-[11.5px] font-bold dark:border-zinc-700" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button><button type="button" className={buttonClass} onClick={() => setShowCreate((value) => !value)}><Plus className="h-4 w-4" /> Nouveau ticket</button></div></div>
    {(error || feedback) && <div aria-live="polite" className={`rounded-xl border px-4 py-3 text-[12px] font-semibold ${error ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40'}`}>{error || feedback}</div>}
    {showCreate && <form className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20" onSubmit={(event) => void submitTicket(event)}><div className="grid gap-3 sm:grid-cols-[1fr_180px]"><label className="text-[11.5px] font-bold">Sujet<input required aria-label="Sujet de votre ticket" className={`${inputClass} mt-1`} value={subject} onChange={(event) => setSubject(event.target.value)} minLength={2} maxLength={240} /></label><label className="text-[11.5px] font-bold">Priorité<select aria-label="Priorité de votre ticket" className={`${inputClass} mt-1`} value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option></select></label></div><label className="mt-3 block text-[11.5px] font-bold">Description<textarea required aria-label="Description de votre ticket" className={`${inputClass} mt-1 min-h-24`} value={body} onChange={(event) => setBody(event.target.value)} /></label><button type="submit" className={`${buttonClass} mt-3`} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Transmettre au support</button></form>}
    {loading && tickets.length === 0 ? <p className="flex items-center gap-2 p-6 text-[12px] text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement de vos tickets…</p> : <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]"><div>{tickets.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-[12px] text-zinc-500 dark:border-zinc-700">Aucun ticket. Utilisez « Nouveau ticket » pour contacter l’éditeur.</p> : <ul className="space-y-2">{tickets.map((ticket) => <li key={ticket.id}><button type="button" className={`w-full rounded-xl border p-3 text-left ${selectedId === ticket.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-zinc-200 dark:border-zinc-700'}`} onClick={() => setSelectedId(ticket.id)}><strong className="text-[11px]">{ticket.ticket_number}</strong><p className="mt-1 text-[12.5px] font-black">{ticket.subject}</p><p className="mt-1 text-[10.5px] text-zinc-500">{ticket.status} · {formatPlatformDate(ticket.updated_at)}</p></button></li>)}</ul>}</div>{selected ? <article className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"><header className="border-b border-zinc-100 p-4 dark:border-zinc-800"><h3 className="text-[14px] font-black">{selected.subject}</h3><p className="text-[10.5px] text-zinc-500">{selected.ticket_number} · {selected.status}</p></header><ol className="max-h-[420px] space-y-3 overflow-y-auto p-4">{selected.messages.map((message) => <li key={message.id} className={`max-w-[92%] rounded-2xl p-3 ${message.author_type === 'platform' ? 'mr-auto bg-blue-50 dark:bg-blue-950/30' : 'ml-auto bg-zinc-100 dark:bg-zinc-800'}`}><p className="text-[10px] font-bold text-zinc-500">{message.author_type === 'platform' ? 'PressingPro CI' : 'Vous'} · {formatPlatformDate(message.created_at)}</p><p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed">{message.body}</p>{message.attachments.map((attachment) => <button key={attachment.path} type="button" className="mt-2 flex items-center gap-1 text-[10.5px] font-bold text-blue-600 underline" onClick={() => void openPlatformSupportFile(attachment.path)}><Paperclip className="h-3 w-3" />{attachment.name}</button>)}</li>)}</ol><form className="border-t border-zinc-100 p-4 dark:border-zinc-800" onSubmit={(event) => void submitReply(event)}><textarea required aria-label="Votre réponse au support" className={`${inputClass} min-h-20`} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Ajouter une précision ou une réponse…" /><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><label className="cursor-pointer text-[11px] font-bold text-blue-600"><Paperclip className="mr-1 inline h-4 w-4" /> Joindre<input type="file" multiple className="sr-only" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))} /></label><button type="submit" className={buttonClass} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Répondre</button></div>{files.length > 0 && <p className="mt-2 text-[10.5px] text-zinc-500">{files.map((file) => file.name).join(' · ')}</p>}</form></article> : <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-[12px] text-zinc-500 dark:border-zinc-700">Sélectionnez un ticket pour lire la conversation.</p>}</div>}
  </section>;
};
