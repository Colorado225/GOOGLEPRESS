import React from 'react';
import { Customer, LaundryOrder } from '../../types';
import { formatFCFA } from '../../data/demoData';
import { encodeCode39 } from '../../lib/barcode';

export type ReceiptVariant = 'client' | 'atelier';

/**
 * Coordonnées de la boutique imprimées sur le reçu.
 * (Valeurs alignées sur l'écran Paramètres ; elles y deviendront éditables
 * lorsque les paramètres seront persistés.)
 */
export const SHOP_INFO = {
  name: 'PRESSING PRO CI',
  tagline: 'Pressing & Blanchisserie — Haute qualité',
  address: 'Rue des Jardins, Cocody • Abidjan',
  phone: '+225 07 08 09 10 11',
} as const;

const PAYMENT_LABELS: Record<LaundryOrder['paymentMethod'], string> = {
  especes: 'Espèces',
  wave: 'Wave',
  momo: 'MTN MoMo',
  om: 'Orange Money',
};

const STATUS_LABELS: Record<LaundryOrder['status'], string> = {
  received: 'Reçu au comptoir',
  washing: 'En lavage',
  ironing: 'Repassage / finition',
  ready: 'Prêt au retrait',
  delivered: 'Livré au client',
};

/** Nombre au format français (ex. 4,5 kg). */
const formatQty = (value: number): string =>
  value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** Bord dentelé façon papier thermique déchiré (écran uniquement). */
const ZigzagEdge: React.FC<{ flip?: boolean }> = ({ flip = false }) => {
  const width = 340;
  const tooth = 10;
  const height = 7;
  const points: string[] = ['0,0', `${width},0`];
  for (let x = width; x > 0; x -= tooth) {
    points.push(`${x - tooth / 2},${height}`, `${Math.max(x - tooth, 0)},0`);
  }
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={`block w-full h-[7px] shrink-0 print:hidden ${flip ? 'rotate-180' : ''}`}
    >
      <polygon points={points.join(' ')} className="fill-white" />
    </svg>
  );
};

/** Code-barres Code 39 réel, généré depuis le numéro de ticket. */
const TicketBarcode: React.FC<{ value: string }> = ({ value }) => {
  const { bars, totalWidth, encodedText } = encodeCode39(value);
  if (!encodedText) return null;
  return (
    <svg
      viewBox={`0 0 ${totalWidth} 40`}
      preserveAspectRatio="none"
      style={{ width: 232, height: 42 }}
      role="img"
      aria-label={`Code-barres du ticket ${value}`}
      className="max-w-full"
    >
      {bars.map((bar, i) => (
        <rect key={i} x={bar.x} y={0} width={bar.width} height={40} fill="#09090b" />
      ))}
    </svg>
  );
};

const SepDashed: React.FC = () => <div className="border-t border-dashed border-zinc-400" aria-hidden="true" />;
const SepDouble: React.FC = () => (
  <div aria-hidden="true">
    <div className="border-t-2 border-zinc-900" />
    <div className="border-t border-zinc-900 mt-[2px]" />
  </div>
);

const MetaRow: React.FC<{ label: string; value: React.ReactNode; bold?: boolean }> = ({ label, value, bold }) => (
  <div className="flex justify-between gap-3">
    <span className="text-zinc-600 shrink-0">{label}</span>
    <span className={`text-right ${bold ? 'font-bold text-zinc-950' : 'text-zinc-900'}`}>{value}</span>
  </div>
);

interface ReceiptTicketProps {
  order: LaundryOrder;
  variant: ReceiptVariant;
  customer?: Customer | null;
}

/**
 * Reçu au format ticket thermique 80 mm, monochrome (fidèle à une impression
 * réelle). Deux exemplaires : « client » (prix, acompte, reste à payer,
 * conditions) et « atelier » (production, sans aucun prix).
 * Tous les champs affichés proviennent de la commande — rien n'est inventé :
 * les informations absentes sont simplement omises (ou « Non renseigné »).
 */
