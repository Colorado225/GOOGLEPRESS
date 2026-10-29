import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Plus, ReceiptText, RotateCcw, WalletCards } from 'lucide-react';
import type { PlatformAdminOrganization } from '../../../lib/platformAdmin';
import {
  PLATFORM_PAYMENT_METHOD_LABELS,
  downloadOperationsCsv,
  formatPlatformDate,
  formatXof,
  getInvoiceBalance,
  getInvoiceCredits,
  getInvoiceNetPaid,
  printPlatformInvoice,
  type PlatformInvoice,
  type PlatformPaymentMethod,
} from '../../../lib/platformOperations';
import { OperationBadge, OperationEmpty, OperationMetric, OperationPanel, OperationSubmit, operationFieldLabel, operationInputClass, operationSecondaryClass, operationTable, operationTableWrap, operationTd, operationTh, type PlatformOperationPanelProps } from './ui';

const today = () => new Date().toISOString().slice(0, 10);
const nextMonth = () => { const date = new Date(); date.setMonth(date.getMonth() + 1); return date.toISOString().slice(0, 10); };
const statusLabel: Record<PlatformInvoice['status'], string> = { issued: 'Émise', paid: 'Payée', overdue: 'En retard', void: 'Annulée' };
const statusTone = (status: PlatformInvoice['status']) => status === 'paid' ? 'success' as const : status === 'overdue' ? 'danger' as const : status === 'issued' ? 'warning' as const : 'neutral' as const;

