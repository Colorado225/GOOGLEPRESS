import type { WorkshopTab } from '../context/AppContext';

/**
 * Structure de la navigation de l'atelier.
 *
 * « Production & Remise » est un onglet principal ; les autres écrans de
 * l'atelier (rangement, tournées, caisse) sont ses sous-onglets. La définition
 * vit ici, hors du composant, pour être testable et pour qu'une entrée ne
 * puisse pas pointer vers un onglet inexistant.
 */

export const WORKSHOP_GROUP_KEY = 'workshop';
export const WORKSHOP_GROUP_LABEL = 'Production & Remise';
export const WORKSHOP_GROUP_STORAGE_KEY = 'pressingpro_sidebar_group_workshop';

/** Onglet affiché par défaut quand on ouvre l'atelier sans cible précise. */
export const WORKSHOP_DEFAULT_TAB: WorkshopTab = 'production';

export type WorkshopSubTabIcon = 'washing' | 'archive' | 'truck' | 'wallet';

export interface WorkshopSubTabDefinition {
  /** Identifiant stable (mémorisé, jamais réutilisé pour autre chose). */
  key: string;
  label: string;
  workshopTab: WorkshopTab;
  icon: WorkshopSubTabIcon;
}

/**
 * Ordre choisi = ordre du parcours métier : produire, ranger, remettre ou
 * livrer, encaisser et clôturer.
 */
export const WORKSHOP_SUBTABS: readonly WorkshopSubTabDefinition[] = [
  {
    key: 'workshop:production',
    label: 'Production',
    workshopTab: 'production',
    icon: 'washing',
  },
  {
    key: 'workshop:storage',
    label: 'Rangement atelier',
    workshopTab: 'storage',
    icon: 'archive',
  },
  {
    key: 'workshop:logistics',
    label: 'Remises & Livraisons',
    workshopTab: 'logistics',
    icon: 'truck',
  },
  {
    key: 'workshop:cash',
    label: 'Caisse & Clôture',
    workshopTab: 'cash',
    icon: 'wallet',
  },
];

export const WORKSHOP_SUBTAB_KEYS: readonly string[] = WORKSHOP_SUBTABS.map(
  (subTab) => subTab.key
);

/** Retrouve un sous-onglet par sa clé, `undefined` s'il a été retiré. */
export const getWorkshopSubTab = (
  key: string
): WorkshopSubTabDefinition | undefined =>
  WORKSHOP_SUBTABS.find((subTab) => subTab.key === key);

/** Le sous-onglet est-il l'onglet d'atelier actuellement affiché ? */
export const isWorkshopSubTabActive = (
  subTab: Pick<WorkshopSubTabDefinition, 'workshopTab'>,
  activeTab: WorkshopTab
): boolean => subTab.workshopTab === activeTab;

/** Libellé lisible d'un onglet d'atelier, pour les annonces et les titres. */
export const getWorkshopTabLabel = (tab: WorkshopTab): string => {
  const subTab = WORKSHOP_SUBTABS.find((entry) => entry.workshopTab === tab);
  return subTab?.label ?? WORKSHOP_GROUP_LABEL;
};
