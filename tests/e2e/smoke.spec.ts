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
