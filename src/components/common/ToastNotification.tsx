import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, X } from 'lucide-react';

export const ToastNotification: React.FC = () => {
  const { notificationToast, showToast } = useApp();

  if (!notificationToast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-[#09090b] text-white px-4 py-3 rounded-xl shadow-2xl border border-zinc-700/80 flex items-center gap-3 text-[13px] font-medium max-w-sm">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="flex-1 leading-snug">{notificationToast}</span>
        <button
          onClick={() => showToast('')}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
