import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { Search, Plus, UserCheck, Phone, MapPin, ArrowLeft, ShoppingBag } from 'lucide-react';
import { Customer } from '../../types';

export const ClientsPage: React.FC = () => {
  const { customers, setSelectedCustomer, setActiveScreen, setNewCustomerModalOpen } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartOrder = (cust: Customer) => {
    setSelectedCustomer(cust);
    setActiveScreen('pos');
  };

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
              Fichier clients & fidélité
            </h1>
            <p className="text-[13px] text-zinc-500">
              Répertoire des clients particuliers et professionnels à Abidjan
            </p>
          </div>
        </div>

        <button
          onClick={() => setNewCustomerModalOpen(true)}
          className="bg-[#09090b] text-white rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-zinc-800 transition-colors shadow flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Nouveau client</span>
        </button>
      </div>

      <div className="bg-white border border-zinc-200/90 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-3 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher nom, téléphone ou quartier..."
              className="border border-zinc-200 rounded-lg pl-8 pr-3 py-1.5 text-[12.5px] w-72 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <span className="text-[12px] text-zinc-500 font-medium">
            {filteredCustomers.length} clients enregistrés
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {filteredCustomers.map((cust) => (
            <div
              key={cust.id}
              className="border border-zinc-200 hover:border-zinc-300 rounded-xl p-4 bg-zinc-50/40 hover:bg-white transition-all shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-bold text-[14.5px] text-zinc-900 leading-tight">
                      {cust.name}
                    </h3>
                    <p className="text-zinc-500 text-[12px] flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-zinc-400" /> {cust.phone}
                    </p>
                  </div>
                  {cust.loyaltyDiscountPercent > 0 && (
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                      -{cust.loyaltyDiscountPercent}% fidélité
                    </span>
                  )}
                </div>

                <p className="text-zinc-600 text-[12px] flex items-center gap-1 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{cust.address}</span>
                </p>

                <div className="flex items-center justify-between text-[11.5px] py-2 border-t border-zinc-200 text-zinc-600">
                  <span>Dépôts effectués : <b className="text-zinc-900 tabular-nums">{cust.depositsCount}</b></span>
                  <span>Solde : <b className={`tabular-nums ${cust.balance > 0 ? 'text-amber-700 font-bold' : 'text-zinc-900'}`}>{formatFCFA(cust.balance)}</b></span>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleStartOrder(cust)}
                  className="w-full bg-[#09090b] hover:bg-zinc-800 text-white font-semibold text-[12px] py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
                  <span>Prendre un dépôt</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
