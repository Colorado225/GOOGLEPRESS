import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { KanbanColumn } from './KanbanColumn';
import { HandoverSection } from './HandoverSection';
import { DailyClosingCard } from './DailyClosingCard';
import { OrderStatus } from '../../types';
import { Search, Settings, Smartphone, ArrowLeft } from 'lucide-react';

export const WorkshopPage: React.FC = () => {
  const {
    orders,
    moveOrderStatus,
    setActiveHandoverOrder,
    notifyAllSms,
    setActiveScreen,
    showToast,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [machineStatusModal, setMachineStatusModal] = useState(false);

  const filteredOrders = orders.filter(
    (o) =>
      o.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.lines.some((l) => l.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const receivedOrders = filteredOrders.filter((o) => o.status === 'received');
  const washingOrders = filteredOrders.filter((o) => o.status === 'washing');
  const ironingOrders = filteredOrders.filter((o) => o.status === 'ironing');
  const readyOrders = filteredOrders.filter((o) => o.status === 'ready');

  const handleMoveOrder = (orderId: string, targetStatus: OrderStatus) => {
    moveOrderStatus(orderId, targetStatus);
  };

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-[1366px]">
      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveScreen('dashboard')}
              className="p-1 hover:bg-zinc-200 rounded-lg text-zinc-500 hover:text-black transition-colors"
              title="Retour au tableau de bord"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900">
              Production & remises
            </h1>
          </div>
          <p className="text-[13px] text-zinc-500 ml-7">
            Suivi atelier en temps réel • glisser-déposer tactile • remise et encaissement au comptoir
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ticket / client…"
              className="bg-white border border-zinc-200 rounded-lg pl-8 pr-3 py-1.5 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 shadow-2xs w-36 sm:w-44"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setMachineStatusModal(!machineStatusModal);
              showToast('État des machines : L1 (12kg) en service • L2 (25kg) maintenance 14h');
            }}
            className="bg-white border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded-lg text-zinc-700 transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-500" />
            <span>Machines : L1 ● L2 ◐</span>
          </button>

          <button
            type="button"
            onClick={notifyAllSms}
            className="px-4 py-1.5 rounded-lg bg-[#09090b] hover:bg-zinc-800 text-white transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-400" />
            <span>Tout notifier (11 SMS)</span>
          </button>
        </div>
      </div>

      {/* 4-Column Kanban */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 overflow-x-auto pb-1">
        {/* Column 1 */}
        <KanbanColumn
          title="① Réceptionnés"
          count={receivedOrders.length}
          headerClass="bg-zinc-200 text-zinc-700"
          badgeClass="bg-zinc-800 text-white"
          orders={receivedOrders}
          status="received"
          nextStatus="washing"
          onMoveOrder={handleMoveOrder}
        />

        {/* Column 2 */}
        <KanbanColumn
          title="② Lavage"
          count={washingOrders.length}
          headerClass="bg-blue-100 text-blue-800"
          badgeClass="bg-blue-600 text-white"
          orders={washingOrders}
          status="washing"
          prevStatus="received"
          nextStatus="ironing"
          onMoveOrder={handleMoveOrder}
        />

        {/* Column 3 */}
        <KanbanColumn
          title="③ Repassage / Finition"
          count={ironingOrders.length}
          headerClass="bg-amber-100 text-amber-800"
          badgeClass="bg-amber-500 text-white"
          orders={ironingOrders}
          status="ironing"
          prevStatus="washing"
          nextStatus="ready"
          onMoveOrder={handleMoveOrder}
        />

        {/* Column 4 */}
        <KanbanColumn
          title="④ Prêts à remettre"
          count={readyOrders.length}
          headerClass="bg-purple-600 text-white"
          badgeClass="bg-white text-purple-700"
          orders={readyOrders}
          status="ready"
          prevStatus="ironing"
          onMoveOrder={handleMoveOrder}
          onSelectForHandover={(order) => {
            setActiveHandoverOrder(order);
            showToast(`Commande ${order.ticketNumber} ouverte pour remise au client`);
          }}
        />
      </div>

      {/* Lower section: Remise ouverte + Caisse clôture */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-3">
          <HandoverSection />
        </div>
        <div className="lg:col-span-2">
          <DailyClosingCard />
        </div>
      </div>

      <p className="bg-white border border-zinc-200/90 rounded-xl mt-3 px-4 py-2 text-[11.5px] text-zinc-500 shadow-2xs">
        Maquette 3/3 • Kanban atelier + remise comptoir + caisse Mobile Money (Wave, MTN, Orange) • Données fictives • FCFA
      </p>
    </div>
  );
};
