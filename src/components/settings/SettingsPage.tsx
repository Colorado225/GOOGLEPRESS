import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowLeft, Save, Sliders, Smartphone, Printer, Building2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { setActiveScreen, showToast } = useApp();

  const [shopName, setShopName] = useState('Pressing Pro CI');
  const [shopAddress, setShopAddress] = useState('Rue des Jardins, Cocody, Abidjan');
  const [shopPhone, setShopPhone] = useState('+225 07 08 09 10 11');
  const [currency, setCurrency] = useState('FCFA');
  const [enableSms, setEnableSms] = useState(true);
  const [enableThermalPrinter, setEnableThermalPrinter] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('✓ Paramètres enregistrés avec succès !');
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
              Paramètres du pressing
            </h1>
            <p className="text-[13px] text-zinc-500">
              Configuration de l'atelier, des imprimantes de caisse et des notifications SMS
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
        {/* Shop Info */}
        <div className="bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs space-y-4 text-[13px]">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
            <Building2 className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-[14.5px] text-zinc-900">Identité de l'établissement</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-bold text-zinc-600 uppercase mb-1">
                Nom commercial
              </label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-bold text-zinc-600 uppercase mb-1">
                Devise
              </label>
              <input
                type="text"
                disabled
                value={currency}
                className="w-full border border-zinc-200 bg-zinc-100 rounded-lg px-3 py-2 text-zinc-600 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-zinc-600 uppercase mb-1">
              Adresse de l'agence
            </label>
            <input
              type="text"
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-zinc-600 uppercase mb-1">
              Téléphone comptoir
            </label>
            <input
              type="text"
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
        </div>

        {/* Devices & Integrations */}
        <div className="bg-white border border-zinc-200/90 rounded-xl p-5 shadow-2xs space-y-4 text-[13px]">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-[14.5px] text-zinc-900">Périphériques & Passerelles</h2>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50">
              <div className="flex items-center gap-3">
                <Printer className="w-5 h-5 text-zinc-600" />
                <div>
                  <p className="font-bold text-zinc-900">Imprimante thermique de tickets (80mm)</p>
                  <p className="text-[11.5px] text-zinc-500">Impression automatique du ticket lors de la validation</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableThermalPrinter}
                onChange={(e) => setEnableThermalPrinter(e.target.checked)}
                className="w-4 h-4 accent-black"
              />
            </label>

            <label className="flex items-center justify-between p-3 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-50">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-zinc-600" />
                <div>
                  <p className="font-bold text-zinc-900">Passerelle SMS & WhatsApp (Côte d'Ivoire)</p>
                  <p className="text-[11.5px] text-zinc-500">Envoi du ticket de dépôt et notification dès que prêt</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableSms}
                onChange={(e) => setEnableSms(e.target.checked)}
                className="w-4 h-4 accent-black"
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="bg-[#09090b] hover:bg-zinc-800 text-white font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow"
        >
          <Save className="w-4 h-4" /> Enregistrer les réglages
        </button>
      </form>
    </div>
  );
};