const InvoiceCreator: React.FC<PlatformOperationPanelProps & { organizations: PlatformAdminOrganization[] }> = ({ organizations, run, busy }) => {
  const [organizationId, setOrganizationId] = useState('');
  const [shopId, setShopId] = useState('');
  const [periodStart, setPeriodStart] = useState(today());
  const [periodEnd, setPeriodEnd] = useState(nextMonth());
  const [dueOn, setDueOn] = useState(nextMonth());
  const [subtotal, setSubtotal] = useState('12000');
  const [discount, setDiscount] = useState('0');
  const [promoCode, setPromoCode] = useState('');
  const [note, setNote] = useState('');
  const organization = organizations.find((entry) => entry.id === organizationId);
  const shops = organization?.shops ?? [];
  const shop = shops.find((entry) => entry.id === shopId);

  useEffect(() => { setShopId(shops[0]?.id ?? ''); }, [organizationId, organizations.length]);
  useEffect(() => {
    if (shop && subtotal === '12000') {
      // Le montant reste explicitement modifiable : les tarifs personnalisés
      // sont gérés dans le module Offres & renouvellements.
      setPeriodEnd(shop.subscription.renews_on ?? nextMonth());
      setDueOn(shop.subscription.renews_on ?? nextMonth());
    }
  }, [shopId]);

  return (
    <OperationPanel title="Créer une facture d’abonnement" description="Facture liée à une agence et à une période, jamais à une commande du pressing.">
      {organizations.length === 0 ? <OperationEmpty>Aucun pressing client n’est encore inscrit.</OperationEmpty> : (
        <form onSubmit={(event) => { event.preventDefault(); if (!organization || !shop) return; run('invoice.create', { organization_id: organization.id, shop_id: shop.id, organization_name: organization.name, shop_name: shop.name, period_start: periodStart, period_end: periodEnd, due_on: dueOn, subtotal_xof: Number(subtotal), discount_xof: Number(discount), promo_code: promoCode || null, note }, 'Facture créée et journalisée.'); }}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={operationFieldLabel}>Pressing client<select required aria-label="Pressing client" className={`${operationInputClass} mt-1`} value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Sélectionner…</option>{organizations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
            <label className={operationFieldLabel}>Agence<select required aria-label="Agence" className={`${operationInputClass} mt-1`} value={shopId} onChange={(event) => setShopId(event.target.value)}><option value="">Sélectionner…</option>{shops.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
            <label className={operationFieldLabel}>Début de période<input required aria-label="Début de période de facturation" type="date" className={`${operationInputClass} mt-1`} value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
            <label className={operationFieldLabel}>Fin de période<input required aria-label="Fin de période de facturation" type="date" className={`${operationInputClass} mt-1`} value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
            <label className={operationFieldLabel}>Échéance<input required aria-label="Échéance de la nouvelle facture" type="date" className={`${operationInputClass} mt-1`} value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></label>
            <label className={operationFieldLabel}>Sous-total FCFA<input required aria-label="Sous-total de la facture" type="number" min="1" step="1" className={`${operationInputClass} mt-1`} value={subtotal} onChange={(event) => setSubtotal(event.target.value)} /></label>
            <label className={operationFieldLabel}>Remise FCFA<input required aria-label="Remise de la facture" type="number" min="0" step="1" className={`${operationInputClass} mt-1`} value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
            <label className={operationFieldLabel}>Code promo facultatif<input aria-label="Code promo de la facture" className={`${operationInputClass} mt-1 uppercase`} value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} placeholder="Ex. BIENVENUE" /></label>
          </div>
          <label className={`${operationFieldLabel} mt-3`}>Note sur la facture<textarea aria-label="Note de la nouvelle facture" className={`${operationInputClass} mt-1 min-h-16 resize-y`} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <div className="mt-3 flex justify-end"><OperationSubmit busy={busy} type="submit"><Plus className="h-4 w-4" /> Créer la facture</OperationSubmit></div>
        </form>
      )}
    </OperationPanel>
  );
};

const PromoCreator: React.FC<PlatformOperationPanelProps> = ({ run, busy }) => {
  const [code, setCode] = useState(''); const [type, setType] = useState<'percent' | 'fixed'>('percent'); const [value, setValue] = useState('10'); const [maxUses, setMaxUses] = useState(''); const [endsOn, setEndsOn] = useState('');
  return <OperationPanel title="Codes promotionnels" description="Remise en pourcentage ou en FCFA, validée côté serveur à la création de la facture."><form onSubmit={(event) => { event.preventDefault(); run('promo.save', { code, discount_type: type, value: Number(value), active: true, max_uses: maxUses || null, ends_on: endsOn || null }, 'Code promotionnel enregistré.').then((saved) => { if (saved) setCode(''); }); }}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className={operationFieldLabel}>Code<input required aria-label="Nouveau code promotionnel" className={`${operationInputClass} mt-1 uppercase`} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} pattern="[A-Z0-9_\-]{3,32}" /></label><label className={operationFieldLabel}>Type<select aria-label="Type de remise" className={`${operationInputClass} mt-1`} value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="percent">Pourcentage</option><option value="fixed">Montant fixe</option></select></label><label className={operationFieldLabel}>Valeur<input required aria-label="Valeur de la remise promotionnelle" type="number" min="1" max={type === 'percent' ? 100 : undefined} className={`${operationInputClass} mt-1`} value={value} onChange={(event) => setValue(event.target.value)} /></label><label className={operationFieldLabel}>Utilisations max.<input aria-label="Utilisations maximales du code" type="number" min="1" className={`${operationInputClass} mt-1`} value={maxUses} onChange={(event) => setMaxUses(event.target.value)} /></label><label className={operationFieldLabel}>Expiration<input aria-label="Expiration du code promotionnel" type="date" className={`${operationInputClass} mt-1`} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></label></div><div className="mt-3 flex justify-end"><OperationSubmit busy={busy} type="submit"><Plus className="h-4 w-4" /> Enregistrer le code</OperationSubmit></div></form></OperationPanel>;
};