export const ReceiptTicket: React.FC<ReceiptTicketProps> = ({ order, variant, customer }) => {
  const isClient = variant === 'client';
  const isSettled = order.remainingBalance <= 0;

  let pieces = 0;
  let kilos = 0;
  order.lines.forEach((line) => {
    if (line.pricingType === 'kilo') kilos += line.weightKg ?? line.quantity;
    else pieces += line.quantity;
  });
  const itemsSummaryParts: string[] = [];
  if (pieces > 0) itemsSummaryParts.push(`${formatQty(pieces)} pièce${pieces > 1 ? 's' : ''}`);
  if (kilos > 0) itemsSummaryParts.push(`${formatQty(kilos)} kg au poids`);
  const itemsSummary = itemsSummaryParts.join(' + ') || '—';

  const loyaltyPercent =
    customer && customer.loyaltyDiscountPercent > 0 ? customer.loyaltyDiscountPercent : null;

  return (
    <div className="w-[340px] max-w-full mx-auto">
      <ZigzagEdge flip />
      <div className="bg-white text-zinc-900 font-mono text-[12px] leading-snug px-5 py-5 shadow-[0_18px_45px_-12px_rgba(0,0,0,0.45)] print:shadow-none">
        {/* ─── En-tête boutique ─── */}
        <div className="text-center">
          <div className="w-9 h-9 bg-zinc-950 text-white flex items-center justify-center font-sans font-black text-[17px] rounded-md mx-auto">
            P
          </div>
          <h2 className="font-sans font-black text-[18px] tracking-tight mt-1.5">{SHOP_INFO.name}</h2>
          <p className="text-[10.5px] text-zinc-600">{SHOP_INFO.tagline}</p>
          <p className="text-[10.5px] text-zinc-600 mt-1">{SHOP_INFO.address}</p>
          <p className="text-[10.5px] text-zinc-600">Tél : {SHOP_INFO.phone}</p>
        </div>

        <div className="mt-3">
          <SepDouble />
        </div>

        {/* ─── Type de document + numéro ─── */}
        <div className="flex items-center justify-between mt-2.5">
          <span className="font-sans font-black text-[13px] tracking-wide">
            {isClient ? 'REÇU CLIENT' : 'FICHE ATELIER'}
          </span>
          <span className="text-[10px] font-bold border border-zinc-900 px-1.5 py-0.5 rounded-sm">
            {order.serviceCategory === 'blanchisserie' ? 'BLANCHISSERIE' : 'PRESSING'}
            {order.serviceFees > 0 ? ' • EXPRESS' : ''}
            {order.isUrgent ? ' • URGENT' : ''}
          </span>
        </div>

        <p className="text-center font-sans font-black text-[26px] tracking-tight mt-2">
          {order.ticketNumber}
        </p>

        <SepDashed />

        {/* ─── Dates & statut ─── */}
        <div className="space-y-1 mt-2.5 text-[11.5px]">
          <MetaRow label="Déposé le" value={order.receivedAt} />
          <MetaRow label="Statut" value={STATUS_LABELS[order.status]} bold />
          {order.readyAt && <MetaRow label="Prêt le" value={order.readyAt} />}
          {order.deliveredAt && <MetaRow label="Livré le" value={order.deliveredAt} />}
          {order.rackLocation && <MetaRow label="Casier" value={order.rackLocation} />}
        </div>

        <div className="border-2 border-zinc-950 rounded-sm text-center px-3 py-2 mt-3">
          <p className="text-[9.5px] font-bold tracking-[0.18em] text-zinc-600">RETRAIT PRÉVU</p>
          <p className="font-sans font-black text-[16px] leading-tight mt-0.5">{order.promisedAt}</p>
        </div>

        {/* ─── Client ─── */}
        <div className="mt-3">
          <SepDashed />
        </div>
        <div className="mt-2.5 text-[11.5px]">
          <p className="text-[9.5px] font-bold tracking-[0.18em] text-zinc-600">CLIENT</p>
          <p className="font-bold text-[13px] mt-0.5">
            {order.customerName}
            {customer?.isVip ? <span className="text-[11px]"> ★ VIP</span> : null}
          </p>
          <p className="text-zinc-700">{order.customerPhone}</p>
          {order.customerAddress && <p className="text-zinc-600 text-[11px]">{order.customerAddress}</p>}
        </div>

        {/* ─── Articles ─── */}
        <div className="mt-3">
          <SepDashed />
        </div>
        <div className="mt-2.5">
          <div className="flex justify-between text-[9.5px] font-bold tracking-[0.18em] text-zinc-600">
            <span>ARTICLES CONFIÉS</span>
            {isClient && <span>MONTANT</span>}
          </div>
          <div className="divide-y divide-zinc-200 mt-1">
            {order.lines.map((line, idx) => {
              const isKilo = line.pricingType === 'kilo';
              const qtyLabel = isKilo
                ? `${formatQty(line.weightKg ?? line.quantity)} kg`
                : `${formatQty(line.quantity)} ×`;
              const priceDetail = isKilo
                ? `à ${formatFCFA(line.unitPrice)}/kg`
                : line.quantity > 1
                ? `${formatQty(line.quantity)} × ${formatFCFA(line.unitPrice)}`
                : formatFCFA(line.unitPrice);
              return (
                <div key={line.id ?? idx} className="py-1.5">
                  <div className="flex justify-between gap-3">
                    <p className="min-w-0">
                      <span className="font-bold">{qtyLabel}</span> {line.name}
                    </p>
                    {isClient && (
                      <span className="font-bold tabular-nums shrink-0">{formatFCFA(line.subtotal)}</span>
                    )}
                  </div>
                  <p className="text-[10.5px] text-zinc-600">
                    {line.serviceType}
                    {isClient ? ` • ${priceDetail}` : ''}
                    {line.color ? ` • Couleur : ${line.color}` : ''}
                  </p>
                  {line.notes && (
                    <p className="text-[10.5px] italic text-zinc-700">↳ {line.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10.5px] text-zinc-600 mt-1">Total articles : {itemsSummary}</p>
        </div>

        {/* ─── Totaux & paiement (exemplaire client) ─── */}
        {isClient && (
          <>
            <div className="mt-2.5">
              <SepDashed />
            </div>
            <div className="space-y-1 mt-2.5 text-[11.5px]">
              <MetaRow label="Sous-total" value={<span className="tabular-nums">{formatFCFA(order.subtotal)}</span>} />
              {order.serviceFees > 0 && (
                <MetaRow
                  label="Supplément express"
                  value={<span className="tabular-nums">+{formatFCFA(order.serviceFees)}</span>}
                />
              )}
              {order.discount > 0 && (
                <MetaRow
                  label={loyaltyPercent ? `Remise fidélité (−${loyaltyPercent} %)` : 'Remise fidélité'}
                  value={<span className="tabular-nums">−{formatFCFA(order.discount)}</span>}
                />
              )}
            </div>

            <div className="border-y-2 border-zinc-950 mt-2.5 py-1.5 flex justify-between items-baseline">
              <span className="font-sans font-black text-[14px] tracking-wide">TOTAL</span>
              <span className="font-sans font-black text-[19px] tabular-nums">{formatFCFA(order.total)}</span>
            </div>

            <div className="space-y-1 mt-2.5 text-[11.5px]">
              <MetaRow
                label={`Acompte reçu (${PAYMENT_LABELS[order.paymentMethod]})`}
                value={<span className="tabular-nums font-bold">{formatFCFA(order.depositPaid)}</span>}
              />
            </div>

            {isSettled ? (
              <div className="text-center mt-3">
                <span className="inline-block border-[2.5px] border-emerald-700 text-emerald-700 font-sans font-black tracking-[0.14em] text-[13px] px-3 py-1 rounded-sm rotate-[-3deg]">
                  ✓ SOLDÉ — PAYÉ
                </span>
              </div>
            ) : (
              <>
                <div className="bg-zinc-950 text-white flex justify-between items-baseline px-3 py-2 mt-3">
                  <span className="font-sans font-black text-[11px] tracking-wide">RESTE À PAYER</span>
                  <span className="font-sans font-black text-[16px] tabular-nums">
                    {formatFCFA(order.remainingBalance)}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-600 text-center mt-1">à régler au retrait du linge</p>
              </>
            )}
          </>
        )}

        {/* ─── Informations de production (fiche atelier) ─── */}
        {!isClient && (
          <>
            <div className="mt-2.5">
              <SepDashed />
            </div>
            <div className="mt-2.5 text-[11.5px] space-y-1">
              <p className="text-[9.5px] font-bold tracking-[0.18em] text-zinc-600">PRODUCTION</p>
              <MetaRow label="Machine" value={order.machineAssigned ?? 'Non renseignée'} />
              <MetaRow label="Responsable" value={order.assignee ?? 'Non assigné'} />
              <MetaRow label="Casier" value={order.rackLocation ?? 'Non renseigné'} />
              {typeof order.progressPercent === 'number' && (
                <div className="pt-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Avancement</span>
                    <span className="font-bold tabular-nums">{order.progressPercent} %</span>
                  </div>
                  <div className="h-2 bg-zinc-200 mt-1" aria-hidden="true">
                    <div className="h-full bg-zinc-950" style={{ width: `${Math.min(100, Math.max(0, order.progressPercent))}%` }} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── Consignes ─── */}
        {order.notes && (
          <>
            <div className="mt-3">
              <SepDashed />
            </div>
            <div className={`mt-2.5 text-[11px] ${isClient ? '' : 'border-2 border-zinc-950 rounded-sm px-2.5 py-2'}`}>
              <p className="text-[9.5px] font-bold tracking-[0.18em] text-zinc-600">CONSIGNES</p>
              <p className="mt-0.5 whitespace-pre-line">{order.notes}</p>
            </div>
          </>
        )}

        {/* ─── Pied de ticket ─── */}
        <div className="mt-3">
          <SepDouble />
        </div>
        {isClient ? (
          <div className="text-[9.5px] leading-[1.45] text-zinc-700 mt-2.5 space-y-1">
            <p>• Retrait uniquement contre présentation de ce reçu ou du SMS de confirmation.</p>
            <p>• Merci de vérifier vos articles au comptoir lors du retrait.</p>
            <p>
              • Articles non réclamés 30 jours après la date de retrait prévue : l'établissement ne
              pourra être tenu responsable de leur conservation.
            </p>
          </div>
        ) : (
          <p className="text-[9.5px] leading-[1.45] text-zinc-700 mt-2.5">
            Fiche à joindre au linge pendant tout le traitement. Ne pas remettre au client.
          </p>
        )}

        <p className="text-center font-sans font-black text-[12.5px] mt-3">
          {isClient ? 'Merci de votre confiance !' : 'Bon traitement !'}
        </p>

        <div className="text-center mt-2 flex flex-col items-center">
          <TicketBarcode value={order.ticketNumber} />
          <p className="text-[10px] tracking-[0.3em] mt-1">{order.ticketNumber.replace('#', '')}</p>
          <p className="text-[9px] text-zinc-500 mt-1.5">
            {isClient
              ? 'Exemplaire client — à conserver pour le retrait'
              : 'Exemplaire atelier — usage interne'}
          </p>
        </div>
      </div>
      <ZigzagEdge />
    </div>
  );
};
