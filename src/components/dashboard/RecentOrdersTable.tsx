import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { LaundryOrder } from '../../types';
import { Search, Eye, Filter } from 'lucide-react';
import { Frame, FramePanel, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Avatar, AvatarFallback, TablePagination } from '../common/DataTable';
import { getInitials } from '../../lib/utils';

const PAGE_SIZE = 5;

export const RecentOrdersTable: React.FC = () => {
  const { orders, setPreviewTicket, setActiveScreen } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

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

  // Pagination : 5 lignes par page, retour à la page 1 dès que le filtre change
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstShown = filteredOrders.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(currentPage * PAGE_SIZE, filteredOrders.length);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

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
    <div className="card-3d mt-3 overflow-hidden rounded-2xl">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 border-b border-zinc-200 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-900">Dernières réceptions</h2>
          <Badge variant="secondary" size="sm">{filteredOrders.length}</Badge>
          <span className="text-[12.5px] text-zinc-500">à traiter en atelier</span>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher client, ticket…"
              aria-label="Rechercher une réception par client, ticket ou article"
              className="border border-zinc-200 rounded-lg pl-8 pr-3 py-1.5 w-48 sm:w-60 text-zinc-900 placeholder-zinc-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrer par statut de commande"
            className="border border-zinc-200 rounded-lg px-2.5 py-1.5 font-semibold text-zinc-700 bg-white shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900"
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
            {filteredOrders.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="px-4 py-10 text-center">
                  <p className="text-[13px] font-semibold text-zinc-700">Aucune réception ne correspond à la recherche</p>
                  <p className="mt-0.5 text-[12px] text-zinc-500">Modifiez le texte recherché ou le statut pour élargir la liste.</p>
                </TableCell>
              </TableRow>
            )}
            {paginatedOrders.map((order) => {
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

      {/* Pied : plage affichée, pagination et accès à l'historique complet */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-zinc-200 bg-zinc-50/70 px-4 py-2.5">
        <p className="text-[11.5px] text-zinc-500 tabular-nums" aria-live="polite">
          {filteredOrders.length === 0
            ? 'Aucune commande à afficher'
            : `Affichage de ${firstShown} à ${lastShown} sur ${filteredOrders.length} commande${filteredOrders.length > 1 ? 's' : ''} · Page ${currentPage} sur ${pageCount}`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <TablePagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
          <button
            type="button"
            onClick={() => setActiveScreen('orders')}
            className="text-[12px] font-semibold text-blue-600 hover:text-blue-700"
          >
            Voir toutes les {orders.length} commandes →
          </button>
        </div>
      </div>
    </div>
  );
};