export const FinancePanel: React.FC<PlatformOperationPanelProps & { organizations: PlatformAdminOrganization[] }> = ({ snapshot, organizations, run, busy }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PlatformPaymentMethod>('wave');
  const [paymentStatus, setPaymentStatus] = useState<'recorded' | 'failed' | 'refunded'>('recorded');
  const [paymentAmount, setPaymentAmount] = useState('0');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [creditAmount, setCreditAmount] = useState('0');
  const [creditReason, setCreditReason] = useState('');
  const selected = snapshot.invoices.find((entry) => entry.id === selectedId) ?? null;
  const mobileReferenceRequired = paymentStatus !== 'failed' && ['wave', 'orange_money', 'mtn_momo', 'moov_money'].includes(paymentMethod);
  const allPayments = useMemo(() => snapshot.invoices.flatMap((invoice) => invoice.payments.map((payment) => ({ invoice, payment }))), [snapshot.invoices]);
  const monthCollected = allPayments.filter(({ payment }) => payment.paid_at.startsWith(new Date().toISOString().slice(0, 7))).reduce((sum, { payment }) => sum + (payment.status === 'recorded' ? payment.amount_xof : payment.status === 'refunded' ? -payment.amount_xof : 0), 0);

  useEffect(() => {
    if (!selected) return;
    setPaymentAmount(String(getInvoiceBalance(selected)));
    setCreditAmount(String(getInvoiceBalance(selected)));
  }, [selectedId, selected?.payments.length, selected?.credit_notes.length, selected?.total_xof]);

  const exportInvoices = () => downloadOperationsCsv('factures-pressingpro.csv', ['Numéro', 'Pressing', 'Agence', 'Statut', 'Échéance', 'Sous-total', 'Remise', 'Total', 'Payé net', 'Avoirs', 'Solde'], snapshot.invoices.map((invoice) => [invoice.invoice_number, invoice.organization_name, invoice.shop_name, statusLabel[invoice.status], invoice.due_on, invoice.subtotal_xof, invoice.discount_xof, invoice.total_xof, getInvoiceNetPaid(invoice), getInvoiceCredits(invoice), getInvoiceBalance(invoice)]));
  const exportPayments = () => downloadOperationsCsv('paiements-pressingpro.csv', ['Facture', 'Pressing', 'Date', 'Méthode', 'Statut', 'Référence', 'Montant', 'Note'], allPayments.map(({ invoice, payment }) => [invoice.invoice_number, invoice.organization_name, payment.paid_at, PLATFORM_PAYMENT_METHOD_LABELS[payment.method], payment.status, payment.reference, payment.status === 'refunded' ? -payment.amount_xof : payment.amount_xof, payment.note]));

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OperationMetric label="Factures" value={snapshot.invoices.length} detail={`${snapshot.invoices.filter((entry) => entry.status === 'paid').length} payée(s)`} icon={FileText} />
        <OperationMetric label="Encaissé ce mois" value={formatXof(monthCollected)} detail="Net des remboursements" icon={WalletCards} tone="success" />
        <OperationMetric label="En retard" value={snapshot.invoices.filter((entry) => entry.status === 'overdue').length} detail="Relance et délai de grâce" icon={ReceiptText} tone="danger" />
        <OperationMetric label="Transactions" value={allPayments.length} detail={`${allPayments.filter(({ payment }) => payment.status === 'failed').length} échec(s)`} icon={RotateCcw} />
      </section>

      <div className="flex flex-wrap justify-end gap-2"><button type="button" className={operationSecondaryClass} onClick={exportInvoices}><Download className="h-4 w-4" /> Export factures CSV</button><button type="button" className={operationSecondaryClass} onClick={exportPayments}><Download className="h-4 w-4" /> Export paiements CSV</button></div>
      <InvoiceCreator snapshot={snapshot} organizations={organizations} run={run} busy={busy} refresh={() => undefined} />

      <OperationPanel title="Factures et règlements" description="Sélectionnez une facture pour enregistrer un règlement, un échec, un remboursement ou un avoir.">
        {snapshot.invoices.length === 0 ? <OperationEmpty>Aucune facture. Créez la première depuis le formulaire ci-dessus.</OperationEmpty> : (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
            <div className={operationTableWrap}><table className={operationTable}><thead><tr><th className={operationTh}>Facture</th><th className={operationTh}>Client</th><th className={operationTh}>Échéance</th><th className={operationTh}>Total / solde</th><th className={operationTh}>Statut</th></tr></thead><tbody>{snapshot.invoices.map((invoice) => <tr key={invoice.id} className={`cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 ${selectedId === invoice.id ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`} onClick={() => setSelectedId(invoice.id)}><td className={operationTd}><button type="button" className="font-black text-blue-700 hover:underline dark:text-blue-300" onClick={() => setSelectedId(invoice.id)}>{invoice.invoice_number}</button><span className="block text-[10px] text-zinc-400">{formatPlatformDate(invoice.created_at)}</span></td><td className={operationTd}><strong>{invoice.organization_name}</strong><span className="block text-zinc-500">{invoice.shop_name}</span></td><td className={operationTd}>{invoice.due_on}</td><td className={operationTd}><strong>{formatXof(invoice.total_xof)}</strong><span className="block text-zinc-500">Solde {formatXof(getInvoiceBalance(invoice))}</span></td><td className={operationTd}><OperationBadge tone={statusTone(invoice.status)}>{statusLabel[invoice.status]}</OperationBadge></td></tr>)}</tbody></table></div>

            {selected ? <aside className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div><div className="flex flex-wrap items-center gap-2"><h4 className="text-[15px] font-black">{selected.invoice_number}</h4><OperationBadge tone={statusTone(selected.status)}>{statusLabel[selected.status]}</OperationBadge></div><p className="mt-1 text-[11.5px] text-zinc-500">{selected.organization_name} · {selected.shop_name}</p><p className="mt-2 text-[12px] font-bold">Total {formatXof(selected.total_xof)} · Payé net {formatXof(getInvoiceNetPaid(selected))} · Avoirs {formatXof(getInvoiceCredits(selected))}</p></div>
              <div className="flex flex-wrap gap-2"><button type="button" className={operationSecondaryClass} onClick={() => printPlatformInvoice(selected)}><FileText className="h-4 w-4" /> Imprimer facture / PDF</button><button type="button" className={operationSecondaryClass} onClick={() => printPlatformInvoice(selected, true)}><ReceiptText className="h-4 w-4" /> Imprimer reçu</button>{selected.status !== 'void' && selected.status !== 'paid' && <button type="button" className="text-[11px] font-bold text-red-600 hover:underline" disabled={busy} onClick={() => { if (window.confirm(`Annuler la facture ${selected.invoice_number} ?`)) run('invoice.void', { invoice_id: selected.id }, 'Facture annulée sans suppression.'); }}>Annuler la facture</button>}</div>

              <form className="rounded-xl bg-white p-3 dark:bg-zinc-900" onSubmit={(event) => { event.preventDefault(); run('payment.record', { invoice_id: selected.id, amount_xof: Number(paymentAmount), method: paymentMethod, status: paymentStatus, reference: paymentReference, note: paymentNote }, paymentStatus === 'recorded' ? 'Paiement enregistré et facture recalculée.' : paymentStatus === 'refunded' ? 'Remboursement enregistré.' : 'Échec de paiement consigné et alerte créée.').then((saved) => { if (saved) { setPaymentReference(''); setPaymentNote(''); } }); }}><h5 className="text-[12px] font-black">Enregistrer une transaction</h5><div className="mt-3 grid grid-cols-2 gap-2"><label className={operationFieldLabel}>Statut<select aria-label="Statut de la transaction" className={`${operationInputClass} mt-1`} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as typeof paymentStatus)}><option value="recorded">Encaissé</option><option value="failed">Échoué</option><option value="refunded">Remboursé</option></select></label><label className={operationFieldLabel}>Méthode<select aria-label="Méthode de paiement" className={`${operationInputClass} mt-1`} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PlatformPaymentMethod)}>{Object.entries(PLATFORM_PAYMENT_METHOD_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className={operationFieldLabel}>Montant FCFA<input required aria-label="Montant de la transaction" type="number" min="1" className={`${operationInputClass} mt-1`} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></label><label className={operationFieldLabel}>Référence{mobileReferenceRequired ? ' obligatoire' : ''}<input required={mobileReferenceRequired} aria-label="Référence de la transaction" className={`${operationInputClass} mt-1`} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder={mobileReferenceRequired ? 'Réf. opérateur obligatoire' : 'Réf. opérateur'} /></label></div><label className={`${operationFieldLabel} mt-2`}>Note<textarea aria-label="Note de la transaction" className={`${operationInputClass} mt-1 min-h-14`} value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder={paymentStatus === 'failed' ? 'Motif retourné par l’opérateur…' : 'Note facultative'} /></label><OperationSubmit busy={busy} type="submit" className={`${operationSecondaryClass} mt-2 w-full`}>Enregistrer la transaction</OperationSubmit></form>

              <form className="rounded-xl bg-white p-3 dark:bg-zinc-900" onSubmit={(event) => { event.preventDefault(); run('credit_note.create', { invoice_id: selected.id, amount_xof: Number(creditAmount), reason: creditReason }, 'Avoir créé et solde recalculé.').then((saved) => { if (saved) setCreditReason(''); }); }}><h5 className="text-[12px] font-black">Créer un avoir</h5><div className="mt-2 grid grid-cols-2 gap-2"><label className={operationFieldLabel}>Montant<input required aria-label="Montant de l’avoir" type="number" min="1" className={`${operationInputClass} mt-1`} value={creditAmount} onChange={(event) => setCreditAmount(event.target.value)} /></label><label className={operationFieldLabel}>Motif<input required aria-label="Motif de l’avoir" className={`${operationInputClass} mt-1`} value={creditReason} onChange={(event) => setCreditReason(event.target.value)} minLength={2} /></label></div><OperationSubmit busy={busy} type="submit" className={`${operationSecondaryClass} mt-2 w-full`}>Créer l’avoir</OperationSubmit></form>

              <div><h5 className="text-[12px] font-black">Historique de la facture</h5>{selected.payments.length === 0 && selected.credit_notes.length === 0 ? <p className="mt-2 text-[11px] text-zinc-500">Aucune transaction.</p> : <ul className="mt-2 space-y-1.5">{selected.payments.map((payment) => <li key={payment.id} className="rounded-lg bg-white p-2 text-[10.5px] dark:bg-zinc-900"><div className="flex justify-between gap-2"><strong>{PLATFORM_PAYMENT_METHOD_LABELS[payment.method]} · {payment.status}</strong><span>{payment.status === 'refunded' ? '−' : ''}{formatXof(payment.amount_xof)}</span></div><span className="text-zinc-500">{formatPlatformDate(payment.paid_at)} · {payment.reference || 'Sans référence'}</span>{payment.note && <p className="mt-1">{payment.note}</p>}</li>)}{selected.credit_notes.map((credit) => <li key={credit.id} className="rounded-lg bg-white p-2 text-[10.5px] dark:bg-zinc-900"><div className="flex justify-between gap-2"><strong>{credit.credit_number}</strong><span>−{formatXof(credit.amount_xof)}</span></div><span className="text-zinc-500">{credit.reason}</span></li>)}</ul>}</div>
            </aside> : <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-[12px] text-zinc-500 dark:border-zinc-700">Sélectionnez une facture pour afficher ses règlements.</div>}
          </div>
        )}
      </OperationPanel>
      <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[11.5px] leading-relaxed text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><strong>Connecteurs Mobile Money :</strong> les méthodes Wave, Orange Money, MTN MoMo et Moov Money sont prises en charge dans le ledger. Un paiement n’est marqué encaissé que lorsqu’un administrateur l’enregistre avec sa référence ; aucun appel opérateur ni statut « envoyé » n’est simulé sans identifiants marchands.</p>
    </div>
  );
};
