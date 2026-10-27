import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { X, Printer, Smartphone, Check, Sparkles } from 'lucide-react';

export const TicketPreviewModal: React.FC = () => {
  const { previewTicket, setPreviewTicket, showToast } = useApp();

  if (!previewTicket) return null;

  const order = previewTicket;

  const handlePrint = () => {
    window.print();
    showToast('Impression du ticket envoyée');
  };

  const handleSendSms = () => {
    showToast(`SMS envoyé au ${order.customerPhone} : "Votre ticket ${order.ticketNumber} est disponible."`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="bg-[#09090b] text-white px-5 py-3.5 flex items-center justify-between">
          <p className="font-bold text-[14.5px]">Aperçu du ticket pressing</p>
          <button
            onClick={() => setPreviewTicket(null)}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Ticket Body */}
        <div className="p-6 text-zinc-900 font-sans space-y-4 text-[13px] bg-zinc-50/50">
          {/* Header */}
          <div className="text-center border-b border-dashed border-zinc-300 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black mx-auto mb-1">
              P
            </div>
            <h2 className="font-black text-[16px] tracking-tight">PRESSING PRO CI</h2>
            <p className="text-[11.5px] text-zinc-500">Pressing & Blanchisserie Haute Qualité</p>
            <p className="text-[11px] text-zinc-500">Rue des Jardins, Cocody • Abidjan</p>
            <p className="text-[11px] text-zinc-500">Tél : +225 07 08 09 10 11</p>
          </div>

          {/* Ticket Meta */}
          <div className="flex justify-between text-[12px] py-1 border-b border-zinc-200">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-zinc-900">{order.ticketNumber}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                    order.serviceCategory === 'blanchisserie'
                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {order.serviceCategory === 'blanchisserie' ? 'BLANCHISSERIE' : 'PRESSING'}
                </span>
              </div>
              <p className="text-zinc-500">{order.receivedAt}</p>
            </div>
            <div className="text-right">
              <span className="font-bold px-2 py-0.5 rounded bg-zinc-200 text-zinc-800 text-[11px]">
                {order.status.toUpperCase()}
              </span>
              <p className="text-[11px] text-zinc-500 mt-0.5">Poste 01 • Awa K.</p>
            </div>
          </div>

          {/* Client Details */}
          <div className="bg-white p-3 rounded-lg border border-zinc-200 text-[12px]">
            <p className="font-bold text-zinc-900">{order.customerName}</p>
            <p className="text-zinc-600">{order.customerPhone}</p>
            {order.customerAddress && (
              <p className="text-zinc-500 text-[11px]">{order.customerAddress}</p>
            )}
          </div>

          {/* Items Table */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase text-zinc-500 tracking-wider">
              Articles confiés :
            </p>
            <div className="divide-y divide-zinc-200 bg-white border border-zinc-200 rounded-lg p-2.5">
              {order.lines.map((line, idx) => (
                <div key={idx} className="flex justify-between py-1.5 text-[12px]">
                  <div>
                    <span className="font-bold text-zinc-900">
                      {line.quantity} {line.pricingType === 'kilo' ? 'kg' : '×'}
                    </span>{' '}
                    {line.name}
                    <p className="text-[10.5px] text-zinc-500">— {line.serviceType}</p>
                  </div>
                  <span className="font-semibold text-zinc-900 tabular-nums">
                    {formatFCFA(line.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Retrait date */}
          <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-900 text-[12px]">
            <p className="font-bold">Date de retrait promise :</p>
            <p className="text-[13px] font-extrabold text-amber-950 mt-0.5">{order.promisedAt}</p>
          </div>

          {/* Total Breakdown */}
          <div className="border-t border-dashed border-zinc-300 pt-2 space-y-1 text-[12.5px]">
            <div className="flex justify-between text-zinc-600">
              <span>Sous-total</span>
              <span className="tabular-nums font-medium">{formatFCFA(order.subtotal)}</span>
            </div>
            {order.serviceFees > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>Supplément express</span>
                <span className="tabular-nums font-medium">+{formatFCFA(order.serviceFees)}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex justify-between text-blue-700">
                <span>Remise fidélité</span>
                <span className="tabular-nums font-medium">−{formatFCFA(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-[15px] pt-1 border-t border-zinc-200 text-zinc-950">
              <span>TOTAL</span>
              <span className="tabular-nums">{formatFCFA(order.total)}</span>
            </div>
            <div className="flex justify-between text-zinc-600 text-[12px]">
              <span>Acompte reçu ({order.paymentMethod.toUpperCase()})</span>
              <span className="tabular-nums font-semibold">{formatFCFA(order.depositPaid)}</span>
            </div>
            <div className="flex justify-between font-bold text-[13px] text-zinc-900">
              <span>Reste à payer au retrait</span>
              <span className="tabular-nums text-purple-700">{formatFCFA(order.remainingBalance)}</span>
            </div>
          </div>

          {/* Barcode simulation */}
          <div className="text-center pt-2">
            <div className="inline-block tracking-widest font-mono text-[11px] text-zinc-500 bg-zinc-200 px-4 py-1.5 rounded">
              ||||| | |||| ||| ||||||| | ||| {order.ticketNumber}
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">
              Conservez ce ticket ou le SMS pour le retrait du linge.
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="bg-zinc-100 p-3 flex gap-2 border-t border-zinc-200">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 font-bold py-2 rounded-lg text-[13px] transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimer
          </button>
          <button
            type="button"
            onClick={handleSendSms}
            className="flex-1 bg-[#09090b] hover:bg-zinc-800 text-white font-bold py-2 rounded-lg text-[13px] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-400" /> Reçu SMS
          </button>
        </div>
      </div>
    </div>
  );
};
