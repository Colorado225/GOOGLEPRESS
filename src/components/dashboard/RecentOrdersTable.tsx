import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { LaundryOrder } from '../../types';
import { Search, Eye, Filter } from 'lucide-react';
import { Frame, FramePanel, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Avatar, AvatarFallback } from '../common/DataTable';
import { getInitials } from '../../lib/utils';

export const RecentOrdersTable: React.FC = () => {
  const { orders, setPreviewTicket, setActiveScreen } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.lines.some((l) => l.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'ready' && order.status === 'ready') ||
      (statusFilter === 'washing' && order.status === 'washing') ||
      (statusFilter === 'received' && order.status === 'received') ||
      (statusFilter === 'ironing' && order.status === 'ironing');

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (order: LaundryOrder) => {
    switch (order.status) {
      case 'received':
        return <Badge variant="secondary">Réceptionné</Badge>;
      case 'washing':
        return <Badge variant="info">En atelier</Badge>;
      case 'ironing':
        return <Badge variant="warning">Finition / Repassage</Badge>;
      case 'ready':
        return <Badge variant="purple">Prêt ✓</Badge>;
      case 'delivered':
        return <Badge variant="success">Remis ✓</Badge>;
      default:
        return <Badge variant="outline">{order.status}</Badge>;
    }
  };

  return (
    <div className="bg-white border border-zinc-200/90 rounded-xl mt-3 overflow-hidden shadow-2xs">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-zinc-200 gap-2">
        <h2 className="font-bold text-[14.5px] text-zinc-900">
          Dernières réceptions{' '}
          <span className="font-normal text-zinc-500 text-[13px]">— à traiter en atelier</span>
        </h2>
        <div className="flex items-center gap-2 text-[12px]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 Rechercher client, ticket…"
              className="border border-zinc-200 rounded-lg pl-8 pr-3 py-1.5 w-48 sm:w-60 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-800"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-zinc-200 rounded-lg px-2.5 py-1.5 font-semibold text-zinc-700 bg-white cursor-pointer"
          >
            <option value="all">Tous les statuts</option>
            <option value="received">Réceptionné</option>
            <option value="washing">En atelier (Lavage)</option>
            <option value="ironing">Repassage</option>
            <option value="ready">Prêt</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <Frame>
        <FramePanel className="p-0">
        <Table className="text-[12.5px]">
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Ticket</TableHead>
              <TableHead className="px-4">Client</TableHead>
              <TableHead className="px-4">Articles</TableHead>
              <TableHead className="px-4">Service</TableHead>
              <TableHead className="px-4">Montant</TableHead>
              <TableHead className="px-4">Retour prévu</TableHead>
              <TableHead className="px-4">Statut</TableHead>
              <TableHead className="px-4 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-zinc-200">
            {filteredOrders.slice(0, 7).map((order) => {
              const summaryArticles = order.lines
                .map((l) => `${l.quantity > 1 ? `${l.quantity} ` : ''}${l.name.toLowerCase()}`)
                .join(' + ');

              return (
                <TableRow
                  key={order.id}
                  className="hover:bg-zinc-50/80 transition-colors group cursor-pointer"
                  onClick={() => setPreviewTicket(order)}
                >
                  <TableCell className="px-4 font-bold text-zinc-900 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{order.ticketNumber}</span>
                      <Badge variant={order.serviceCategory === 'blanchisserie' ? 'teal' : 'info'} size="sm" className="rounded-md px-1.5 text-[9.5px] uppercase">{order.serviceCategory === 'blanchisserie' ? 'Blanch.' : 'Press.'}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm" aria-hidden="true">
                        <AvatarFallback>{getInitials(order.customerName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-bold text-zinc-900 leading-snug">{order.customerName}</p>
                        <p className="text-zinc-500 text-[11.5px]">
                          {order.customerPhone} {order.customerAddress ? `• ${order.customerAddress}` : ''}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-zinc-700 capitalize max-w-[220px] truncate">
                    {summaryArticles || 'Articles de pressing'}
                  </TableCell>
                  <TableCell className="px-4 text-zinc-600 whitespace-nowrap">
                    {order.lines[0]?.serviceType || 'Pressing classique'}
                  </TableCell>
                  <TableCell className="px-4 font-bold text-zinc-900 tabular-nums whitespace-nowrap">
                    {formatFCFA(order.total)}
                  </TableCell>
                  <TableCell className="px-4 text-zinc-600 font-medium whitespace-nowrap">
                    {order.promisedAt}
                  </TableCell>
                  <TableCell className="px-4 whitespace-nowrap">{getStatusBadge(order)}</TableCell>
                  <TableCell className="px-4 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewTicket(order);
                      }}
                      className="px-2.5 py-1 text-[11.5px] font-semibold text-zinc-700 hover:text-black bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Ticket</span>
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </FramePanel>
      </Frame>

      {/* Table Footer info */}
      <div className="px-4 py-2 text-[11.5px] text-zinc-500 bg-zinc-50 border-t border-zinc-200 flex flex-wrap items-center justify-between">
        <p>Maquette 1/3 • Shadcn UI + Tailwind • Données en FCFA • Tablette paysage 1366×768</p>
        <button
          onClick={() => setActiveScreen('orders')}
          className="text-blue-600 hover:text-blue-700 font-semibold text-[11.5px]"
        >
          Voir toutes les {orders.length} commandes →
        </button>
      </div>
    </div>
  );
};
