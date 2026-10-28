import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, UserPlus, Phone, MapPin, Percent } from 'lucide-react';

export const NewCustomerModal: React.FC = () => {
  const { newCustomerModalOpen, setNewCustomerModalOpen, addNewCustomer } = useApp();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('07 ');
  const [address, setAddress] = useState('Cocody, ');
  const [discount, setDiscount] = useState(0);

  if (!newCustomerModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addNewCustomer({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      loyaltyDiscountPercent: discount,
      isVip: discount > 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-[16px]">Nouvelle fiche client</h3>
          </div>
          <button
            onClick={() => setNewCustomerModalOpen(false)}
            className="text-zinc-400 dark:text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-[13px]">
          <div>
            <label className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
              Nom complet du client *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Kouamé Koffi Junior"
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" /> Numéro de téléphone (SMS & WhatsApp) *
            </label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07 00 00 00 00"
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" /> Quartier & Commune (Abidjan)
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex: Cocody Angré 7e Tranche"
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-[13.5px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" /> Remise fidélité accordée
            </label>
            <div className="flex gap-2">
              {[0, 5, 10, 15].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setDiscount(rate)}
                  className={`flex-1 py-1.5 rounded-lg border text-[12px] font-semibold transition-all ${
                    discount === rate
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100'
                      : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {rate === 0 ? 'Aucune' : `${rate}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setNewCustomerModalOpen(false)}
              className="flex-1 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-lg py-2.5 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 bg-[#09090b] dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold rounded-lg py-2.5 shadow transition-colors"
            >
              Créer la fiche
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
