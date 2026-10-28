import { expect, test } from '@playwright/test';

test.describe('PressingPro — parcours critiques', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('le tableau de bord n’affiche pas les anciens libellés figés', async ({ page }) => {
    await expect(page.getByText("Chiffre d'affaires — 7 derniers jours")).toBeVisible();
    await expect(page.getByText('+18 %')).toHaveCount(0);
    await expect(page.getByText('11 clients notifiés SMS')).toHaveCount(0);
    await expect(page.getByText('Contrats hôtels')).toHaveCount(0);
    await expect(page.getByText('Stock détachant bas')).toHaveCount(0);

    await page.getByRole('button', { name: 'Mois' }).click();
    await expect(page.getByText("Chiffre d'affaires — Mois en cours")).toBeVisible();
  });

  test('le CTA Pressing ouvre directement l’étape client du POS', async ({ page }) => {
    await page.getByRole('button', { name: /Réception \(POS\)/ }).click();
    await expect(
      page.getByText('Étape 1 • Informations du client & Délais de retrait')
    ).toBeVisible();

    await page.getByRole('button', { name: 'Revenir au choix de service' }).click();
    await expect(page.getByText('Nouvelle commande — Sélection du service')).toBeVisible();

    await page
      .getByRole('button', { name: 'Ouvrir le service Pressing et nettoyage à sec' })
      .click();

    await expect(
      page.getByText('Étape 1 • Informations du client & Délais de retrait')
    ).toBeVisible();
  });

  test('l’atelier affiche une action de notification locale dynamique', async ({ page }) => {
    await page.getByRole('button', { name: /Production & Suivi/ }).click();

    await expect(
      page.getByRole('button', { name: /Marquer \d+ prête\(s\) comme notifiée\(s\)/ })
    ).toBeVisible();
    await expect(page.getByText('Tout notifier (11 SMS)')).toHaveCount(0);
    await expect(page.getByText('Machines : L1')).toHaveCount(0);
  });

  test('chaque écran ERP a son URL et les routes inconnues sont explicites', async ({ page }) => {
    // Lien profond : l’URL désigne directement l’écran à ouvrir.
    await page.goto('/reception');
    await expect(page).toHaveURL(/\/reception$/);
    await expect(
      page.getByText('Étape 1 • Informations du client & Délais de retrait')
    ).toBeVisible();

    // Navigation interne : l’URL suit l’écran choisi dans la barre latérale.
    await page.getByRole('button', { name: /Production & Suivi/ }).click();
    await expect(page).toHaveURL(/\/atelier$/);

    // Bouton Précédent du navigateur : retour à l’écran précédent.
    await page.goBack();
    await expect(page).toHaveURL(/\/reception$/);
    await expect(
      page.getByText('Étape 1 • Informations du client & Délais de retrait')
    ).toBeVisible();

    // Route inconnue : écran explicite, sans retomber en silence à l’accueil.
    await page.goto('/ecran-qui-nexiste-pas');
    await expect(
      page.getByRole('heading', { name: 'Page introuvable' })
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Retour au tableau de bord' })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByText("Chiffre d'affaires — 7 derniers jours")
    ).toBeVisible();
  });

  test('le suivi distant explique l’absence de configuration et ouvre le backend', async ({ page }) => {
    await page.getByRole('button', { name: /Production & Suivi/ }).click();
    await page.getByRole('tab', { name: /Suivi distant/ }).click();

    await expect(
      page.getByRole('heading', { name: 'Suivi distant non configuré' })
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Ouvrir Paramètres → Backend Supabase' })
      .click();

    await expect(page.getByRole('heading', { name: 'Backend Supabase' })).toBeVisible();
  });

  test('les pages de connexion et d’inscription client sont accessibles', async ({ page }) => {
    await page.getByRole('link', { name: /Espace client/ }).click();

    await expect(page).toHaveURL(/\/client\/connexion$/);
    await expect(page.getByRole('heading', { name: 'Bon retour parmi nous.' })).toBeVisible();
    await expect(
      page.getByText('Service d’authentification non configuré', { exact: true })
    ).toBeVisible();
    await expect(page.getByLabel('Adresse e-mail')).toBeEnabled();
    await expect(page.getByLabel('Mot de passe', { exact: true })).toBeEnabled();

    // La validation de saisie fonctionne même sans backend configuré.
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('Saisissez une adresse e-mail valide.')).toBeVisible();

    // Mot de passe oublié : vue dédiée, puis retour.
    await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
    await expect(
      page.getByRole('heading', { name: 'Mot de passe oublié ?', exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Envoyer le lien de réinitialisation' }).click();
    await expect(page.getByText('Saisissez l’adresse e-mail de votre compte.')).toBeVisible();
    await page.getByRole('button', { name: 'Retour à la connexion' }).click();

    await page.getByRole('link', { name: 'Inscription', exact: true }).click();

    await expect(page).toHaveURL(/\/client\/inscription$/);
    await expect(page.getByRole('heading', { name: 'Créez votre compte client.' })).toBeVisible();
    await expect(page.getByLabel('Nom complet')).toBeVisible();
    await expect(page.getByLabel('Téléphone utilisé pour vos dépôts')).toBeVisible();
    await expect(page.getByLabel('Adresse e-mail')).toBeVisible();
    await expect(
      page.getByLabel(/Je confirme que ce numéro est celui utilisé pour mes dépôts/)
    ).toBeVisible();

    await page.getByRole('button', { name: 'Créer mon compte client' }).click();
    await expect(page.getByText('Saisissez votre nom complet.')).toBeVisible();

    // La jauge de robustesse accompagne la saisie du mot de passe.
    await page.getByLabel('Mot de passe', { exact: true }).fill('Motdepasse1!solide');
    await expect(page.getByText(/Robustesse du mot de passe/)).toBeVisible();
  });

  test('les pages connexion, inscription et onboarding du personnel sont accessibles', async ({ page }) => {
    await page.goto('/connexion');

    await expect(page).toHaveURL(/\/connexion$/);
    await expect(
      page.getByRole('heading', { name: 'Heureux de vous retrouver.' })
    ).toBeVisible();
    await expect(
      page.getByText('Service d’authentification non configuré', { exact: true })
    ).toBeVisible();
    await expect(page.getByLabel('Adresse e-mail')).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Se connecter' }).first()
    ).toBeEnabled();

    await page.getByRole('button', { name: 'Se connecter' }).first().click();
    await expect(page.getByText('Saisissez une adresse e-mail valide.')).toBeVisible();

    await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
    await expect(
      page.getByRole('heading', { name: 'Mot de passe oublié ?', exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Retour à la connexion' }).click();

    await page.getByRole('link', { name: 'Créer un compte propriétaire' }).click();

    await expect(page).toHaveURL(/\/inscription$/);
    await expect(
      page.getByRole('heading', { name: 'Créez votre espace professionnel.' })
    ).toBeVisible();
    await expect(page.getByLabel('Nom complet')).toBeVisible();
    await expect(page.getByLabel('Adresse e-mail')).toBeVisible();
    await expect(page.getByLabel(/J’accepte les/)).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'conditions d’utilisation' })
    ).toHaveAttribute('href', '/conditions');
    await expect(
      page.getByRole('link', { name: 'politique de confidentialité' })
    ).toHaveAttribute('href', '/confidentialite');

    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByText('Saisissez votre nom complet.')).toBeVisible();

    // Chaque espace d'accès renvoie vers l'autre sans ambiguïté.
    await expect(page.getByRole('link', { name: /Ouvrir l’espace client/ })).toHaveAttribute(
      'href',
      '/client/connexion'
    );

    await page.goto('/bienvenue');

    await expect(
      page.getByRole('heading', { name: 'Bienvenue — créons votre pressing' })
    ).toBeVisible();
    await expect(page.getByText('impossible de créer un pressing ici')).toBeVisible();
  });

  test('les pages d’accès tiennent dans un écran mobile sans défilement horizontal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of [
      '/connexion',
      '/inscription',
      '/client/connexion',
      '/client/inscription',
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${path} ne doit pas défiler horizontalement`).toBeLessThanOrEqual(1);
    }
  });

  test('les pages légales publiques sont accessibles sans configuration', async ({ page }) => {
    await page.goto('/conditions');

    await expect(page).toHaveURL(/\/conditions$/);
    await expect(
      page.getByRole('heading', { name: 'Conditions d’utilisation' })
    ).toBeVisible();

    await page.getByRole('link', { name: 'Politique de confidentialité' }).click();

    await expect(page).toHaveURL(/\/confidentialite$/);
    await expect(
      page.getByRole('heading', { name: 'Politique de confidentialité' })
    ).toBeVisible();
  });

  test('l’onglet Sauvegarde affiche l’export chiffré local', async ({ page }) => {
    await page.getByRole('button', { name: /Paramètres/ }).click();
    await page.getByRole('tab', { name: /Sauvegarde/ }).click();

    await expect(page.getByRole('heading', { name: 'Sauvegarde locale chiffrée' })).toBeVisible();
    await expect(page.getByText('Non renseignée')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Télécharger la sauvegarde chiffrée' })).toBeVisible();
  });

  test('l’onglet Backend affiche l’état non configuré sans variables VITE', async ({ page }) => {
    await page.getByRole('button', { name: /Paramètres/ }).click();
    await page.getByRole('tab', { name: /Backend Supabase/ }).click();

    await expect(page.getByRole('heading', { name: 'Backend Supabase' })).toBeVisible();
    await expect(page.getByText('Non configuré')).toBeVisible();
    await expect(page.getByText('Aucune session')).toBeVisible();
  });
});
