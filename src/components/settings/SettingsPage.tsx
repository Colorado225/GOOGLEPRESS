import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, type SettingsTab } from '../../context/AppContext';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  Save,
  Shirt,
  Sliders,
  Smartphone,
  Printer,
  Building2,
  Database,
  Download,
  CheckCircle2,
  Moon,
  PackageCheck,
  Sun,
  Truck,
  ImagePlus,
  Trash2,
} from 'lucide-react';
import {
  calculateStorageOccupancy,
  getOrdersOutForDeliveryIds,
  hasStructuredStorage,
  isStorageLocationSaturated,
} from '../../lib/storage';
import { Tabs } from '../common/Tabs';
import { SegmentedControl, SegmentedOption } from '../common/SegmentedControl';
import { AppTheme } from '../../lib/theme';
import { Badge } from '../common/DataTable';
import { canPromptInstall, isRunningStandalone, promptInstall, PWA_INSTALLABLE_EVENT } from '../../lib/pwa';
import { SupabaseBackendSection } from './SupabaseBackendSection';
import { BackupSection } from './BackupSection';
import { PrestationsSettingsSection } from './PrestationsSettingsSection';
import { fileToLogoDataUrl } from '../../lib/imageDownscale';
import {
  MAX_LOGO_FILE_BYTES,
  getBrandInitials,
  resolveShopDisplayName,
} from '../../lib/shopIdentity';

/**
 * Carte « Apparence » : thème clair/sombre de l'interface. Le choix est appliqué
 * immédiatement et mémorisé dans ce navigateur (pressingpro_theme) ; il se bascule
 * aussi via le bouton soleil/lune de l'en-tête ou Alt+T. L'impression reste en clair.
 */
