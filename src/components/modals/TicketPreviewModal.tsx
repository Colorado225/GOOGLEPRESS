import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ReceiptTicket, ReceiptVariant } from '../receipt/ReceiptTicket';
import { printDocument } from '../../lib/print';
import { resolveShopDisplayName } from '../../lib/shopIdentity';
import { formatFCFA } from '../../data/demoData';
import { X, Printer, Copy, ReceiptText, User, WashingMachine } from 'lucide-react';

/**
 * Aperçu du reçu thermique 80 mm d'une commande.
 * Deux exemplaires possibles : client (avec les montants) ou fiche atelier
 * (production, sans prix). L'impression n'imprime que le ticket.
 */
export const TicketPreviewModal: React.FC = () => {
  const { previewTicket, setPreviewTicket, showToast, customers, shopSettings, workspace } =
    useApp();
  const [variant, setVariant] = useState<ReceiptVariant>('client');

  const order = previewTicket;

  // Chaque nouveau ticket s'ouvre sur l'exemplaire client.
  useEffect(() => {
    setVariant('client');
  }, [order?.id]);

  if (!order) return null;

  const customer = customers.find((c) => c.id === order.customerId) ?? null;

  const handlePrint = () => {
    printDocument('receipt');
    showToast(
      variant === 'client'
        ? '🖨️ Reçu client envoyé à l’impression'
        : '🖨️ Fiche atelier envoyée à l’impression'
    );
  };

  const handleCopyMessage = async () => {
    const balanceText =
      order.remainingBalance > 0
        ? ` Reste à payer : ${formatFCFA(order.remainingBalance)}.`
        : ' Commande soldée.';
    const message = `${resolveShopDisplayName(shopSettings, workspace)} — Bonjour ${order.customerName}, votre ticket ${order.ticketNumber} est enregistré. Retrait promis : ${order.promisedAt}.${balanceText} Merci.`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = message;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copied) throw new Error('Copie impossible');
      }
      showToast(
        `Message copié pour ${order.customerPhone} — aucun SMS externe n’est envoyé par l’application.`
      );
    } catch {
      showToast('Copie impossible dans ce navigateur. Le message n’a pas été envoyé.');
    }
  };

  const variantButtonClass = (active: boolean) =>
    `flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 ${
      active ? 'bg-[#09090b] text-white shadow-sm' : 'text-zinc-600 hover:text-black'
    }`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Barre de titre */}
        <div className="bg-[#09090b] text-white px-5 py-3.5 flex items-center justify-between shrink-0 print:hidden">
          <p className="font-bold text-[14.5px] flex items-center gap-2">
            <ReceiptText className="w-4.5 h-4.5 text-blue-400" aria-hidden="true" />
            Reçu du ticket {order.ticketNumber}
          </p>
          <button
            type="button"
            onClick={() => setPreviewTicket(null)}
            className="text-zinc-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 rounded"
            aria-label="Fermer l’aperçu du reçu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Choix de l'exemplaire */}
        <div className="px-4 pt-3 shrink-0 print:hidden">
          <div
            className="flex gap-1 bg-zinc-100 border border-zinc-200 rounded-lg p-1"
            role="tablist"
            aria-label="Exemplaire du reçu"
          >
            <button
              type="button"
              role="tab"
              aria-selected={variant === 'client'}
              onClick={() => setVariant('client')}
              className={variantButtonClass(variant === 'client')}
            >
              <User className="w-3.5 h-3.5" aria-hidden="true" /> Exemplaire client
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={variant === 'atelier'}
              onClick={() => setVariant('atelier')}
              className={variantButtonClass(variant === 'atelier')}
            >
              <WashingMachine className="w-3.5 h-3.5" aria-hidden="true" /> Fiche atelier
            </button>
          </div>
        </div>

        {/* Papier thermique (zone imprimable) */}
        <div className="flex-1 overflow-y-auto bg-zinc-200/70 px-4 py-5 mt-3 print:overflow-visible print:bg-transparent print:p-0 print:m-0">
          <div id="receipt-print-area">
            <ReceiptTicket order={order} variant={variant} customer={customer} />
          </div>
        </div>

        {/* Actions */}
        <div className="bg-zinc-100 p-3 flex gap-2 border-t border-zinc-200 shrink-0 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 font-bold py-2 rounded-lg text-[13px] transition-colors flex items-center justify-center gap-1.5 shadow-2xs focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            {variant === 'client' ? 'Imprimer le reçu' : 'Imprimer la fiche'}
          </button>
          {variant === 'client' && (
            <button
              type="button"
              onClick={handleCopyMessage}
              title="Copie un message à envoyer manuellement au client. Aucun SMS externe n’est envoyé."
              className="flex-1 bg-[#09090b] hover:bg-zinc-800 text-white font-bold py-2 rounded-lg text-[13px] transition-colors flex items-center justify-center gap-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            >
              <Copy className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" /> Copier le message
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
