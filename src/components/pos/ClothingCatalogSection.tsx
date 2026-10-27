import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { INITIAL_CLOTHING_ITEMS, formatFCFA } from '../../data/demoData';
import { ClothingItem } from '../../types';
import { CurrentColorSelector } from './ColorPicker';
import { Reveal } from '../common/Reveal';
import { SegmentedControl } from '../common/SegmentedControl';

export const ClothingCatalogSection: React.FC = () => {
  const { addCartItem, cartLines, selectedServiceFilter, setSelectedServiceFilter } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'men' | 'women' | 'home'>('all');
  const [itemSearch, setItemSearch] = useState('');

  const services = [
    { id: 'Lavage + Repassage', label: '🧺 Lavage + Repassage' },
    { id: 'Pressing à sec', label: '🧴 Pressing à sec' },
    { id: 'Repassage seul', label: '🔥 Repassage seul' },
    { id: 'Teinture', label: '🎨 Teinture' },
    { id: 'Express 24h', label: '⚡ Express 24h' },
  ];

  const filteredItems = INITIAL_CLOTHING_ITEMS.filter((item) => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory || item.category === 'all';
    const matchesSearch = item.name.toLowerCase().includes(itemSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getItemCountInCart = (itemId: string) => {
    return cartLines
      .filter((line) => line.clothingItemId === itemId)
      .reduce((sum, line) => sum + line.quantity, 0);
  };

  return (
    <Reveal className="card-3d rounded-xl p-4">
      {/* Category selector header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
        <h2 className="font-bold text-[14.5px] text-zinc-900">2 • Articles & services</h2>
        <SegmentedControl
          ariaLabel="Filtrer le catalogue par rayon"
          options={[
            { id: 'all', label: 'Tous' },
            { id: 'men', label: 'Hommes' },
            { id: 'women', label: 'Femmes' },
            { id: 'home', label: 'Maison' },
          ]}
          value={selectedCategory}
          onChange={setSelectedCategory}
        />
      </div>

      <div className="flex items-center justify-between mb-3 text-[12px] text-zinc-500">
        <p>Tarifs affichés en FCFA • Express = +50 %</p>
        <span className="text-[11px] font-medium text-zinc-400">
          Cliquez sur un vêtement pour l'ajouter
        </span>
      </div>

      <div className="mb-3 pb-3 border-b border-dashed border-zinc-200">
        <CurrentColorSelector />
      </div>

      {/* Grid of Clothing Items */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12.5px]">
        {filteredItems.map((item) => {
          const count = getItemCountInCart(item.id);
          const isSelected = count > 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => addCartItem(item)}
              className={`border-1.5 rounded-xl p-3 text-center transition-all duration-200 cursor-pointer relative group flex flex-col items-center justify-between min-h-[115px] select-none ${
                isSelected
                  ? 'border-[#09090b] bg-[#09090b] text-white shadow-pop scale-[1.02]'
                  : 'border-zinc-300 hover:border-zinc-800 bg-white text-zinc-900 shadow-card hover:shadow-card-hover hover:-translate-y-0.5'
              }`}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover shadow-xs transform group-hover:scale-110 transition-transform duration-300"
                />
              ) : (
                <div className="text-3xl filter drop-shadow-xs transform group-hover:scale-110 transition-transform duration-300">
                  {item.emoji}
                </div>
              )}
              <div className="my-1">
                <p className="font-bold text-[13px] leading-tight">{item.name}</p>
                <p className={`text-[11.5px] ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {formatFCFA(item.unitPrice)}
                </p>
              </div>
              {count > 0 ? (
                <span className="font-black text-[12px] bg-white/20 text-white px-2 py-0.5 rounded-md mt-0.5 tabular-nums">
                  × {count}
                </span>
              ) : (
                <span className="text-[11px] text-zinc-400 group-hover:text-zinc-600 transition-colors">
                  + Ajouter
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Service type filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-zinc-100">
        <span className="text-[11.5px] font-bold text-zinc-500 uppercase mr-1">Traitement :</span>
        <SegmentedControl
          ariaLabel="Choisir le traitement appliqué aux articles ajoutés"
          options={services}
          value={selectedServiceFilter}
          onChange={setSelectedServiceFilter}
        />
      </div>
    </Reveal>
  );
};
