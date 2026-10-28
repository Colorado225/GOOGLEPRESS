import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Loader2,
  LogIn,
  LogOut,
  Store,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { getActiveStaffMemberships, formatStaffRole } from '../../lib/staffAccess';
import {
  STAFF_LOGIN_PATH,
  STAFF_REGISTER_PATH,
  mapStaffAuthError,
  parseFeeInput,
  validateOnboardingInput,
} from '../../lib/staffAuth';
import { listCurrentMemberships, type RemoteMembership } from '../../lib/supabaseOrders';
import {
  createMyOrganization,
  type CreatedOrganization,
} from '../../lib/supabaseTenant';
import {
  customerInputClassName,
  customerPrimaryButtonClassName,
  customerSecondaryButtonClassName,
} from '../customer/CustomerAuthLayout';
import {
  StaffAuthAlert,
  StaffAuthHeader,
  StaffAuthLink,
  StaffAuthLoading,
  staffLabelClassName,
  staffShellClassName,
  staffWidePanelClassName,
} from './StaffAuthCommon';

interface StaffOnboardingPageProps {
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
}

type Phase =
  | 'loading'
  | 'unconfigured'
  | 'signed-out'
  | 'already-member'
  | 'form'
  | 'success';

const STEPS = [
  { number: 1, label: 'Votre pressing', icon: Store },
  { number: 2, label: 'Réglages de départ', icon: Wallet },
  { number: 3, label: 'Récapitulatif', icon: ClipboardList },
] as const;

const formatAmount = (amount: number): string =>
  `${amount.toLocaleString('fr-FR')} FCFA`;

