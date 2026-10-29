import React from 'react';
import { Building2, LayoutDashboard, PanelLeftClose, Settings2, ShieldCheck } from 'lucide-react';

export type PlatformAdminTab = 'accounts' | 'operations' | 'config';

interface PlatformAdminSidebarProps {
  id: string;
  activeTab: PlatformAdminTab;
  onChange: (tab: PlatformAdminTab) => void;
  pendingCount: number;
  onClose?: () => void;
}

const ITEMS = [
  {
    id: 'accounts',
    label: 'Comptes clients',
    description: 'Pressings et abonnements',
    icon: Building2,
  },
  {
    id: 'operations',
    label: 'Centre des opérations',
    description: 'Finance, support et sécurité',
    icon: LayoutDashboard,
  },
  {
    id: 'config',
    label: 'Configuration globale',
    description: 'Inscriptions et annonces',
    icon: Settings2,
  },
] as const;

/** Navigation pleine hauteur de la console, utilisée sur bureau et dans le tiroir mobile. */
export const PlatformAdminSidebar: React.FC<PlatformAdminSidebarProps> = ({
  id,
  activeTab,
  onChange,
  pendingCount,
  onClose,
}) => (
  <aside id={id} className="h-full w-[272px] max-w-[85vw] overflow-y-auto bg-[#0c1222] text-white">
    <nav aria-label="Navigation de l’administration" className="flex min-h-full flex-col p-4">
      <div className="flex items-center gap-3 border-b border-white/10 px-1 pb-5 pt-1">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-950/30">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-400">PressingPro CI</p>
          <p className="mt-0.5 truncate text-[14px] font-black text-white">Console éditeur</p>
        </div>
        {onClose && (
          <button
            type="button"
            aria-label="Masquer la sidebar"
            autoFocus
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="px-3 pb-2 pt-6 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">
        Espaces de travail
      </p>

      <div className="grid grid-cols-1 gap-1.5">
        {ITEMS.map(({ id: itemId, label, description, icon: Icon }) => {
          const active = activeTab === itemId;
          return (
            <button
              key={itemId}
              type="button"
              aria-label={label}
              aria-pressed={active}
              title={description}
              onClick={() => onChange(itemId)}
              className={`group relative flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 text-left transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#0c1222] active:scale-[0.98] ${
                active
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/30'
                  : 'text-zinc-400 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                  active ? 'bg-white/15' : 'bg-white/[0.06] group-hover:bg-white/10'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[12px] font-bold leading-tight">{label}</span>
                <span className={`mt-1 block text-[10px] font-medium leading-snug ${active ? 'text-blue-100' : 'text-zinc-500'}`}>
                  {description}
                </span>
              </span>
              {itemId === 'accounts' && pendingCount > 0 && (
                <span
                  aria-hidden="true"
                  className={`inline-flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-black tabular-nums ${
                    active ? 'bg-white text-blue-700' : 'bg-amber-400 text-zinc-950'
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
            Espace sécurisé
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-500">
            Administration commerciale uniquement. Les données métier des pressings restent isolées.
          </p>
        </div>
        <p className="mt-4 text-center text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">Accès éditeur exclusif</p>
      </div>
    </nav>
  </aside>
);
