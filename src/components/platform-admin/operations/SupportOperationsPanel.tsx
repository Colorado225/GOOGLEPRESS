import React, { useState } from 'react';
import { FilePlus2, LifeBuoy, LockKeyhole, Paperclip, Plus, Send, UserRound } from 'lucide-react';
import type { PlatformAdminOrganization } from '../../../lib/platformAdmin';
import { formatPlatformDate, type PlatformSupportAttachment, type PlatformSupportTicket } from '../../../lib/platformOperations';
import { openPlatformSupportFile, uploadPlatformSupportFile } from '../../../lib/platformSupportFiles';
import { OperationBadge, OperationEmpty, OperationMetric, OperationPanel, OperationSubmit, operationFieldLabel, operationInputClass, operationSecondaryClass, type PlatformOperationPanelProps } from './ui';

const statusLabels: Record<PlatformSupportTicket['status'], string> = { open: 'Ouvert', pending: 'Attente client', resolved: 'Résolu', closed: 'Fermé' };
const priorityLabels: Record<PlatformSupportTicket['priority'], string> = { low: 'Basse', normal: 'Normale', high: 'Haute', urgent: 'Urgente' };
const templates = [
  'Merci pour votre message. Nous examinons la configuration de votre compte et revenons vers vous.',
  'Le point est corrigé côté PressingPro CI. Cliquez sur Actualiser puis vérifiez à nouveau votre écran.',
  'Pour nous aider à diagnostiquer précisément, pouvez-vous joindre une capture et indiquer l’heure du problème ?',
];

