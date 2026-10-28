import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
import { Search, Plus, CheckCircle, UserCheck } from 'lucide-react';
import { formatFCFA } from '../../data/demoData';

export const CustomerSection: React.FC = () => {
  const {
    customers,
    selectedCustomer,
    setSelectedCustomer,
    setNewCustomerModalOpen,
    pendingPickupTask,
  } = useApp();
  const customerLocked = Boolean(pendingPickupTask);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      c.phone.includes(filterQuery) ||
      c.address.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-4 shadow-2xs relative">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span>1 • Client</span>
        </h2>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> {customerLocked ? 'Ramassage lié' : 'Fiche retrouvée'}
        </span>
      </div>

      {customerLocked && (
        <p className="mb-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 px-3 py-2 text-[12px] text-emerald-900 dark:text-emerald-100">
          Client verrouillé pendant la conversion du ramassage. Pour changer de client,
          détachez d’abord la tournée depuis le bandeau en haut du POS.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 relative">
        <div className="flex-1 relative">
          <input
            type="text"
            disabled={customerLocked}
            value={
              dropdownOpen
                ? filterQuery
                : selectedCustomer
                  ? `${selectedCustomer.name} — ${selectedCustomer.phone}`
                  : ''
            }
            onFocus={() => {
              setDropdownOpen(true);
              setFilterQuery('');
            }}
            onChange={(e) => {
              setFilterQuery(e.target.value);
              setDropdownOpen(true);
            }}
            placeholder="Rechercher nom, téléphone ou quartier..."
            className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-[13.5px] font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 bg-zinc-50/50 dark:bg-zinc-800/50"
          />

          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredCustomers.length === 0 ? (
                <div className="p-3 text-[12.5px] text-zinc-500 dark:text-zinc-400 text-center">
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
                    className={`w-full text-left p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between ${
                      cust.id === selectedCustomer?.id ? 'bg-blue-50/70 dark:bg-blue-950/70 font-semibold' : ''
                    }`}
                  >
                    <div>
                      <p className="text-[13px] text-zinc-900 dark:text-zinc-100">{cust.name}</p>
                      <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
                        {cust.phone} • {cust.address}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
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
          disabled={customerLocked}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 rounded-lg px-3 py-2 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          title={customerLocked ? 'Client verrouillé par le ramassage en conversion' : 'Rechercher un client'}
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={customerLocked}
          onClick={() => setNewCustomerModalOpen(true)}
          className="bg-[#09090b] dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
          title={customerLocked ? 'Détachez le ramassage avant de créer un autre client' : undefined}
        >
          <Plus className="w-3.5 h-3.5" /> Nouveau
        </button>
      </div>

      {/* Fiche du client actif. Sur un espace réel encore vide, aucun client
          n'existe : on n'affiche aucune fiche plutôt qu'un dossier fictif. */}
      {selectedCustomer ? (
        <div className="flex flex-wrap gap-2 mt-2.5 text-[12px]">
          <span className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full px-3 py-1 font-medium">
            📍 {selectedCustomer.address}
          </span>
          <span className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full px-3 py-1 font-medium">
            ⭐ {selectedCustomer.depositsCount > 20 ? 'Fidèle' : 'Client'} — {selectedCustomer.depositsCount} dépôts
          </span>
          <span
            className={`border rounded-full px-3 py-1 font-semibold ${
              selectedCustomer.balance > 0
                ? 'bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            💳 Solde : {formatFCFA(selectedCustomer.balance)}
          </span>
          {selectedCustomer.loyaltyDiscountPercent > 0 && (
            <span className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-full px-3 py-1 font-semibold">
              🎁 Remise fidélité {selectedCustomer.loyaltyDiscountPercent}%
            </span>
          )}
        </div>
      ) : (
        <p className="mt-2.5 text-[12px] text-zinc-500 dark:text-zinc-400">
          Aucun client sélectionné. Recherchez un dossier existant ou créez le premier client
          du pressing avant d’enregistrer une réception.
        </p>
      )}
    </div>
  );
};
