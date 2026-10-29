import { useEffect, useRef, useState } from 'react';
import type { ShopSettings } from '../../types';
import type { WorkspaceScope } from '../../lib/workspaceScope';
import {
  DEFAULT_SHOP_SETTINGS,
  SHOP_SETTINGS_STORAGE_KEY,
  mergeShopSettings,
  resolveDefaultShopSettings,
} from '../../lib/shopSettings';
import {
  loadRemoteShopSettings,
  saveRemoteShopSettings,
  type ShopSettingsSyncState,
} from '../../lib/shopSettingsSync';
import { normalizeLogisticsFee } from '../../lib/logistics';
import { normalizeDeliveryProofSettings } from '../../lib/deliveryProof';
import { normalizeDeliveryGpsSettings } from '../../lib/geo';
import { isValidLogoDataUrl } from '../../lib/shopIdentity';
import { normalizeBlanchisserieSettings } from '../../lib/blanchisserie';
import { normalizePressingSettings } from '../../lib/pressing';
import {
  normalizeCatalogOverrides,
  normalizeCustomGarments,
} from '../../lib/garmentCatalog';
import { sanitizePackageCount } from '../../lib/storage';
import { loadPersistedState, persistState } from '../../lib/localPersistence';

export interface ShopSettingsDeps {
  workspace: WorkspaceScope;
  liveWorkspace: boolean;
  storageKey: (name: string) => string;
}

export interface ShopSettingsStore {
  shopSettings: ShopSettings;
  updateShopSettings: (settings: ShopSettings) => void;
  settingsSync: ShopSettingsSyncState;
  retryShopSettingsSync: () => void;
}

/**
 * Paramètres de la boutique (écran Paramètres) : fusionnés aux valeurs par
 * défaut pour rester complets même si une ancienne version est en mémoire.
 * Sur un espace réel, la base porte le nom du pressing effectivement créé :
 * le nom de l'application n'apparaît jamais comme enseigne.
 *
 * Enregistrement dans la base (compte réel) : chaque enregistrement de
 * l'écran Paramètres part vers Supabase (écriture différée de 600 ms). Le
 * navigateur garde sa copie : hors ligne, l'écran reste utilisable et
 * l'erreur est affichée, jamais masquée.
 */