export const SupportOperationsPanel: React.FC<PlatformOperationPanelProps & { organizations: PlatformAdminOrganization[] }> = ({ snapshot, organizations, run, busy }) => {
  const [selectedId, setSelectedId] = useState<string | null>(snapshot.tickets[0]?.id ?? null);
  const [filter, setFilter] = useState<'active' | 'all' | 'resolved'>('active');
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [shopId, setShopId] = useState('');
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<PlatformSupportTicket['priority']>('normal');
  const [firstMessage, setFirstMessage] = useState('');
  const selected = snapshot.tickets.find((entry) => entry.id === selectedId) ?? null;
  const organization = organizations.find((entry) => entry.id === organizationId);
  const visible = snapshot.tickets.filter((ticket) => filter === 'all' || (filter === 'active' ? ['open', 'pending'].includes(ticket.status) : ['resolved', 'closed'].includes(ticket.status)));
  const resolved = snapshot.tickets.filter((ticket) => ticket.resolved_at);
  const averageResolutionHours = resolved.length ? Math.round(resolved.reduce((sum, ticket) => sum + (new Date(ticket.resolved_at as string).getTime() - new Date(ticket.created_at).getTime()), 0) / resolved.length / 3600000) : 0;

  const submitReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setUploading(true); setFileError(null);
    try {
      const attachments: PlatformSupportAttachment[] = [];
      for (const file of files) attachments.push(await uploadPlatformSupportFile(selected.organization_id, selected.id, file));
      const saved = await run('ticket.reply', { ticket_id: selected.id, body: reply, internal, attachments }, internal ? 'Note interne ajoutée au ticket.' : 'Réponse visible par le propriétaire ajoutée.');
      if (saved) { setReply(''); setFiles([]); }
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Impossible de joindre le fichier.');
    } finally { setUploading(false); }
  };

  return <div className="space-y-5">
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <OperationMetric label="Tickets actifs" value={snapshot.tickets.filter((entry) => ['open', 'pending'].includes(entry.status)).length} detail="Ouverts ou en attente client" icon={LifeBuoy} tone="warning" />
      <OperationMetric label="Urgents" value={snapshot.tickets.filter((entry) => entry.priority === 'urgent' && !['resolved', 'closed'].includes(entry.status)).length} detail="À traiter en priorité" icon={LockKeyhole} tone="danger" />
      <OperationMetric label="Résolus" value={resolved.length} detail="Historique conservé" icon={UserRound} tone="success" />
      <OperationMetric label="Résolution moyenne" value={`${averageResolutionHours} h`} detail="Sur les tickets résolus" icon={FilePlus2} />
    </section>

    <OperationPanel title="Tickets de support" description="Les réponses de l’éditeur sont visibles par le propriétaire ; une note interne reste strictement réservée au super-admin." action={<button type="button" className={operationSecondaryClass} onClick={() => setShowCreate((value) => !value)}><Plus className="h-4 w-4" /> Nouveau ticket</button>}>
      {showCreate && <form className="mb-4 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20" onSubmit={(event) => { event.preventDefault(); if (!organizationId || !subject.trim() || !firstMessage.trim()) return; void run('ticket.create', { organization_id: organizationId, shop_id: shopId || null, organization_name: organization?.name, shop_name: organization?.shops.find((entry) => entry.id === shopId)?.name, subject, priority, body: firstMessage, internal: false }, 'Ticket créé et notification ajoutée.').then((saved) => { if (saved) { setShowCreate(false); setSubject(''); setFirstMessage(''); } }); }}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className={operationFieldLabel}>Pressing<select required aria-label="Pressing du nouveau ticket" className={`${operationInputClass} mt-1`} value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setShopId(''); }}><option value="">Sélectionner…</option>{organizations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label className={operationFieldLabel}>Agence<select aria-label="Agence du nouveau ticket" className={`${operationInputClass} mt-1`} value={shopId} onChange={(event) => setShopId(event.target.value)}><option value="">Toute l’organisation</option>{organization?.shops.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label className={operationFieldLabel}>Priorité<select aria-label="Priorité du nouveau ticket" className={`${operationInputClass} mt-1`} value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>{Object.entries(priorityLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className={operationFieldLabel}>Sujet<input required aria-label="Sujet du nouveau ticket" className={`${operationInputClass} mt-1`} value={subject} onChange={(event) => setSubject(event.target.value)} minLength={2} maxLength={240} /></label></div><label className={`${operationFieldLabel} mt-3`}>Premier message visible<textarea required aria-label="Premier message du ticket" className={`${operationInputClass} mt-1 min-h-20`} value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} /></label><div className="mt-3 flex justify-end"><OperationSubmit busy={busy} type="submit"><Plus className="h-4 w-4" /> Créer le ticket</OperationSubmit></div></form>}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
        <div className="min-w-0"><div className="mb-3 flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">{([['active', 'Actifs'], ['resolved', 'Résolus'], ['all', 'Tous']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold ${filter === id ? 'bg-white shadow-sm dark:bg-zinc-900' : 'text-zinc-500'}`} onClick={() => setFilter(id)}>{label}</button>)}</div>{visible.length === 0 ? <OperationEmpty>Aucun ticket dans cette vue.</OperationEmpty> : <ul className="max-h-[720px] space-y-2 overflow-y-auto pr-1">{visible.map((ticket) => <li key={ticket.id}><button type="button" aria-label={`Ouvrir ${ticket.ticket_number}`} onClick={() => setSelectedId(ticket.id)} className={`w-full rounded-xl border p-3 text-left ${selectedId === ticket.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-zinc-200 hover:border-blue-300 dark:border-zinc-800'}`}><div className="flex items-center justify-between gap-2"><strong className="text-[11.5px]">{ticket.ticket_number}</strong><OperationBadge tone={ticket.priority === 'urgent' ? 'danger' : ticket.priority === 'high' ? 'warning' : 'neutral'}>{priorityLabels[ticket.priority]}</OperationBadge></div><p className="mt-1 line-clamp-2 text-[12.5px] font-black">{ticket.subject}</p><p className="mt-1 truncate text-[10.5px] text-zinc-500">{ticket.organization_name} · {ticket.shop_name ?? 'Organisation'}</p><div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400"><span>{statusLabels[ticket.status]}</span><time>{formatPlatformDate(ticket.updated_at)}</time></div></button></li>)}</ul>}</div>

        {selected ? <article className="min-w-0 rounded-2xl border border-zinc-200 dark:border-zinc-800"><header className="border-b border-zinc-100 p-4 dark:border-zinc-800"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-blue-600">{selected.ticket_number}</p><h4 className="mt-1 text-[16px] font-black">{selected.subject}</h4><p className="mt-1 text-[11px] text-zinc-500">{selected.organization_name} · {selected.shop_name ?? 'Toute l’organisation'}</p></div><div className="flex gap-2"><select aria-label="Statut du ticket" className={`${operationInputClass} w-auto`} value={selected.status} disabled={busy} onChange={(event) => run('ticket.update', { ticket_id: selected.id, status: event.target.value }, 'Statut du ticket mis à jour.')}><option value="open">Ouvert</option><option value="pending">Attente client</option><option value="resolved">Résolu</option><option value="closed">Fermé</option></select><select aria-label="Priorité du ticket" className={`${operationInputClass} w-auto`} value={selected.priority} disabled={busy} onChange={(event) => run('ticket.update', { ticket_id: selected.id, priority: event.target.value }, 'Priorité du ticket mise à jour.')}><option value="low">Basse</option><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option></select></div></div></header>
          <ol className="max-h-[500px] space-y-3 overflow-y-auto p-4">{selected.messages.map((message) => <li key={message.id} className={`max-w-[92%] rounded-2xl p-3 ${message.author_type === 'platform' ? 'ml-auto bg-blue-600 text-white' : 'mr-auto bg-zinc-100 dark:bg-zinc-800'}`}><div className={`flex items-center gap-2 text-[10px] font-bold ${message.author_type === 'platform' ? 'text-blue-100' : 'text-zinc-500'}`}><span>{message.author_type === 'platform' ? 'PressingPro CI' : 'Propriétaire'}</span>{message.internal && <OperationBadge tone="warning">Interne</OperationBadge>}<time>{formatPlatformDate(message.created_at)}</time></div><p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed">{message.body}</p>{message.attachments.length > 0 && <div className="mt-2 space-y-1">{message.attachments.map((attachment) => <button key={attachment.path} type="button" className="flex items-center gap-1.5 text-[10.5px] font-bold underline" onClick={() => void openPlatformSupportFile(attachment.path).catch((error) => setFileError(error instanceof Error ? error.message : 'Lecture impossible'))}><Paperclip className="h-3 w-3" />{attachment.name}</button>)}</div>}</li>)}</ol>
          <form className="border-t border-zinc-100 p-4 dark:border-zinc-800" onSubmit={(event) => void submitReply(event)}><div className="flex flex-wrap items-center gap-2"><select aria-label="Modèle de réponse" className={`${operationInputClass} w-auto`} value="" onChange={(event) => { if (event.target.value) setReply(event.target.value); }}><option value="">Modèle de réponse…</option>{templates.map((template, index) => <option key={template} value={template}>Modèle {index + 1}</option>)}</select><label className="flex items-center gap-2 text-[11px] font-bold"><input type="checkbox" className="h-4 w-4 accent-amber-600" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> Note interne invisible au client</label></div><textarea required aria-label="Réponse au ticket" className={`${operationInputClass} mt-2 min-h-24 resize-y`} maxLength={8000} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Diagnostic, réponse ou consigne de vérification…" /><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><label className={`${operationSecondaryClass} cursor-pointer`}><Paperclip className="h-4 w-4" /> Joindre fichiers<input type="file" multiple className="sr-only" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))} /></label><OperationSubmit busy={busy || uploading} type="submit"><Send className="h-4 w-4" /> {uploading ? 'Téléversement…' : internal ? 'Ajouter la note interne' : 'Envoyer au propriétaire'}</OperationSubmit></div>{files.length > 0 && <p className="mt-2 text-[10.5px] text-zinc-500">{files.map((file) => file.name).join(' · ')}</p>}{fileError && <p role="alert" className="mt-2 text-[11px] font-semibold text-red-600">{fileError}</p>}</form>
        </article> : <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-[12px] text-zinc-500 dark:border-zinc-700">Sélectionnez un ticket pour afficher la conversation.</div>}
      </div>
    </OperationPanel>
  </div>;
};