export const StaffOnboardingPage: React.FC<StaffOnboardingPageProps> = ({
  onNavigate,
}) => {
  const authClient = supabase;
  const configured = isSupabaseConfigured && authClient !== null;

  const [phase, setPhase] = useState<Phase>(configured ? 'loading' : 'unconfigured');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<RemoteMembership[]>([]);
  const [created, setCreated] = useState<CreatedOrganization | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [organizationName, setOrganizationName] = useState('');
  const [shopName, setShopName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [shopEmail, setShopEmail] = useState('');
  const [tagline, setTagline] = useState('');
  const [pickupFeeXof, setPickupFeeXof] = useState('1000');
  const [deliveryFeeXof, setDeliveryFeeXof] = useState('1000');
  const [seedCatalog, setSeedCatalog] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Créer votre pressing — PressingPro CI';
  }, []);

  useEffect(() => {
    if (!authClient) return;
    let cancelled = false;

    authClient.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled) return;
        if (!data.session) {
          setPhase('signed-out');
          return;
        }
        setAccountEmail(data.session.user.email ?? null);
        const remoteMemberships = await listCurrentMemberships(data.session.user.id);
        if (cancelled) return;
        setMemberships(remoteMemberships);
        setPhase(
          getActiveStaffMemberships(remoteMemberships).length > 0
            ? 'already-member'
            : 'form'
        );
      })
      .catch((sessionError: unknown) => {
        if (cancelled) return;
        setError(mapStaffAuthError(sessionError));
        setPhase('signed-out');
      });

    return () => {
      cancelled = true;
    };
  }, [authClient]);

  const signOut = async () => {
    if (!authClient || busy) return;
    setBusy(true);
    await authClient.auth.signOut();
    setBusy(false);
    onNavigate(STAFF_LOGIN_PATH, { replace: true });
  };

  if (phase === 'loading') {
    return <StaffAuthLoading label="Préparation de votre espace…" />;
  }

  if (phase === 'unconfigured') {
    return (
      <main className={staffShellClassName}>
        <section className={staffWidePanelClassName}>
          <StaffAuthHeader
            title="Bienvenue — créons votre pressing"
            description="Cette page crée votre organisation et votre première agence sur le serveur PressingPro CI."
          />
          <div className="mt-6 space-y-4">
            <StaffAuthAlert tone="error">
              Le service en ligne n’est pas configuré dans cet environnement :
              impossible de créer un pressing ici. En développement,
              l’application fonctionne en démonstration locale.
            </StaffAuthAlert>
            <StaffAuthLink
              path="/"
              onNavigate={onNavigate}
              className={customerSecondaryButtonClassName}
            >
              Retour à l’accueil
            </StaffAuthLink>
          </div>
        </section>
      </main>
    );
  }

  if (phase === 'signed-out') {
    return (
      <main className={staffShellClassName}>
        <section className={staffWidePanelClassName}>
          <StaffAuthHeader
            title="Bienvenue — créons votre pressing"
            description="Connectez-vous d’abord avec votre compte propriétaire : l’organisation sera créée sous votre responsabilité."
          />
          <div className="mt-6 space-y-4">
            {error && <StaffAuthAlert tone="error">{error}</StaffAuthAlert>}
            <StaffAuthAlert tone="warning">
              Aucune session n’est ouverte sur cet appareil. Si vous venez de
              confirmer votre e-mail, connectez-vous pour continuer.
            </StaffAuthAlert>
            <div className="flex flex-col gap-2 sm:flex-row">
              <StaffAuthLink
                path={STAFF_LOGIN_PATH}
                onNavigate={onNavigate}
                className={customerPrimaryButtonClassName}
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Se connecter
              </StaffAuthLink>
              <StaffAuthLink
                path={STAFF_REGISTER_PATH}
                onNavigate={onNavigate}
                className={customerSecondaryButtonClassName}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Créer un compte propriétaire
              </StaffAuthLink>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (phase === 'already-member') {
    const activeRoles = getActiveStaffMemberships(memberships)
      .map((membership) => formatStaffRole(membership.role))
      .join(', ');
    return (
      <main className={staffShellClassName}>
        <section className={staffWidePanelClassName}>
          <StaffAuthHeader
            title="Votre accès est déjà actif"
            description="Ce compte est déjà rattaché à un pressing : aucune seconde organisation ne peut être créée depuis cet écran."
          />
          <div className="mt-6 space-y-4">
            <StaffAuthAlert tone="success">
              Compte {accountEmail ?? 'Non renseigné'} — rôle(s) actif(s) :{' '}
              {activeRoles || 'Non renseigné'}.
            </StaffAuthAlert>
            <div className="flex flex-col gap-2 sm:flex-row">
              <StaffAuthLink
                path="/"
                onNavigate={onNavigate}
                className={customerPrimaryButtonClassName}
              >
                Ouvrir l’ERP
              </StaffAuthLink>
              <button
                type="button"
                className={customerSecondaryButtonClassName}
                onClick={() => void signOut()}
                disabled={busy}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Se déconnecter
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (phase === 'success' && created) {
    return (
      <main className={staffShellClassName}>
        <section className={staffWidePanelClassName}>
          <StaffAuthHeader
            title="Votre pressing est créé"
            description="Votre compte est le propriétaire de cette organisation. Conservez vos identifiants : ils administrent vos agences et vos équipes."
          />
          <div className="mt-6 space-y-4">
            <StaffAuthAlert tone="success">
              Bienvenue chez PressingPro CI, {created.organizationName} !
            </StaffAuthAlert>
            <dl className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[13px] dark:border-zinc-800 dark:bg-zinc-800/60">
              <dt className="font-bold text-zinc-500 dark:text-zinc-400">Organisation</dt>
              <dd className="mt-1 font-semibold">{created.organizationName}</dd>
              <dt className="mt-3 font-bold text-zinc-500 dark:text-zinc-400">
                Première agence
              </dt>
              <dd className="mt-1 font-semibold">{created.shopName}</dd>
              <dt className="mt-3 font-bold text-zinc-500 dark:text-zinc-400">Catalogue</dt>
              <dd className="mt-1 font-semibold">
                {created.catalogSeededItems > 0
                  ? `${created.catalogSeededItems} prestations proposées ajoutées — ajustez les prix à votre grille réelle.`
                  : 'Catalogue vide pour l’instant.'}
              </dd>
            </dl>
            <StaffAuthAlert tone="warning">
              Étape suivante côté PressingPro CI : le branchement distant du
              comptoir est en cours d’activation. Vos accès et votre
              organisation sont bien enregistrés côté serveur ; tant que ce
              branchement n’est pas actif pour votre agence, les commandes
              saisies sur ce poste restent locales à cet appareil.
            </StaffAuthAlert>
            <StaffAuthLink
              path="/"
              onNavigate={onNavigate}
              className={customerPrimaryButtonClassName}
            >
              Ouvrir l’ERP
            </StaffAuthLink>
          </div>
        </section>
      </main>
    );
  }

  const formInput = {
    organizationName,
    shopName,
    city,
    address,
    phoneDisplay,
    shopEmail,
    tagline,
    pickupFeeXof,
    deliveryFeeXof,
  };

  const goNext = () => {
    const validationError = validateOnboardingInput(formInput);
    setError(validationError);
    if (validationError) return;
    setStep((current) => (current === 1 ? 2 : 3));
    window.scrollTo({ top: 0 });
  };

  const submitOnboarding = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || step !== 3) return;

    const validationError = validateOnboardingInput(formInput);
    setError(validationError);
    if (validationError) return;

    const pickupFee = parseFeeInput(pickupFeeXof);
    const deliveryFee = parseFeeInput(deliveryFeeXof);
    if (pickupFee === null || deliveryFee === null) {
      setError('Vérifiez les frais de ramassage et de livraison.');
      return;
    }

    setBusy(true);
    try {
      const result = await createMyOrganization({
        organizationName,
        shopName,
        city,
        address,
        phoneDisplay,
        shopEmail,
        tagline,
        pickupFeeXof: pickupFee,
        deliveryFeeXof: deliveryFee,
        seedCatalog,
      });
      setCreated(result);
      setPhase('success');
      window.scrollTo({ top: 0 });
    } catch (creationError) {
      setError(mapStaffAuthError(creationError));
    } finally {
      setBusy(false);
    }
  };

  const pickupFeeValue = parseFeeInput(pickupFeeXof);
  const deliveryFeeValue = parseFeeInput(deliveryFeeXof);

  return (
    <main className={staffShellClassName}>
      <section className={staffWidePanelClassName}>
        <StaffAuthHeader
          title="Bienvenue — créons votre pressing"
          description={`Compte propriétaire : ${accountEmail ?? 'Non renseigné'}. Trois courtes étapes pour ouvrir votre organisation et votre première agence.`}
        />

        <ol className="mt-6 flex gap-2" aria-label="Progression de la création">
          {STEPS.map(({ number, label, icon: Icon }) => {
            const isCurrent = step === number;
            const isDone = step > number;
            return (
              <li
                key={number}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex flex-1 items-center gap-2 rounded-2xl border px-3 py-2.5 text-[12px] font-bold ${
                  isCurrent
                    ? 'border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100'
                    : isDone
                      ? 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200'
                      : 'border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">Étape {number}</span>
              </li>
            );
          })}
        </ol>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => void submitOnboarding(event)}
          noValidate
        >
          {error && <StaffAuthAlert tone="error">{error}</StaffAuthAlert>}

          {step === 1 && (
            <>
              <div>
                <label htmlFor="onboarding-organization" className={staffLabelClassName}>
                  Nom de l’organisation
                </label>
                <input
                  id="onboarding-organization"
                  type="text"
                  autoComplete="organization"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  className={customerInputClassName}
                  placeholder="Ex. Pressing Éclat SARL"
                  disabled={busy}
                  required
                />
                <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                  Raison sociale ou nom de votre réseau si vous avez plusieurs
                  agences.
                </p>
              </div>

              <div>
                <label htmlFor="onboarding-shop" className={staffLabelClassName}>
                  Nom de l’agence
                </label>
                <input
                  id="onboarding-shop"
                  type="text"
                  value={shopName}
                  onChange={(event) => setShopName(event.target.value)}
                  className={customerInputClassName}
                  placeholder="Ex. Éclat Cocody"
                  disabled={busy}
                  required
                />
                <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                  Le nom de la boutique tel que vos clients le connaissent.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="onboarding-city" className={staffLabelClassName}>
                    Ville
                  </label>
                  <input
                    id="onboarding-city"
                    type="text"
                    autoComplete="address-level2"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className={customerInputClassName}
                    placeholder="Abidjan"
                    disabled={busy}
                  />
                </div>
                <div>
                  <label htmlFor="onboarding-phone" className={staffLabelClassName}>
                    Téléphone de l’agence
                  </label>
                  <input
                    id="onboarding-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    value={phoneDisplay}
                    onChange={(event) => setPhoneDisplay(event.target.value)}
                    className={customerInputClassName}
                    placeholder="07 00 00 00 00"
                    disabled={busy}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="onboarding-address" className={staffLabelClassName}>
                  Adresse de l’agence
                </label>
                <input
                  id="onboarding-address"
                  type="text"
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className={customerInputClassName}
                  placeholder="Quartier, rue, repère…"
                  disabled={busy}
                />
              </div>

              <div>
                <label htmlFor="onboarding-email" className={staffLabelClassName}>
                  E-mail de l’agence (optionnel)
                </label>
                <input
                  id="onboarding-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={shopEmail}
                  onChange={(event) => setShopEmail(event.target.value)}
                  className={customerInputClassName}
                  disabled={busy}
                />
              </div>

              <button
                type="button"
                className={customerPrimaryButtonClassName}
                onClick={goNext}
                disabled={busy}
              >
                Continuer
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label htmlFor="onboarding-tagline" className={staffLabelClassName}>
                  Accroche de l’agence (optionnel)
                </label>
                <input
                  id="onboarding-tagline"
                  type="text"
                  value={tagline}
                  onChange={(event) => setTagline(event.target.value)}
                  className={customerInputClassName}
                  placeholder="Ex. Propre, repassé, prêt à temps"
                  disabled={busy}
                  maxLength={160}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="onboarding-pickup-fee" className={staffLabelClassName}>
                    Frais de ramassage (FCFA)
                  </label>
                  <input
                    id="onboarding-pickup-fee"
                    type="text"
                    inputMode="numeric"
                    value={pickupFeeXof}
                    onChange={(event) => setPickupFeeXof(event.target.value)}
                    className={customerInputClassName}
                    disabled={busy}
                    required
                  />
                  <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                    Proposition de départ : 1 000 FCFA. Mettez 0 si le
                    ramassage est offert.
                  </p>
                </div>
                <div>
                  <label htmlFor="onboarding-delivery-fee" className={staffLabelClassName}>
                    Frais de livraison (FCFA)
                  </label>
                  <input
                    id="onboarding-delivery-fee"
                    type="text"
                    inputMode="numeric"
                    value={deliveryFeeXof}
                    onChange={(event) => setDeliveryFeeXof(event.target.value)}
                    className={customerInputClassName}
                    disabled={busy}
                    required
                  />
                  <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                    Proposition de départ : 1 000 FCFA. Modifiable plus tard
                    dans les paramètres.
                  </p>
                </div>
              </div>

              <label
                htmlFor="onboarding-seed-catalog"
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-800/60"
              >
                <input
                  id="onboarding-seed-catalog"
                  type="checkbox"
                  checked={seedCatalog}
                  onChange={(event) => setSeedCatalog(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/20"
                  disabled={busy}
                />
                <span>
                  <span className="flex items-center gap-2 text-[13.5px] font-bold">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    Démarrer avec le catalogue proposé
                  </span>
                  <span className="mt-1 block text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    32 prestations courantes (pressing et blanchisserie) avec
                    des prix de départ. Ce sont des propositions : vous
                    ajusterez chaque tarif à votre grille réelle.
                  </span>
                </span>
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className={customerSecondaryButtonClassName}
                  onClick={() => setStep(1)}
                  disabled={busy}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Retour
                </button>
                <button
                  type="button"
                  className={customerPrimaryButtonClassName}
                  onClick={goNext}
                  disabled={busy}
                >
                  Vérifier le récapitulatif
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <dl className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[13px] dark:border-zinc-800 dark:bg-zinc-800/60">
                <dt className="font-bold text-zinc-500 dark:text-zinc-400">Organisation</dt>
                <dd className="mt-1 font-semibold">{organizationName.trim() || '—'}</dd>
                <dt className="mt-3 font-bold text-zinc-500 dark:text-zinc-400">Agence</dt>
                <dd className="mt-1 font-semibold">
                  {shopName.trim() || '—'}
                  {city.trim() ? ` — ${city.trim()}` : ''}
                </dd>
                <dt className="mt-3 font-bold text-zinc-500 dark:text-zinc-400">
                  Coordonnées de l’agence
                </dt>
                <dd className="mt-1 font-semibold">
                  {[address.trim(), phoneDisplay.trim(), shopEmail.trim()]
                    .filter(Boolean)
                    .join(' · ') || 'Non renseignées'}
                </dd>
                <dt className="mt-3 font-bold text-zinc-500 dark:text-zinc-400">
                  Frais de course
                </dt>
                <dd className="mt-1 font-semibold">
                  Ramassage{' '}
                  {pickupFeeValue !== null ? formatAmount(pickupFeeValue) : '—'} ·
                  Livraison{' '}
                  {deliveryFeeValue !== null ? formatAmount(deliveryFeeValue) : '—'}
                </dd>
                <dt className="mt-3 font-bold text-zinc-500 dark:text-zinc-400">
                  Catalogue de départ
                </dt>
                <dd className="mt-1 font-semibold">
                  {seedCatalog
                    ? '32 prestations proposées (prix à ajuster)'
                    : 'Aucun — catalogue vide'}
                </dd>
              </dl>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className={customerSecondaryButtonClassName}
                  onClick={() => setStep(2)}
                  disabled={busy}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Retour
                </button>
                <button
                  type="submit"
                  className={customerPrimaryButtonClassName}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Store className="h-4 w-4" aria-hidden="true" />
                  )}
                  Créer mon pressing
                </button>
              </div>
            </>
          )}
        </form>

        <button
          type="button"
          className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-semibold text-zinc-500 underline-offset-2 hover:underline focus:outline-none focus:ring-4 focus:ring-blue-600/20 dark:text-zinc-400"
          onClick={() => void signOut()}
          disabled={busy}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Ce n’est pas votre compte ? Se déconnecter
        </button>
      </section>
    </main>
  );
};
