import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
import { Search, Plus, CheckCircle, UserCheck } from 'lucide-react';
import { formatFCFA } from '../../data/demoData';

export const CustomerSection: React.FC = () => {
  const { customers, selectedCustomer, setSelectedCustomer, setNewCustomerModalOpen } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      c.phone.includes(filterQuery) ||
      c.address.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="bg-white border border-zinc-200/90 rounded-xl p-4 shadow-2xs relative">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-bold text-[14.5px] text-zinc-900 flex items-center gap-2">
          <span>1 • Client</span>
        </h2>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Fiche retrouvée
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 relative">
        <div className="flex-1 relative">
          <input
            type="text"
            value={dropdownOpen ? filterQuery : `${selectedCustomer.name} — ${selectedCustomer.phone}`}
            onFocus={() => {
              setDropdownOpen(true);
              setFilterQuery('');
            }}
            onChange={(e) => {
              setFilterQuery(e.target.value);
              setDropdownOpen(true);
            }}
            placeholder="Rechercher nom, téléphone ou quartier..."
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-[13.5px] font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-zinc-50/50"
          />

          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-zinc-100">
              {filteredCustomers.length === 0 ? (
                <div className="p-3 text-[12.5px] text-zinc-500 text-center">
                  Aucun client trouvé. Créez une nouvelle fiche ci-contre.
                </div>
              ) : (
                filteredCustomers.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2.5 hover:bg-zinc-50 transition-colors flex items-center justify-between ${
                      cust.id === selectedCustomer.id ? 'bg-blue-50/70 font-semibold' : ''
                    }`}
                  >
                    <div>
                      <p className="text-[13px] text-zinc-900">{cust.name}</p>
                      <p className="text-[11.5px] text-zinc-500">
                        {cust.phone} • {cust.address}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                        {cust.depositsCount} dépôts
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="border border-zinc-200 hover:border-zinc-300 rounded-lg px-3 py-2 text-[13px] font-semibold text-zinc-700 bg-white hover:bg-zinc-50 transition-colors"
          title="Rechercher un client"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setNewCustomerModalOpen(true)}
          className="bg-[#09090b] hover:bg-zinc-800 text-white rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" /> Nouveau
        </button>
      </div>

      {/* Customer summary chips */}
      <div className="flex flex-wrap gap-2 mt-2.5 text-[12px]">
        <span className="bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-full px-3 py-1 font-medium">
          📍 {selectedCustomer.address}
        </span>
        <span className="bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-full px-3 py-1 font-medium">
          ⭐ {selectedCustomer.depositsCount > 20 ? 'Fidèle' : 'Client'} — {selectedCustomer.depositsCount} dépôts
        </span>
        <span
          className={`border rounded-full px-3 py-1 font-semibold ${
            selectedCustomer.balance > 0
              ? 'bg-amber-100 border-amber-300 text-amber-900'
              : 'bg-zinc-100 border-zinc-200 text-zinc-700'
          }`}
        >
          💳 Solde : {formatFCFA(selectedCustomer.balance)}
        </span>
        {selectedCustomer.loyaltyDiscountPercent > 0 && (
          <span className="bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-3 py-1 font-semibold">
            🎁 Remise fidélité {selectedCustomer.loyaltyDiscountPercent}%
          </span>
        )}
      </div>
    </div>
  );
};
