import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { Search, Eye, Filter, ArrowLeft, ArrowUpDown, List, WashingMachine, PackageCheck, Clock, CheckCircle2, Inbox, Shirt } from 'lucide-react';
import { Tabs } from '../common/Tabs';
import { isOrderLate } from '../../lib/reports';
import { LaundryOrder } from '../../types';

export const OrdersPage: React.FC = () => {
  const { orders, setPreviewTicket, setActiveScreen } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'all' | 'received' | 'washing' | 'ironing' | 'ready' | 'late' | 'delivered'>('all');

  const searchedOrders = orders.filter(
    (order) =>
      order.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.lines.some((l) => l.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Onglets par statut exact du workflow, plus la file transversale des retards à relancer
  const inTab = (order: LaundryOrder, t: typeof tab): boolean => {
    if (t === 'all') return true;
    if (t === 'late') return isOrderLate(order);
    return order.status === t;
  };
  const countFor = (t: typeof tab) => searchedOrders.filter((o) => inTab(o, t)).length;
  const filteredOrders = searchedOrders.filter((o) => inTab(o, tab));

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-[1366px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveScreen('dashboard')}
            className="p-1 hover:bg-zinc-200 rounded-lg text-zinc-500 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900">
              Toutes les commandes
            </h1>
            <p className="text-[13px] text-zinc-500">
              Historique complet des réceptions, ateliers et remises clients
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveScreen('pos')}
          className="bg-[#09090b] text-white rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-zinc-800 transition-colors shadow"
        >
          + Nouvelle réception
        </button>
      </div>

      {/* Onglets par moment du workflow, avec la taille de chaque file */}
      <Tabs
        ariaLabel="Commandes par étape du workflow"
        className="mb-3"
        activeId={tab}
        onChange={setTab}
        tabs={[
          { id: 'all', label: 'Toutes', icon: <List className="w-4 h-4" aria-hidden="true" />, badge: searchedOrders.length },
          { id: 'received', label: 'Réceptionnées', icon: <Inbox className="w-4 h-4" aria-hidden="true" />, badge: countFor('received') },
          { id: 'washing', label: 'Lavage', icon: <WashingMachine className="w-4 h-4" aria-hidden="true" />, badge: countFor('washing') },
          { id: 'ironing', label: 'Repassage', icon: <Shirt className="w-4 h-4" aria-hidden="true" />, badge: countFor('ironing') },
          { id: 'ready', label: 'Prêtes', icon: <PackageCheck className="w-4 h-4" aria-hidden="true" />, badge: countFor('ready') },
          { id: 'late', label: 'En retard', icon: <Clock className="w-4 h-4" aria-hidden="true" />, badge: countFor('late') },
          { id: 'delivered', label: 'Livrées', icon: <CheckCircle2 className="w-4 h-4" aria-hidden="true" />, badge: countFor('delivered') },
        ]}
      />

      <div className="bg-white border border-zinc-200/90 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-3 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par ticket, client, vêtement..."
                className="border border-zinc-200 rounded-lg pl-8 pr-3 py-1.5 text-[12.5px] w-64 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>

          <span className="text-[12px] text-zinc-500 font-medium">
            {filteredOrders.length} commandes répertoriées
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] text-left border-collapse">
            <thead>
              <tr className="text-zinc-500 uppercase text-[11px] font-bold border-b border-zinc-200 bg-zinc-50/80">
                <th className="px-4 py-2.5">Ticket</th>
                <th className="px-4 py-2.5">Client & Contact</th>
                <th className="px-4 py-2.5">Articles confiés</th>
                <th className="px-4 py-2.5">Montant Total</th>
                <th className="px-4 py-2.5">Acompte / Reste</th>
                <th className="px-4 py-2.5">Promis pour</th>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setPreviewTicket(order)}
                  className="hover:bg-zinc-50/80 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-bold text-zinc-900 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{order.ticketNumber}</span>
                      <span
                        className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                          order.serviceCategory === 'blanchisserie'
                            ? 'bg-teal-50 text-teal-700 border-teal-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {order.serviceCategory === 'blanchisserie' ? 'Blanch.' : 'Press.'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-zinc-900">{order.customerName}</p>
                    <p className="text-zinc-500 text-[11.5px]">{order.customerPhone}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 max-w-[200px] truncate">
                    {order.lines.map((l) => `${l.quantity}× ${l.name}`).join(', ')}
                  </td>
                  <td className="px-4 py-3 font-bold text-zinc-900 tabular-nums whitespace-nowrap">
                    {formatFCFA(order.total)}
                  </td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap text-[12px]">
                    <span className="text-zinc-600">Payé {formatFCFA(order.depositPaid)}</span>
                    {order.remainingBalance > 0 && (
                      <p className="text-purple-700 font-bold">Reste {formatFCFA(order.remainingBalance)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                    {order.promisedAt}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        order.status === 'ready'
                          ? 'bg-purple-100 text-purple-700'
                          : order.status === 'washing'
                          ? 'bg-blue-100 text-blue-700'
                          : order.status === 'ironing'
                          ? 'bg-amber-100 text-amber-800'
                          : order.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {order.status === 'ready'
                        ? 'Prêt ✓'
                        : order.status === 'washing'
                        ? 'Lavage'
                        : order.status === 'ironing'
                        ? 'Repassage'
                        : order.status === 'delivered'
                        ? 'Remis ✓'
                        : 'Réceptionné'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewTicket(order);
                      }}
                      className="px-2.5 py-1 text-[11.5px] font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Ticket</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