export const useShopSettingsStore = ({
  workspace,
  liveWorkspace,
  storageKey,
}: ShopSettingsDeps): ShopSettingsStore => {
  const [shopSettings, setShopSettings] = useState<ShopSettings>(() =>
    mergeShopSettings(
      resolveDefaultShopSettings(workspace),
      loadPersistedState<Partial<ShopSettings>>(storageKey(SHOP_SETTINGS_STORAGE_KEY), {})
    )
  );

  const [settingsSync, setSettingsSync] = useState<ShopSettingsSyncState>(() => ({
    status: liveWorkspace ? 'loading' : 'idle',
    error: null,
    warning: null,
    savedAt: null,
  }));
  const shopSettingsRef = useRef(shopSettings);
  shopSettingsRef.current = shopSettings;
  const settingsPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Une modification faite avant la fin de la lecture distante ne doit pas
  // être écrasée par la réponse du serveur.
  const settingsTouchedRef = useRef(false);

  const flushShopSettings = async (next: ShopSettings) => {
    const shopId = workspace.shopId;
    const organizationId = workspace.organizationId;
    if (!liveWorkspace || !shopId || !organizationId) return;
    setSettingsSync((previous) => ({
      status: 'saving',
      error: null,
      warning: previous.warning,
      savedAt: previous.savedAt,
    }));
    const result = await saveRemoteShopSettings({ shopId, organizationId, settings: next });
    if (!result.ok) {
      setSettingsSync((previous) => ({
        status: 'error',
        error: result.error,
        warning: null,
        savedAt: previous.savedAt,
      }));
      return;
    }
    setSettingsSync({
      status: 'saved',
      error: null,
      warning: result.warning ?? null,
      savedAt: result.updatedAt ?? new Date().toISOString(),
    });
  };

  const scheduleShopSettingsPush = (next: ShopSettings) => {
    if (!liveWorkspace || !workspace.shopId) return;
    settingsTouchedRef.current = true;
    if (settingsPushTimer.current) clearTimeout(settingsPushTimer.current);
    setSettingsSync((previous) => ({
      status: 'saving',
      error: null,
      warning: previous.warning,
      savedAt: previous.savedAt,
    }));
    settingsPushTimer.current = setTimeout(() => {
      settingsPushTimer.current = null;
      void flushShopSettings(next);
    }, 600);
  };

  useEffect(
    () => () => {
      if (settingsPushTimer.current) clearTimeout(settingsPushTimer.current);
    },
    []
  );

  const retryShopSettingsSync = () => {
    if (settingsPushTimer.current) {
      clearTimeout(settingsPushTimer.current);
      settingsPushTimer.current = null;
    }
    void flushShopSettings(shopSettingsRef.current);
  };

  // Lecture initiale : la base fait foi pour un compte réel. Une ligne encore
  // vide reçoit la configuration courante (issue de l'onboarding).
  useEffect(() => {
    const shopId = workspace.shopId;
    if (!liveWorkspace || !shopId) return;
    let cancelled = false;
    setSettingsSync((previous) => ({ ...previous, status: 'loading', error: null }));
    void (async () => {
      const base = resolveDefaultShopSettings(workspace);
      const result = await loadRemoteShopSettings(shopId, base);
      if (cancelled) return;
      if (!result.ok) {
        setSettingsSync({
          status: 'error',
          error: result.error,
          warning: null,
          savedAt: null,
        });
        return;
      }
      if (result.hasSnapshot) {
        if (!settingsTouchedRef.current) setShopSettings(result.settings);
        setSettingsSync({
          status: 'saved',
          error: null,
          warning: null,
          savedAt: result.updatedAt,
        });
        return;
      }
      setSettingsSync({ status: 'saving', error: null, warning: null, savedAt: null });
      await flushShopSettings(result.settings);
    })();
    return () => {
      cancelled = true;
    };
    // `workspace` change d'identité à chaque rendu : on ne dépend que de ce
    // qui compte pour la synchronisation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveWorkspace, workspace.shopId]);

  const updateShopSettings = (next: ShopSettings) => {
    const normalized: ShopSettings = {
      ...next,
      logoDataUrl: isValidLogoDataUrl(next.logoDataUrl) ? next.logoDataUrl : null,
      blanchisserie: normalizeBlanchisserieSettings(next.blanchisserie),
      pressing: normalizePressingSettings(next.pressing),
      customGarments: normalizeCustomGarments(next.customGarments),
      catalogOverrides: normalizeCatalogOverrides(next.catalogOverrides),
      pickupFee: normalizeLogisticsFee(next.pickupFee),
      deliveryFee: normalizeLogisticsFee(next.deliveryFee),
      deliveryProof: normalizeDeliveryProofSettings(next.deliveryProof),
      deliveryGps: normalizeDeliveryGpsSettings(next.deliveryGps),
      storageAssignmentRequired: next.storageAssignmentRequired === true,
      storageAllowCapacityOverflow: next.storageAllowCapacityOverflow === true,
      storageSuggestionsEnabled: next.storageSuggestionsEnabled === true,
      storageDefaultCapacityPackages:
        sanitizePackageCount(next.storageDefaultCapacityPackages) ??
        DEFAULT_SHOP_SETTINGS.storageDefaultCapacityPackages,
    };
    setShopSettings(normalized);
    scheduleShopSettingsPush(normalized);
  };

  useEffect(() => {
    persistState(storageKey(SHOP_SETTINGS_STORAGE_KEY), shopSettings);
  }, [shopSettings]);

  return { shopSettings, updateShopSettings, settingsSync, retryShopSettingsSync };
};