const AppearanceCard: React.FC = () => {
  const { theme, setTheme } = useApp();
  const options: SegmentedOption<AppTheme>[] = [
    { id: 'light', label: 'Clair', icon: <Sun className="h-3.5 w-3.5" aria-hidden="true" /> },
    { id: 'dark', label: 'Sombre', icon: <Moon className="h-3.5 w-3.5" aria-hidden="true" /> },
  ];
  return (
    <section aria-labelledby="appearance-card-title" className="card-3d mt-4 max-w-2xl rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-xs"
          aria-hidden="true"
        >
          {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="appearance-card-title" className="text-[14.5px] font-bold text-zinc-900 dark:text-zinc-100">
            Apparence
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Thème de l'interface, appliqué immédiatement et{' '}
            <strong className="text-zinc-700 dark:text-zinc-300">mémorisé sur cet appareil</strong>. Raccourci : bouton
            soleil/lune dans l'en-tête ou{' '}
            <kbd className="rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-1 font-mono text-[10.5px] text-zinc-600 dark:text-zinc-400">
              Alt+T
            </kbd>
            . Le ticket et les rapports s'impriment toujours en clair, comme sur papier.
          </p>
          <SegmentedControl
            ariaLabel="Choisir le thème de l'interface"
            options={options}
            value={theme}
            onChange={setTheme}
            className="mt-3"
          />
        </div>
      </div>
    </section>
  );
};

/**
 * Carte « Application installable (PWA) » : reflète l'état réel détecté dans le
 * navigateur — déjà installée, installable via l'invite native, ou instructions
 * manuelles (menu du navigateur, écran d'accueil iOS).
 */
const PwaInstallCard: React.FC = () => {
  const [installable, setInstallable] = useState(canPromptInstall());
  const [installed, setInstalled] = useState(isRunningStandalone());

  useEffect(() => {
    const sync = () => {
      setInstallable(canPromptInstall());
      setInstalled(isRunningStandalone());
    };
    window.addEventListener(PWA_INSTALLABLE_EVENT, sync);
    window.addEventListener('appinstalled', sync);
    return () => {
      window.removeEventListener(PWA_INSTALLABLE_EVENT, sync);
      window.removeEventListener('appinstalled', sync);
    };
  }, []);

  return (
    <section aria-labelledby="pwa-card-title" className="card-3d mt-4 max-w-2xl rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-black text-white shadow-xs"
          aria-hidden="true"
        >
          P
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="pwa-card-title" className="flex flex-wrap items-center gap-2 text-[14.5px] font-bold text-zinc-900 dark:text-zinc-100">
            Application installable (PWA)
            {installed && (
              <Badge variant="success" size="sm">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Installée
              </Badge>
            )}
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Installez PressingPro sur l'écran d'accueil (téléphone, tablette ou ordinateur) : lancement
            plein écran comme une application, et <strong className="text-zinc-700 dark:text-zinc-300">utilisable hors ligne</strong> —
            les données restent conservées sur l'appareil, comme aujourd'hui.
          </p>
          {installed ? (
            <p className="mt-2 text-[12.5px] font-medium text-emerald-700 dark:text-emerald-300">
              Vous utilisez déjà la version installée. Les mises à jour vous sont signalées automatiquement.
            </p>
          ) : installable ? (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#09090b] dark:bg-zinc-100 px-4 py-2 text-[13px] font-bold text-white dark:text-zinc-950 shadow-sm transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Installer l'application
            </button>
          ) : (
            <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
              <span>
                Si le bouton d'installation n'apparaît pas : menu du navigateur → « Installer
                l'application » (Chrome/Edge), ou sur iPhone/iPad : Partager → « Sur l'écran d'accueil ».
              </span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export const SettingsPage: React.FC = () => {
  const {
    setActiveScreen,
    showToast,
    shopSettings,
    updateShopSettings,
    workspace,
    orders,
    storageLocations,
    logisticsTasks,
    openStorageLocationsConfig,
    settingsTabRequest,
    clearSettingsTabRequest,
  } = useApp();

  // Le formulaire démarre depuis les paramètres persistés (contexte).
  const [shopName, setShopName] = useState(shopSettings.name);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(shopSettings.logoDataUrl);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [shopTagline, setShopTagline] = useState(shopSettings.tagline);
  const [shopAddress, setShopAddress] = useState(shopSettings.address);
  const [shopPhone, setShopPhone] = useState(shopSettings.phone);
  const [currency, setCurrency] = useState(shopSettings.currency);
  const [enableSms, setEnableSms] = useState(shopSettings.enableSms);
  const [enableThermalPrinter, setEnableThermalPrinter] = useState(shopSettings.enableThermalPrinter);
  const [pickupFeeInput, setPickupFeeInput] = useState(String(shopSettings.pickupFee));
  const [deliveryFeeInput, setDeliveryFeeInput] = useState(String(shopSettings.deliveryFee));
  const [storageAssignmentRequired, setStorageAssignmentRequired] = useState(
    shopSettings.storageAssignmentRequired
  );
  const [storageCapacityMode, setStorageCapacityMode] = useState<'flexible' | 'strict'>(
    shopSettings.storageAllowCapacityOverflow ? 'flexible' : 'strict'
  );
  const [storageSuggestionsEnabled, setStorageSuggestionsEnabled] = useState(
    shopSettings.storageSuggestionsEnabled
  );
  const [storageDefaultCapacityInput, setStorageDefaultCapacityInput] = useState(
    String(shopSettings.storageDefaultCapacityPackages)
  );
  const [tab, setTab] = useState<SettingsTab>('shop');

  useEffect(() => {
    if (!settingsTabRequest) return;
    setTab(settingsTabRequest);
    clearSettingsTabRequest();
  }, [clearSettingsTabRequest, settingsTabRequest]);

  const storageSummary = useMemo(() => {
    const occupancyByLocation = calculateStorageOccupancy(orders, logisticsTasks);
    const outForDeliveryIds = getOrdersOutForDeliveryIds(logisticsTasks);
    const activeLocations = storageLocations.filter((location) => location.isActive);
    const saturatedLocations = storageLocations.filter((location) =>
      isStorageLocationSaturated(
        location,
        occupancyByLocation.get(location.id) ?? {
          orderCount: 0,
          packageCount: 0,
          unknownPackageOrders: 0,
        }
      )
    );
    const readyWithoutStorage = orders.filter(
      (order) =>
        order.status === 'ready' &&
        !outForDeliveryIds.has(order.id) &&
        !hasStructuredStorage(order)
    );
    return {
      totalLocations: storageLocations.length,
      activeLocations: activeLocations.length,
      saturatedLocations: saturatedLocations.length,
      readyWithoutStorage: readyWithoutStorage.length,
    };
  }, [logisticsTasks, orders, storageLocations]);

  /**
   * Enregistrement commun à tous les onglets. L’action « gérer les emplacements »
   * l’utilise aussi, pour ne jamais quitter les Paramètres avec des règles
   * modifiées mais non sauvegardées.
   */
  const saveSettings = (openStorageManager = false): boolean => {
    if (!shopName.trim()) {
      showToast('Le nom commercial ne peut pas être vide.');
      setTab('shop');
      return false;
    }

    const pickupFee = Number(pickupFeeInput.replace(/\s/g, ''));
    const deliveryFee = Number(deliveryFeeInput.replace(/\s/g, ''));
    if (
      pickupFeeInput.trim() === '' ||
      deliveryFeeInput.trim() === '' ||
      !Number.isFinite(pickupFee) ||
      !Number.isFinite(deliveryFee) ||
      pickupFee < 0 ||
      deliveryFee < 0
    ) {
      showToast('Les frais de ramassage et de livraison doivent être des montants valides (0 = offert).');
      setTab('logistics');
      return false;
    }

    const storageDefaultCapacityPackages = Number(storageDefaultCapacityInput);
    if (
      storageDefaultCapacityInput.trim() === '' ||
      !Number.isInteger(storageDefaultCapacityPackages) ||
      storageDefaultCapacityPackages < 1 ||
      storageDefaultCapacityPackages > 999
    ) {
      showToast('La capacité par défaut des nouveaux emplacements doit être un entier entre 1 et 999 paquets.');
      setTab('storage');
      return false;
    }

    updateShopSettings({
      name: shopName.trim(),
      logoDataUrl,
      tagline: shopTagline.trim(),
      address: shopAddress.trim(),
      phone: shopPhone.trim(),
      currency,
      enableSms,
      enableThermalPrinter,
      pickupFee,
      deliveryFee,
      storageAssignmentRequired,
      storageAllowCapacityOverflow: storageCapacityMode === 'flexible',
      storageSuggestionsEnabled,
      storageDefaultCapacityPackages,
      blanchisserie: shopSettings.blanchisserie,
      pressing: shopSettings.pressing,
      customGarments: shopSettings.customGarments,
      catalogOverrides: shopSettings.catalogOverrides,
    });
    setPickupFeeInput(String(Math.round(pickupFee)));
    setDeliveryFeeInput(String(Math.round(deliveryFee)));
    setStorageDefaultCapacityInput(String(storageDefaultCapacityPackages));

    if (openStorageManager) {
      openStorageLocationsConfig();
    } else {
      showToast('✓ Paramètres enregistrés sur cet appareil');
    }
    return true;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(false);
  };

  /**
   * Téléversement du logo : l'image est redimensionnée dans le navigateur puis
   * appliquée immédiatement (c'est une donnée d'identité, pas un réglage à
   * valider avec le reste du formulaire).
   */
  const handleLogoSelected = async (file: File | null) => {
    if (!file) return;
    setLogoError(null);
    setLogoBusy(true);
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      setLogoDataUrl(dataUrl);
      updateShopSettings({ ...shopSettings, logoDataUrl: dataUrl });
      showToast('✓ Logo du pressing mis à jour');
    } catch (error) {
      setLogoError(
        error instanceof Error ? error.message : 'Le logo n’a pas pu être enregistré.'
      );
    } finally {
      setLogoBusy(false);
      // Permet de re-sélectionner le même fichier après une erreur.
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const removeLogo = () => {
    setLogoError(null);
    setLogoDataUrl(null);
    updateShopSettings({ ...shopSettings, logoDataUrl: null });
    showToast('Logo retiré : les initiales du pressing sont affichées à la place.');
  };

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-[1366px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveScreen('dashboard')}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Paramètres du pressing
            </h1>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
              Établissement, rangement atelier, périphériques, backend Supabase et sauvegarde
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
        {/* Onglets par domaine de réglage (l'enregistrement couvre les deux) */}
        <Tabs
          ariaLabel="Domaines de paramètres"
          activeId={tab}
          onChange={setTab}
          tabs={[
            { id: 'shop', label: 'Établissement', icon: <Building2 className="w-4 h-4" aria-hidden="true" /> },
            {
              id: 'services',
              label: 'Prestations',
              icon: <Shirt className="w-4 h-4" aria-hidden="true" />,
              badge: shopSettings.blanchisserie.tiers.length,
            },
            { id: 'logistics', label: 'Ramassage & livraison', icon: <Truck className="w-4 h-4" aria-hidden="true" /> },
            {
              id: 'storage',
              label: 'Rangement atelier',
              icon: <Archive className="w-4 h-4" aria-hidden="true" />,
              badge: storageSummary.activeLocations,
            },
            { id: 'devices', label: 'Périphériques & passerelles', icon: <Sliders className="w-4 h-4" aria-hidden="true" /> },
            { id: 'backend', label: 'Backend Supabase', icon: <Database className="w-4 h-4" aria-hidden="true" /> },
            { id: 'backup', label: 'Sauvegarde', icon: <Download className="w-4 h-4" aria-hidden="true" /> },
          ]}
        />

        {/* Shop Info */}
        {tab === 'shop' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-5 shadow-2xs space-y-4 text-[13px]">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100">Identité de l'établissement</h2>
          </div>

          {/* Logo du pressing : il remplace le monogramme « P » dans toute
              l'application et sur les tickets. */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-800/40 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs dark:border-zinc-700 dark:bg-zinc-900">
                {logoDataUrl ? (
                  <img
                    src={logoDataUrl}
                    alt={`Logo de ${shopName.trim() || 'votre pressing'}`}
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center rounded-xl bg-blue-600 text-[19px] font-black text-white">
                    {getBrandInitials(resolveShopDisplayName(shopSettings, workspace))}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-bold text-zinc-900 dark:text-zinc-100">
                  Logo du pressing
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-zinc-500 dark:text-zinc-400">
                  PNG, JPEG ou WebP — {Math.round(MAX_LOGO_FILE_BYTES / (1024 * 1024))} Mo
                  maximum. L’image est recadrée en carré 256 px et affichée à la place
                  du monogramme.
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    ref={logoInputRef}
                    id="shop-logo-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => void handleLogoSelected(event.target.files?.[0] ?? null)}
                  />
                  <label
                    htmlFor="shop-logo-input"
                    aria-disabled={logoBusy}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#09090b] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 ${
                      logoBusy ? 'pointer-events-none opacity-60' : ''
                    }`}
                  >
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                    {logoBusy ? 'Traitement…' : logoDataUrl ? 'Changer le logo' : 'Téléverser un logo'}
                  </label>

                  {logoDataUrl && !logoBusy && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Retirer
                    </button>
                  )}
                </div>

                {logoError && (
                  <p role="alert" className="mt-2 text-[11.5px] font-semibold text-red-600 dark:text-red-400">
                    {logoError}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                Nom commercial
              </label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                Devise
              </label>
              <input
                type="text"
                disabled
                value={currency}
                className="w-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-zinc-600 dark:text-zinc-400 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
              Adresse de l'agence
            </label>
            <input
              type="text"
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
              Téléphone comptoir
            </label>
            <input
              type="text"
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
              Slogan (imprimé sur le ticket)
            </label>
            <input
              type="text"
              value={shopTagline}
              onChange={(e) => setShopTagline(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>
        </div>
        )}

        {/* Ramassage & livraison */}
        {tab === 'services' && <PrestationsSettingsSection />}

        {tab === 'logistics' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-5 shadow-2xs space-y-4 text-[13px]">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100">Forfaits ramassage & livraison</h2>
          </div>

          <p className="text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Ces montants forfaitaires s’appliquent uniquement aux demandes et commandes créées
            après l’enregistrement. Le frais déjà annoncé sur une tournée ou un ticket ne change
            jamais rétroactivement. Saisissez <strong className="text-zinc-900 dark:text-zinc-100">0</strong> pour offrir la course.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="settings-pickup-fee" className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                Ramassage à domicile
              </label>
              <div className="relative">
                <input
                  id="settings-pickup-fee"
                  type="number"
                  min={0}
                  step={100}
                  inputMode="numeric"
                  value={pickupFeeInput}
                  onChange={(e) => setPickupFeeInput(e.target.value)}
                  aria-describedby="settings-pickup-fee-help"
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 pr-14 text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-400 dark:text-zinc-500">FCFA</span>
              </div>
              <p id="settings-pickup-fee-help" className="mt-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                Ajouté à la commande après la collecte et le comptage des pièces.
              </p>
            </div>

            <div>
              <label htmlFor="settings-delivery-fee" className="block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-400 uppercase mb-1">
                Livraison à domicile
              </label>
              <div className="relative">
                <input
                  id="settings-delivery-fee"
                  type="number"
                  min={0}
                  step={100}
                  inputMode="numeric"
                  value={deliveryFeeInput}
                  onChange={(e) => setDeliveryFeeInput(e.target.value)}
                  aria-describedby="settings-delivery-fee-help"
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 pr-14 text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-400 dark:text-zinc-500">FCFA</span>
              </div>
              <p id="settings-delivery-fee-help" className="mt-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                Inclus au total du ticket ; le solde éventuel est encaissé à la livraison.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-3 py-2.5 text-[12px] leading-relaxed text-blue-900 dark:text-blue-100">
            Proposition de démarrage : 1 000 FCFA par course dans la zone habituelle. Ajustez ces
            montants selon vos coûts réels de carburant et vos quartiers desservis.
          </div>
        </div>
        )}

        {/* Rangement atelier : règles du propriétaire */}
        {tab === 'storage' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-5 shadow-2xs space-y-4 text-[13px]">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <Archive className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100">
              Rangement atelier — règles du propriétaire
            </h2>
          </div>

          <p className="text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Vous décidez comment l’atelier doit ranger les commandes terminées. Le plan A–E
            fourni au départ n’est qu’une proposition : le vrai modèle est celui de votre local —
            portants, étagères, casiers, bacs ou rangées numérotées.
          </p>

          <div className="flex flex-wrap gap-1.5" aria-label="Résumé actuel du rangement">
            <span className="rounded-full bg-teal-50 dark:bg-teal-950 px-2.5 py-1 text-[11.5px] font-bold text-teal-800 dark:text-teal-200">
              {storageSummary.totalLocations} emplacement(s) configuré(s)
            </span>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11.5px] font-bold text-zinc-700 dark:text-zinc-300">
              {storageSummary.activeLocations} actif(s)
            </span>
            <span className="rounded-full bg-amber-50 dark:bg-amber-950 px-2.5 py-1 text-[11.5px] font-bold text-amber-800 dark:text-amber-200">
              {storageSummary.readyWithoutStorage} prête(s) sans repère structuré
            </span>
            <span className="rounded-full bg-red-50 dark:bg-red-950 px-2.5 py-1 text-[11.5px] font-bold text-red-800 dark:text-red-200">
              {storageSummary.saturatedLocations} saturé(s)
            </span>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="settings-storage-assignment-required"
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <span className="flex items-center gap-3">
                <PackageCheck className="h-5 w-5 shrink-0 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
                <span>
                  <span className="block font-bold text-zinc-900 dark:text-zinc-100">
                    Rangement obligatoire avant « Prête »
                  </span>
                  <span className="block text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Décoché : l’équipe peut marquer prête puis ranger juste après. Coché : un
                    emplacement actif doit être choisi pour terminer la commande.
                  </span>
                </span>
              </span>
              <input
                id="settings-storage-assignment-required"
                type="checkbox"
                checked={storageAssignmentRequired}
                onChange={(e) => setStorageAssignmentRequired(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-black"
              />
            </label>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
              <p id="settings-storage-capacity-title" className="font-bold text-zinc-900 dark:text-zinc-100">
                Capacité des emplacements
              </p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Souple : l’app signale le dépassement mais autorise un rangement exceptionnel.
                Stricte : un casier plein ne peut plus recevoir de paquet (les anciens nombres
                de paquets inconnus ne sont pas inventés).
              </p>
              <SegmentedControl
                ariaLabel="Choisir le mode de capacité du rangement"
                options={[
                  { id: 'flexible', label: 'Souple (alerte)' },
                  { id: 'strict', label: 'Stricte (bloquante)' },
                ]}
                value={storageCapacityMode}
                onChange={setStorageCapacityMode}
                className="mt-2"
              />
            </div>

            <label
              htmlFor="settings-storage-suggestions"
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <span>
                <span className="block font-bold text-zinc-900 dark:text-zinc-100">
                  Suggestions automatiques d’emplacement
                </span>
                <span className="block text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  L’app pré-sélectionne le casier le plus adapté (cintre, plié, volumineux,
                  livraison…) ; l’équipe peut toujours le changer. Désactivez si vous préférez
                  un choix manuel systématique.
                </span>
              </span>
              <input
                id="settings-storage-suggestions"
                type="checkbox"
                checked={storageSuggestionsEnabled}
                onChange={(e) => setStorageSuggestionsEnabled(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-black"
              />
            </label>

            <div className="max-w-xs">
              <label
                htmlFor="settings-storage-default-capacity"
                className="block text-[11.5px] font-bold uppercase text-zinc-600 dark:text-zinc-400 mb-1"
              >
                Capacité par défaut d’un nouvel emplacement
              </label>
              <div className="relative">
                <input
                  id="settings-storage-default-capacity"
                  type="number"
                  min={1}
                  max={999}
                  step={1}
                  inputMode="numeric"
                  value={storageDefaultCapacityInput}
                  onChange={(e) => setStorageDefaultCapacityInput(e.target.value)}
                  aria-describedby="settings-storage-default-capacity-help"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 pr-20 text-zinc-900 dark:text-zinc-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-400 dark:text-zinc-500">
                  PAQUETS
                </span>
              </div>
              <p id="settings-storage-default-capacity-help" className="mt-1 text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Pré-remplit la création d’un casier ou d’une série ; chaque emplacement peut
                ensuite avoir sa propre capacité.
              </p>
            </div>
          </div>

          {(storageSummary.totalLocations === 0 ||
            (storageAssignmentRequired && storageSummary.activeLocations === 0) ||
            (storageAssignmentRequired && storageSummary.readyWithoutStorage > 0) ||
            (storageCapacityMode === 'strict' && storageSummary.saturatedLocations > 0)) && (
            <div className="space-y-2" aria-live="polite">
              {storageSummary.totalLocations === 0 && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Aucun emplacement n’est configuré. Créez votre plan avant d’activer le
                    rangement obligatoire.
                  </span>
                </p>
              )}
              {storageAssignmentRequired && storageSummary.activeLocations === 0 && storageSummary.totalLocations > 0 && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Tous les emplacements sont désactivés : aucune commande ne pourra passer en
                    « Prête » tant qu’au moins un casier n’est pas réactivé.
                  </span>
                </p>
              )}
              {storageAssignmentRequired && storageSummary.readyWithoutStorage > 0 && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {storageSummary.readyWithoutStorage} commande(s) sont déjà prêtes sans repère
                    structuré. Elles resteront visibles dans la file « À ranger / convertir »
                    jusqu’à saisie de leur casier.
                  </span>
                </p>
              )}
              {storageCapacityMode === 'strict' && storageSummary.saturatedLocations > 0 && (
                <p className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 px-3 py-2.5 text-[12px] leading-relaxed text-red-900 dark:text-red-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {storageSummary.saturatedLocations} emplacement(s) ont déjà atteint leur
                    capacité. En mode strict, vérifiez la place réelle ou augmentez leur capacité
                    avant de continuer à y ranger.
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/70 dark:bg-teal-950/60 p-3.5">
            <h3 className="font-bold text-zinc-950 dark:text-zinc-50">Votre plan physique</h3>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
              <li>Choisissez des codes courts et lisibles de loin : PORTANT-1, MUR-A, B-01…</li>
              <li>Créez un emplacement type, dupliquez-le ou générez une série B-01 → B-12.</li>
              <li>Reportez exactement les mêmes codes sur les étiquettes réelles de l’atelier.</li>
              <li>Désactivez un casier déjà utilisé ; seuls les emplacements jamais utilisés se suppriment.</li>
            </ol>
            <button
              type="button"
              onClick={() => saveSettings(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#09090b] dark:bg-zinc-100 px-4 py-2 text-[13px] font-bold text-white dark:text-zinc-950 shadow-sm transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              Enregistrer et gérer les emplacements
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              L’application n’a pas encore de comptes ni de rôles : toute personne ayant accès à
              cet appareil peut modifier ces règles. Le verrouillage « propriétaire » arrivera
              avec les comptes utilisateurs du backend.
            </span>
          </p>
        </div>
        )}

        {/* Devices & Integrations */}
        {tab === 'devices' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-5 shadow-2xs space-y-4 text-[13px]">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100">Périphériques & Passerelles</h2>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <div className="flex items-center gap-3">
                <Printer className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                <div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">Imprimante thermique de tickets (80 mm)</p>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">Préférence conservée localement : l’impression passe par la boîte de dialogue du navigateur, sans pilote direct ni déclenchement automatique.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableThermalPrinter}
                onChange={(e) => setEnableThermalPrinter(e.target.checked)}
                className="w-4 h-4 accent-black"
              />
            </label>

            <label className="flex items-center justify-between p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                <div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">Notifications externes (non connectées)</p>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">Aucun SMS/WhatsApp n’est envoyé pour le moment ; les notifications sont marquées localement.</p>
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
        )}

        {tab === 'backend' && <SupabaseBackendSection />}

        {tab === 'backup' && <BackupSection />}

        {tab !== 'backend' && tab !== 'backup' && (
          <>
            <button
              type="submit"
              className="bg-[#09090b] dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow"
            >
              <Save className="w-4 h-4" /> Enregistrer les réglages
            </button>
            <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">
              Réglages conservés uniquement dans ce navigateur : sans serveur, ils ne se synchronisent pas
              entre appareils.
            </p>
          </>
        )}
      </form>

      <PwaInstallCard />
      <AppearanceCard />
    </div>
  );
};
