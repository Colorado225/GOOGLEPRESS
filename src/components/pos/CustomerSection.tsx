import React, { useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Phone,
  Search,
  Star,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';

/** Recherche et création du client, sans quitter le parcours de commande. */
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const query = filterQuery.trim().toLowerCase();
  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(query) ||
      customer.phone.toLowerCase().includes(query) ||
      customer.address.toLowerCase().includes(query)
  );

  const initials = selectedCustomer?.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const openNewCustomer = () => {
    setDropdownOpen(false);
    setNewCustomerModalOpen(true);
  };

  return (
    <section className="relative rounded-2xl border border-zinc-200/90 bg-white shadow-[0_12px_35px_-28px_rgba(9,9,11,0.45)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-[0_10px_22px_-14px_rgba(37,99,235,0.9)] [&_svg]:size-5">
            <UserRound aria-hidden="true" />
          </span>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${
            customerLocked
              ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
              : selectedCustomer
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
          }`}>
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            {customerLocked ? 'Ramassage lié' : selectedCustomer ? 'Client sélectionné' : 'À sélectionner'}
          </span>
        </div>

        <h3 className="mt-0.5 text-sm leading-tight font-medium">
          <button
            type="button"
            disabled={customerLocked}
            onClick={() => searchInputRef.current?.focus()}
            className="text-left text-zinc-950 transition-colors hover:text-blue-600 focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-50 dark:hover:text-blue-400"
          >
            Client de la commande
          </button>
        </h3>
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Recherchez une fiche par nom, téléphone ou quartier, puis vérifiez les informations du déposant avant de continuer.
        </p>
        <button
          type="button"
          disabled={customerLocked}
          onClick={openNewCustomer}
          title={customerLocked ? 'Détachez le ramassage avant de créer un autre client' : undefined}
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Nouveau client
          <ChevronRight aria-hidden="true" className="size-2.5 shrink-0" />
        </button>

        {customerLocked && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            Le client est verrouillé pendant la conversion du ramassage. Détachez la tournée depuis le bandeau supérieur pour choisir une autre fiche.
          </p>
        )}

        <div className="group relative mt-1">
          <Search className="pos-field-icon" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="text"
            aria-label="Rechercher un client"
            disabled={customerLocked}
            value={dropdownOpen ? filterQuery : selectedCustomer ? `${selectedCustomer.name} — ${selectedCustomer.phone}` : ''}
            onFocus={() => {
              setDropdownOpen(true);
              setFilterQuery('');
            }}
            onChange={(event) => {
              setFilterQuery(event.target.value);
              setDropdownOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setDropdownOpen(false);
                event.currentTarget.blur();
              }
            }}
            placeholder="Rechercher nom, téléphone ou quartier..."
            className="pos-field pl-10"
          />

          {dropdownOpen && !customerLocked && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 divide-y divide-zinc-100 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-2xl dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900">
              {filteredCustomers.length === 0 ? (
                <div className="p-5 text-center">
                  <p className="text-[12.5px] font-bold text-zinc-700 dark:text-zinc-300">Aucun client trouvé</p>
                  <p className="mt-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">Créez une nouvelle fiche avec le lien « Nouveau client ».</p>
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                      customer.id === selectedCustomer?.id ? 'bg-blue-50/80 dark:bg-blue-950/50' : ''
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold text-zinc-900 dark:text-zinc-100">{customer.name}</span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-zinc-500 dark:text-zinc-400">
                        {customer.phone} • {customer.address}
                      </span>
                    </span>
                    {customer.id === selectedCustomer?.id ? (
                      <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    ) : (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {customer.depositsCount} dépôts
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {selectedCustomer ? (
          <div className="mt-1 rounded-2xl border border-blue-200 bg-blue-100/70 p-3.5 dark:border-blue-900 dark:bg-blue-950/50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-950 text-[13px] font-black text-white shadow-sm dark:from-zinc-200 dark:to-zinc-400 dark:text-zinc-950">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-black text-zinc-950 dark:text-zinc-50">{selectedCustomer.name}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" aria-hidden="true" />{selectedCustomer.phone}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{selectedCustomer.address}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10.5px] font-bold">
                <span className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  <Star className="h-3 w-3 text-amber-500" aria-hidden="true" />
                  {selectedCustomer.depositsCount} dépôts
                </span>
                <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 ${
                  selectedCustomer.balance > 0
                    ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
                    : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                }`}>
                  <WalletCards className="h-3 w-3" aria-hidden="true" />
                  Solde {formatFCFA(selectedCustomer.balance)}
                </span>
              </div>
            </div>
            {selectedCustomer.loyaltyDiscountPercent > 0 && (
              <p className="mt-2.5 border-t border-zinc-200 pt-2.5 text-[11.5px] font-bold text-blue-700 dark:border-zinc-800 dark:text-blue-300">
                Remise fidélité active : −{selectedCustomer.loyaltyDiscountPercent}% sur les articles.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-1 rounded-xl border border-dashed border-zinc-300 px-3 py-3 text-[12px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Aucun client sélectionné. Choisissez un dossier existant ou créez le premier client du pressing.
          </p>
        )}
      </div>
    </section>
  );
};
