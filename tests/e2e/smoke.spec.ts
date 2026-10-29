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

  test('le thème clair/sombre est actif, mémorisé et accessible sur mobile', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('pressingpro_theme', 'light'));
    await page.reload();

    const enableDark = page.getByRole('button', { name: 'Passer au thème sombre' });
    await expect(enableDark).toBeVisible();
    await enableDark.click();

    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('pressingpro_theme'))).toBe('dark');

    const enableLight = page.getByRole('button', { name: 'Passer au thème clair' });
    await expect(enableLight).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Actualiser l’application' }).click();
    await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
    await expect(page.getByRole('button', { name: 'Passer au thème clair' })).toBeVisible();

    await page.getByRole('button', { name: 'Passer au thème clair' }).click();
    await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('pressingpro_theme'))).toBe('light');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'Passer au thème sombre' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('le POS ouvre le parcours en quatre étapes avec client et service', async ({ page }) => {
    await page.getByRole('button', { name: /Réception \(POS\)/ }).click();
    await expect(page.getByRole('heading', { name: 'Client & service', exact: true })).toBeVisible();
    await expect(page.getByText('1/4', { exact: true })).toBeVisible();

    // La démonstration s'ouvre avec un panier : le service y est volontairement
    // verrouillé. Le vider permet de tester un nouveau choix de grille et bloque
    // l'accès direct au paiement tant qu'aucun article n'est présent.
    await page.getByRole('button', { name: 'Vider', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Étape 4 : Paiement' })).toBeDisabled();
    await page.getByRole('button', { name: 'Choisir Blanchisserie', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Choisir Blanchisserie', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Choisir Pressing', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Choisir Pressing', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Choisir les articles', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Articles & prestations', exact: true })).toBeVisible();
  });

  test('la blanchisserie répartit le dépôt avec clic, plus et moins sans dépasser le total', async ({ page }) => {
    await page.goto('/reception');
    await page.getByRole('button', { name: 'Vider', exact: true }).click();
    await page.getByRole('button', { name: 'Choisir Blanchisserie', exact: true }).click();
    await page.getByRole('button', { name: 'Choisir les articles', exact: true }).click();

    const totalInput = page.locator('#blanchisserie-garments');
    await totalInput.fill('2');
    const depositDetails = page.getByRole('region', { name: 'Vêtements du dépôt' });
    const addToCart = page.getByRole('button', { name: 'Ajouter au panier', exact: true });
    await expect(addToCart).toBeDisabled();

    // Le clic ajoute une pièce et ses informations dans le détail du prix.
    await page.getByRole('button', { name: 'Sélectionner Chemise', exact: true }).click();
    await expect(depositDetails.getByText('Chemise', { exact: true })).toBeVisible();
    await expect(depositDetails.getByText('Coton, lin, col amidonné', { exact: true })).toBeVisible();
    await expect(depositDetails.getByText('× 1', { exact: true })).toBeVisible();
    await expect(page.getByText('1 vêtement à répartir', { exact: true })).toBeVisible();

    // Le bouton + consomme la dernière pièce disponible.
    await page.getByRole('button', { name: 'Ajouter une pièce : Chemise', exact: true }).click();
    await expect(page.getByText('0 restant — sélection complète', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sélectionner Robe', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Ajouter une pièce : Chemise', exact: true })).toBeDisabled();
    await expect(addToCart).toBeEnabled();

    // À zéro, − libère une pièce et permet de remplacer la sélection.
    await page.getByRole('button', { name: 'Retirer une pièce : Chemise', exact: true }).click();
    await expect(page.getByText('1 vêtement à répartir', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sélectionner Robe', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Sélectionner Pantalon', exact: true }).click();
    await expect(page.getByText('0 restant — sélection complète', { exact: true })).toBeVisible();
    await expect(depositDetails.getByText('Pantalon', { exact: true })).toBeVisible();
    await expect(depositDetails.getByText('Pli marqué, costume, chino', { exact: true })).toBeVisible();
    await expect(page.locator('output[aria-label="Quantité de Chemise"]')).toHaveText('1');
    await expect(page.locator('output[aria-label="Quantité de Pantalon"]')).toHaveText('1');

    // Le total ne peut pas passer sous les deux pièces déjà identifiées.
    await expect(page.getByRole('button', { name: 'Retirer un vêtement', exact: true })).toBeDisabled();
    await totalInput.fill('1');
    await expect(totalInput).toHaveValue('2');

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // Effacer restitue les deux pièces ; une nouvelle répartition peut être ajoutée.
    await page.getByRole('button', { name: 'Effacer la sélection', exact: true }).click();
    await expect(page.getByText('2 vêtements à répartir', { exact: true })).toBeVisible();
    await expect(addToCart).toBeDisabled();
    await page.getByRole('button', { name: 'Sélectionner Chemise', exact: true }).click();
    await page.getByRole('button', { name: 'Sélectionner Pantalon', exact: true }).click();
    await addToCart.click();
    await expect(page.getByText('2 × Lavage + repassage — à l’unité', { exact: true })).toBeVisible();
    await expect(totalInput).toHaveValue('0');
  });

  test('une réception Pressing accepte des lots Normal et Express sur un seul ticket', async ({ page }) => {
    await page.goto('/reception');
    await page.getByRole('button', { name: 'Vider', exact: true }).click();
    await page.getByRole('button', { name: 'Choisir les articles', exact: true }).click();

    // Deux articles au délai normal, avec d'abord une date libre au tarif standard.
    await page.getByRole('button', { name: 'Ajouter', exact: true }).first().click();
    await page.getByRole('button', { name: 'Ajouter', exact: true }).first().click();
    await page.getByRole('button', { name: 'Retrait & consignes', exact: true }).click();
    await page.getByRole('radio', { name: /Date libre/ }).check();
    await page.getByLabel('Date de retrait libre', { exact: true }).fill('2030-01-15');
    await page.getByRole('button', { name: 'Articles & prestations', exact: true }).click();

    // Le même premier article est ensuite ajouté dans un lot Express distinct.
    const nextSpeed = page.getByRole('group', { name: 'Choisir le délai des prochains articles' });
    await nextSpeed.getByRole('button', { name: 'Express 24h ×2', exact: true }).click();
    await page.getByRole('button', { name: '+ Ajouter en Express', exact: true }).first().click();
    await expect(page.getByText('1 vêtement Express • 2 au délai normal', { exact: true })).toBeVisible();

    const expressFee = page
      .getByText('Supplément Express 24h — lignes sélectionnées (×2)', { exact: true })
      .locator('..');
    await expect(expressFee).toHaveText(/1\s*500/);

    // Une ligne peut être corrigée indépendamment des autres.
    await page.getByRole('button', { name: 'Express 24h : Pantalon', exact: true }).click();
    await expect(page.getByText('2 vêtements Express • 1 au délai normal', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Normal : Pantalon', exact: true }).click();
    await expect(page.getByText('1 vêtement Express • 2 au délai normal', { exact: true })).toBeVisible();

    // Recherche et filtres du panier : ils masquent des lignes sans changer le total.
    const cartSpeedFilter = page.getByRole('group', { name: 'Filtrer le panier par délai' });
    const cartSearch = page.getByRole('searchbox', { name: 'Rechercher dans le panier' });
    await cartSpeedFilter.getByRole('button', { name: 'Express', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Express 24h : Chemise', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Normal : Pantalon', exact: true })).toHaveCount(0);
    await cartSpeedFilter.getByRole('button', { name: 'Normal', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Normal : Pantalon', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Express 24h : Chemise', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Express 24h : Chemise', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await cartSpeedFilter.getByRole('button', { name: 'Tous', exact: true }).click();
    await cartSearch.fill('express');
    await expect(page.getByRole('button', { name: 'Express 24h : Chemise', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Normal : Pantalon', exact: true })).toHaveCount(0);
    await cartSearch.fill('pantalon');
    await expect(page.getByRole('button', { name: 'Normal : Pantalon', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Express 24h : Chemise', exact: true })).toHaveCount(0);
    await cartSearch.fill('');
    await expect(expressFee).toHaveText(/1\s*500/);

    await page.getByRole('button', { name: 'Retrait & consignes', exact: true }).click();
    await expect(page.getByText('Priorité Express 24h :', { exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Express 24h dérivé des articles' })).toBeChecked();
    await expect(page.getByRole('radio', { name: /Standard 48h/ })).toBeDisabled();
    await expect(page.getByRole('radio', { name: /Différé samedi/ })).toBeDisabled();
    await expect(page.getByLabel('Date de retrait libre', { exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Vérifier la commande', exact: true }).click();

    const chemiseRows = page.getByRole('row').filter({ hasText: 'Chemise' });
    await expect(chemiseRows.nth(0).getByText('Normal', { exact: true })).toBeVisible();
    await expect(chemiseRows.nth(1).getByText('Express 24h', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Confirmer & Enregistrer la commande/ }).click();
    await expect(page.getByText(/Reçu du ticket #TK-/)).toBeVisible();

    // Une seule commande est créée, avec trois lignes et le seul supplément Express.
    await expect.poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('pressingpro_orders');
      if (!raw) return null;
      const orders = JSON.parse(raw) as Array<{
        lines: { isExpress?: boolean }[];
        serviceFees: number;
        isUrgent?: boolean;
        promisedAt: string;
      }>;
      const order = orders[0];
      return {
        lines: order.lines.length,
        expressLines: order.lines.filter((line) => line.isExpress).length,
        normalLines: order.lines.filter((line) => line.isExpress === false).length,
        serviceFees: order.serviceFees,
        isUrgent: order.isUrgent,
        promisedAt: order.promisedAt,
      };
    })).toEqual({
      lines: 3,
      expressLines: 1,
      normalLines: 2,
      serviceFees: 1500,
      isUrgent: true,
      promisedAt: expect.stringMatching(/^Demain/),
    });

    // Dans l'historique, la commande mixte est retrouvable dans Express (prioritaire).
    const ticketNumber = await page.evaluate(() => {
      const orders = JSON.parse(localStorage.getItem('pressingpro_orders') ?? '[]') as Array<{ ticketNumber: string }>;
      return orders[0].ticketNumber;
    });
    await page.goto('/commandes');
    await page.getByRole('searchbox', { name: 'Rechercher une commande' }).fill(ticketNumber);
    const speedSelect = page.getByLabel('Filtrer les commandes par délai', { exact: true });
    const orderRow = page.getByRole('row').filter({ hasText: ticketNumber });
    await speedSelect.selectOption('express');
    await expect(orderRow).toBeVisible();
    await expect(orderRow.getByText('Express · mixte', { exact: true })).toBeVisible();
    await speedSelect.selectOption('normal');
    await expect(orderRow).toHaveCount(0);
    await speedSelect.selectOption('mixed');
    await expect(orderRow).toBeVisible();
  });

  test('les modèles au kilo et au forfait se règlent puis se vendent avec leurs tarifs', async ({ page }) => {
    await page.goto('/parametres');
    await page.getByRole('tab', { name: /Prestations/ }).click();

    // Deux nouvelles prestations, sans modifier la grille historique à la pièce.
    await page.getByRole('button', { name: 'Ajouter une prestation', exact: true }).click();
    await page.locator('input[value="Nouvelle prestation"]').fill('Lavage au kilo');
    await page.getByLabel('Modèle de facturation — Lavage au kilo', { exact: true }).selectOption('kilo');
    await page.getByLabel('Prix au kilo pour Lavage au kilo', { exact: true }).fill('600');

    await page.getByRole('button', { name: 'Ajouter une prestation', exact: true }).click();
    await page.locator('input[value="Nouvelle prestation"]').fill('Forfait famille');
    await page.getByLabel('Modèle de facturation — Forfait famille', { exact: true }).selectOption('forfait');
    await page.getByLabel('Poids du forfait pour Forfait famille', { exact: true }).fill('5');
    await page.getByLabel('Prix du forfait pour Forfait famille', { exact: true }).fill('2500');
    await page.getByLabel('Prix du kilo supplémentaire pour Forfait famille', { exact: true }).fill('600');
    await page.setViewportSize({ width: 390, height: 844 });
    const settingsOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(settingsOverflow).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: 'Enregistrer les prestations', exact: true }).click();

    await expect.poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('pressingpro_shop_settings');
      if (!raw) return null;
      const settings = JSON.parse(raw) as {
        pressing?: { services?: Array<{ label: string; pricingMode?: string; kiloPrice?: number }> };
      };
      return settings.pressing?.services?.find((service) => service.label === 'Lavage au kilo');
    })).toMatchObject({ pricingMode: 'kilo', kiloPrice: 600 });

    await page.goto('/reception');
    await page.getByRole('button', { name: 'Vider', exact: true }).click();
    await page.getByRole('button', { name: 'Choisir les articles', exact: true }).click();
    const treatments = page.getByRole('group', { name: 'Choisir le traitement appliqué aux articles ajoutés' });
    const nextSpeed = page.getByRole('group', { name: 'Choisir le délai des prochains articles' });

    await treatments.getByRole('button', { name: 'Lavage au kilo', exact: true }).click();
    await page.getByLabel('Poids en kilos pour Lavage au kilo', { exact: true }).fill('2.5');
    await expect(page.getByText('Calcul pour 2,5 kg', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter la prestation au panier', exact: true }).click();
    await expect(page.getByText(/2,5 kg Linge au kilo/)).toBeVisible();

    await nextSpeed.getByRole('button', { name: 'Express 24h ×2', exact: true }).click();
    await treatments.getByRole('button', { name: 'Forfait famille', exact: true }).click();
    await page.getByLabel('Poids en kilos pour Forfait famille', { exact: true }).fill('6.5');
    await expect(page.getByText('Calcul pour 6,5 kg', { exact: true })).toBeVisible();
    await expect(page.getByText(/Avec Express 24h : 6\s*800/)).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter la prestation au panier', exact: true }).click();

    const expressFee = page
      .getByText('Supplément Express 24h — lignes sélectionnées (×2)', { exact: true })
      .locator('..');
    await expect(expressFee).toHaveText(/3\s*400/);
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Retrait & consignes', exact: true }).click();
    await expect(page.getByText('Priorité Express 24h :', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Vérifier la commande', exact: true }).click();
    await expect(page.getByText(/Forfait 5 kg — Forfait famille/)).toBeVisible();
    await page.getByRole('button', { name: /Confirmer & Enregistrer la commande/ }).click();
    await expect(page.getByText(/Reçu du ticket #TK-/)).toBeVisible();

    await expect.poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('pressingpro_orders');
      if (!raw) return null;
      const orders = JSON.parse(raw) as Array<{
        subtotal: number;
        serviceFees: number;
        discount: number;
        total: number;
        lines: Array<{
          pricingType?: string;
          unitLabel?: string;
          weightKg?: number;
          isExpress?: boolean;
          subtotal: number;
        }>;
      }>;
      const order = orders[0];
      return {
        subtotal: order.subtotal,
        serviceFees: order.serviceFees,
        totalBeforeDiscount: order.total + order.discount,
        lines: order.lines.map((line) => ({
          pricingType: line.pricingType,
          unitLabel: line.unitLabel,
          weightKg: line.weightKg,
          isExpress: line.isExpress,
          subtotal: line.subtotal,
        })),
      };
    })).toEqual({
      subtotal: 4900,
      serviceFees: 3400,
      totalBeforeDiscount: 8300,
      lines: [
        { pricingType: 'kilo', unitLabel: 'kg', weightKg: 2.5, isExpress: false, subtotal: 1500 },
        { pricingType: 'unit', unitLabel: 'forfait', weightKg: 5, isExpress: true, subtotal: 2500 },
        { pricingType: 'kilo', unitLabel: 'kg', weightKg: 1.5, isExpress: true, subtotal: 900 },
      ],
    });
  });

  test('le parcours complet valide chaque étape, protège la grille et génère le ticket', async ({ page }) => {
    await page.goto('/reception');
    await page.getByRole('button', { name: 'Vider', exact: true }).click();
    await page.getByRole('button', { name: 'Choisir les articles', exact: true }).click();

    const logisticsNext = page.getByRole('button', { name: 'Retrait & consignes', exact: true });
    await expect(logisticsNext).toBeDisabled();
    await page.getByRole('button', { name: 'Ajouter', exact: true }).first().click();
    await expect(page.getByText('1 × Chemise', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Express 24h : Chemise', exact: true }).click();
    await expect(logisticsNext).toBeEnabled();

    // Le retour est libre, mais une grille tarifaire ne peut plus être mélangée.
    await page.getByRole('button', { name: 'Client & service', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Choisir Pressing', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Choisir Blanchisserie', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Choisir les articles', exact: true }).click();
    await expect(page.getByText('1 × Chemise', { exact: true })).toBeVisible();
    await logisticsNext.click();

    await expect(page.getByRole('radio', { name: 'Express 24h dérivé des articles' })).toBeChecked();
    await page.getByRole('radio', { name: /Livraison à domicile/ }).check();
    await page.locator('#pos-delivery-address').fill('Cocody Riviera, près de la pharmacie');
    await page.getByPlaceholder('Ex: Tache de sauce sur boubou, bouton manche gauche fragile...').fill('Repassage délicat, bouton fragile');
    await page.getByRole('button', { name: 'Vérifier la commande', exact: true }).click();

    await expect(page.getByText('Étape 4 • Paiement & validation', { exact: true })).toBeVisible();
    await expect(page.getByText('Chemise', { exact: true })).toBeVisible();
    await expect(page.getByText('« Repassage délicat, bouton fragile »', { exact: true })).toBeVisible();
    await expect(page.getByText('Supplément Express 24h — lignes sélectionnées (×2)', { exact: true })).toBeVisible();
    await page.getByRole('spinbutton').fill('1000');
    await expect.poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('pressingpro_pos_draft');
      return raw ? (JSON.parse(raw) as { orderStep?: number }).orderStep : null;
    })).toBe(4);

    // L'étape 4, le panier et l'acompte sont eux aussi restaurables.
    await page.getByRole('button', { name: 'Actualiser l’application' }).click();
    await expect(page.getByText('Étape 4 • Paiement & validation', { exact: true })).toBeVisible();
    await expect(page.getByText('Chemise', { exact: true })).toBeVisible();
    await expect(page.getByRole('spinbutton')).toHaveValue('1000');
    await page.getByRole('button', { name: /Confirmer & Enregistrer la commande/ }).click();

    await expect(page.getByText(/Reçu du ticket #TK-/)).toBeVisible();
    await page.getByRole('tab', { name: 'Fiche atelier' }).click();
    await expect(page.getByRole('tab', { name: 'Fiche atelier' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Fermer l’aperçu du reçu' }).click();
    await expect(page.getByRole('heading', { name: 'Client & service', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choisir Blanchisserie', exact: true })).toBeEnabled();
  });

  test('les quatre étapes du POS restent sans défilement horizontal sur mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/reception');

    const expectNoHorizontalOverflow = async (step: string) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${step} ne doit pas défiler horizontalement`).toBeLessThanOrEqual(1);
    };

    await expect(page.getByRole('heading', { name: 'Client & service', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow('Client & service');
    await page.getByRole('button', { name: 'Choisir les articles', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Articles & prestations', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow('Articles & prestations');
    await page.getByRole('button', { name: 'Retrait & consignes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Retrait, livraison & consignes', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow('Retrait & consignes');
    await page.getByRole('button', { name: 'Vérifier la commande', exact: true }).click();
    await expect(page.getByText('Étape 4 • Paiement & validation', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow('Paiement & validation');
  });

  test('la session reste stable entre onglets et Actualiser restaure le brouillon à l’étape logistique', async ({
    page,
    context,
  }) => {
    await page.goto('/reception');
    await page.getByRole('button', { name: 'Choisir les articles', exact: true }).click();

    // Le premier article encore absent du panier de démonstration est le pantalon.
    await page.getByRole('button', { name: 'Ajouter', exact: true }).first().click();
    await expect(page.getByText('1 × Pantalon', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Retrait & consignes', exact: true }).click();

    const notes = page.getByPlaceholder(
      'Ex: Tache de sauce sur boubou, bouton manche gauche fragile...'
    );
    await expect(page.getByRole('heading', { name: 'Retrait, livraison & consignes', exact: true })).toBeVisible();
    await page.getByRole('radio', { name: /Livraison à domicile/ }).check();
    await page.locator('#pos-delivery-address').fill('Cocody Angré, rue des Jardins');
    await page.locator('#pos-delivery-details').fill('Portail vert, deuxième étage');
    await notes.fill('Bouton fragile — consigne à conserver après rechargement');

    // Attendre l'écriture des instantanés panier et étape avant rechargement.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const rawCart = localStorage.getItem('pressingpro_pos_cart');
          const rawDraft = localStorage.getItem('pressingpro_pos_draft');
          if (!rawCart || !rawDraft) return false;
          const cart = JSON.parse(rawCart) as { lines?: { quantity: number; name: string }[] };
          const draft = JSON.parse(rawDraft) as { orderStep?: number };
          return draft.orderStep === 3 && Boolean(
            cart.lines?.some((line) => line.name === 'Pantalon' && line.quantity === 1)
          );
        })
      )
      .toBe(true);

    // Passer à un autre onglet ne doit pas démonter/recharger l'application.
    await page.evaluate(() => {
      document.documentElement.dataset.sessionProbe = 'active';
    });
    const otherPage = await context.newPage();
    await otherPage.goto('about:blank');
    await otherPage.bringToFront();
    await page.bringToFront();
    await expect(page.locator('html')).toHaveAttribute('data-session-probe', 'active');
    await expect(notes).toHaveValue('Bouton fragile — consigne à conserver après rechargement');
    await otherPage.close();

    // Le rechargement n'a lieu que sur demande explicite de l'utilisateur.
    await page.getByRole('button', { name: 'Actualiser l’application' }).click();
    await expect(page.getByRole('heading', { name: 'Retrait, livraison & consignes', exact: true })).toBeVisible();
    await expect(notes).toHaveValue('Bouton fragile — consigne à conserver après rechargement');
    await expect(page.locator('#pos-delivery-address')).toHaveValue('Cocody Angré, rue des Jardins');
    await expect(page.locator('#pos-delivery-details')).toHaveValue('Portail vert, deuxième étage');

    await page.getByRole('button', { name: 'Articles & prestations', exact: true }).click();
    await expect(page.getByText('1 × Pantalon', { exact: true })).toBeVisible();
  });

  test('l’atelier affiche une action de notification locale dynamique', async ({ page }) => {
    await page.getByRole('button', { name: /Production & Remise/ }).click();

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
    await expect(page.getByRole('heading', { name: 'Client & service', exact: true })).toBeVisible();

    // Navigation interne : l’URL suit l’écran choisi dans la barre latérale.
    await page.getByRole('button', { name: /Production & Remise/ }).click();
    await expect(page).toHaveURL(/\/atelier$/);

    // Bouton Précédent du navigateur : retour à l’écran précédent.
    await page.goBack();
    await expect(page).toHaveURL(/\/reception$/);
    await expect(page.getByRole('heading', { name: 'Client & service', exact: true })).toBeVisible();

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
    await page.getByRole('button', { name: /Production & Remise/ }).click();
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
    // `exact` : le pied de page propose aussi « Conditions d’utilisation ».
    await expect(
      page.getByRole('link', { name: 'conditions d’utilisation', exact: true })
    ).toHaveAttribute('href', '/conditions');
    await expect(
      page.getByRole('link', { name: 'politique de confidentialité', exact: true })
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

  test('aucune déconnexion n’est proposée en démonstration locale', async ({ page }) => {
    // Sans Supabase, il n’y a aucun compte : proposer « Se déconnecter »
    // laisserait croire à une session qui n’existe pas.
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0);
    await page.getByRole('button', { name: /Paramètres/ }).click();
    // Depuis l'accueil, la navigation interne doit aussi mettre l'URL à jour.
    await expect(page).toHaveURL(/\/parametres$/);
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toHaveCount(0);
  });

  test('le super-admin gère les comptes clients, les abonnements et la configuration globale', async ({ page }) => {
    await page.goto('/administration');
    await expect(page.getByRole('heading', { name: 'Administration plateforme' })).toBeVisible();
    await expect(page.getByText('Super-admin unique', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'À valider', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Gérer Pressing Harmonie — démonstration' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gérer Pressing Émeraude — démonstration' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Gérer Pressing Harmonie — démonstration' }).click();

    await expect(page.getByLabel('Formule appliquée pour Harmonie Cocody')).toHaveValue('pro');
    await page.getByRole('button', { name: 'Valider Pro', exact: true }).click();
    await expect(page.getByText('Abonnement de Harmonie Cocody appliqué.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Appliquer l’abonnement', exact: true })).toBeVisible();

    await page.getByLabel('Catégorie de la note').selectOption('configuration');
    await page.getByLabel('Nouvelle note de support').fill('Paramètres de caisse vérifiés avec le propriétaire fictif.');
    await page.getByRole('button', { name: 'Ajouter la note interne', exact: true }).click();
    await expect(
      page.getByRole('paragraph').filter({ hasText: 'Paramètres de caisse vérifiés avec le propriétaire fictif.' })
    ).toBeVisible();

    await page.getByLabel('Motif du verrouillage').fill('Vérification administrative fictive');
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Verrouiller le compte', exact: true }).click();
    await expect(page.getByText('Compte verrouillé : les accès RLS sont fermés.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Réactiver le compte', exact: true }).click();
    await expect(page.getByText('Compte réactivé.', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Configuration globale', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Configuration de la plateforme' })).toBeVisible();
    await expect(page.getByText('Compte réactivé.', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.getByLabel('Autoriser les nouvelles inscriptions').uncheck();
    await page.getByLabel('Annonce globale de support').fill('Maintenance technique fictive à 22 h.');
    await page.getByLabel('Niveau de l’annonce').selectOption('warning');
    await page.getByRole('button', { name: 'Enregistrer la configuration globale', exact: true }).click();
    await expect(page.getByText('Configuration globale enregistrée.', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Quitter la console', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Information PressingPro CI : Maintenance technique fictive à 22 h.', { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/administration');
    await expect(page.getByRole('heading', { name: 'Administration plateforme' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('le centre des opérations gère facturation, support, campagnes et supervision', async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto('/administration');
    const adminNavigation = page.getByRole('navigation', { name: 'Navigation de l’administration' });
    await expect(adminNavigation).toBeVisible();
    await expect(adminNavigation.getByRole('button')).toHaveCount(3);
    const sidebarBox = await adminNavigation.boundingBox();
    const accountsHeadingBox = await page.getByRole('heading', { name: 'Comptes clients de la plateforme' }).boundingBox();
    expect(sidebarBox).not.toBeNull();
    expect(accountsHeadingBox).not.toBeNull();
    expect(sidebarBox!.width).toBeGreaterThan(200);
    expect(sidebarBox!.width).toBeLessThan(280);
    expect(accountsHeadingBox!.x).toBeGreaterThan(sidebarBox!.x + sidebarBox!.width - 1);
    await page.getByRole('button', { name: 'Masquer la sidebar', exact: true }).click();
    await expect(adminNavigation).toHaveCount(0);
    const showSidebarButton = page.getByRole('button', { name: 'Afficher la sidebar', exact: true });
    await expect(showSidebarButton).toHaveAttribute('aria-expanded', 'false');
    const expandedAccountsHeadingBox = await page.getByRole('heading', { name: 'Comptes clients de la plateforme' }).boundingBox();
    expect(expandedAccountsHeadingBox!.x).toBeLessThan(accountsHeadingBox!.x);
    await showSidebarButton.click();
    await expect(adminNavigation).toBeVisible();
    await expect(page.getByRole('button', { name: 'Masquer la sidebar', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(adminNavigation.getByRole('button', { name: 'Comptes clients', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await adminNavigation.getByRole('button', { name: 'Centre des opérations', exact: true }).click();
    await expect(adminNavigation.getByRole('button', { name: 'Centre des opérations', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: 'Centre des opérations SaaS' })).toBeVisible();
    const operationSections = page.getByRole('navigation', { name: 'Sections du centre des opérations' });
    await expect(operationSections.getByRole('button')).toHaveCount(3);
    await expect(operationSections.getByRole('button', { name: 'Pilotage & revenus', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const operationTabs = page.getByRole('navigation', { name: 'Sous-onglets du centre des opérations' });
    await expect(operationTabs.getByRole('button')).toHaveCount(3);
    await expect(operationTabs.getByRole('button', { name: 'Offres & renouvellements', exact: true })).toBeVisible();
    await expect(operationTabs.getByRole('button', { name: 'Pilotage', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Revenu mensuel récurrent', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Finances', exact: true }).click();
    await page.getByLabel('Pressing client', { exact: true }).selectOption('demo-org-harmonie');
    await expect(page.getByLabel('Agence', { exact: true })).toHaveValue('demo-shop-harmonie-cocody');
    await page.getByLabel('Sous-total de la facture').fill('5000');
    await page.getByRole('button', { name: 'Créer la facture', exact: true }).click();
    await expect(page.getByText('Facture créée et journalisée.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'PP-2026-000002', exact: true }).click();
    await expect(page.getByLabel('Montant de la transaction')).toHaveValue('5000');
    await page.getByLabel('Référence de la transaction').fill('WAVE-DEMO-0002');
    await page.getByRole('button', { name: 'Enregistrer la transaction', exact: true }).click();
    await expect(page.getByText('Paiement enregistré et facture recalculée.', { exact: true })).toBeVisible();
    await expect(page.getByText('Payée', { exact: true }).first()).toBeVisible();
    await page.getByLabel('Statut de la transaction').selectOption('refunded');
    await page.getByLabel('Montant de la transaction').fill('6000');
    await page.getByLabel('Référence de la transaction').fill('REFUND-DEMO-EXCESSIF');
    await page.getByRole('button', { name: 'Enregistrer la transaction', exact: true }).click();
    await expect(page.getByText('Le remboursement dépasse les encaissements nets.', { exact: true })).toBeVisible();
    await expect(page.locator('aside').last()).not.toContainText('REFUND-DEMO-EXCESSIF');

    await operationSections.getByRole('button', { name: 'Relations clients', exact: true }).click();
    await expect(operationSections.getByRole('button', { name: 'Relations clients', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(operationTabs.getByRole('button')).toHaveCount(2);
    await page.getByRole('button', { name: 'Tickets support', exact: true }).click();
    await page.getByLabel('Réponse au ticket').fill('Réponse fictive du support après vérification.');
    await page.getByRole('button', { name: 'Envoyer au propriétaire', exact: true }).click();
    await expect(page.getByText('Réponse visible par le propriétaire ajoutée.', { exact: true })).toBeVisible();
    await expect(page.getByText('Réponse fictive du support après vérification.', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Communications', exact: true }).click();
    await page.getByLabel('Titre de la campagne').fill('Information fictive Pro');
    await page.getByLabel('Message de la campagne').fill('Message de démonstration pour les comptes Pro.');
    await page.getByLabel('Type d’audience').selectOption('plan');
    await page.getByLabel('Formule ciblée').selectOption('pro');
    await page.getByRole('button', { name: 'Enregistrer la campagne', exact: true }).click();
    await expect(page.getByText('Campagne enregistrée.', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Information fictive Pro' })).toBeVisible();

    await operationSections.getByRole('button', { name: 'Système & conformité', exact: true }).click();
    await expect(operationSections.getByRole('button', { name: 'Système & conformité', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(operationTabs.getByRole('button')).toHaveCount(3);
    await expect(operationTabs.getByRole('button', { name: 'Sécurité', exact: true })).toBeVisible();
    await expect(operationTabs.getByRole('button', { name: 'Audit', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Supervision', exact: true }).click();
    await page.getByRole('button', { name: 'Vérifier maintenant', exact: true }).click();
    await expect(page.getByText('Contrôle Supabase enregistré avec succès.', { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(adminNavigation).toHaveCount(0);
    await page.getByRole('button', { name: 'Afficher la sidebar', exact: true }).click();
    await expect(adminNavigation).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Menu de l’administration' })).toBeVisible();
    const closeMobileSidebar = page.getByRole('button', { name: 'Masquer la sidebar', exact: true });
    await expect(closeMobileSidebar).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(adminNavigation.getByRole('button', { name: 'Configuration globale', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(closeMobileSidebar).toBeFocused();
    await expect(adminNavigation.getByRole('button')).toHaveCount(4);
    await expect(operationSections.getByRole('button')).toHaveCount(3);
    await expect(operationTabs.getByRole('button')).toHaveCount(3);
    const mobileSidebarBox = await adminNavigation.boundingBox();
    expect(mobileSidebarBox).not.toBeNull();
    expect(mobileSidebarBox!.x).toBe(0);
    expect(mobileSidebarBox!.width).toBe(272);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await closeMobileSidebar.click();
    await expect(adminNavigation).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Afficher la sidebar', exact: true })).toBeFocused();
    const overflowWithoutSidebar = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflowWithoutSidebar).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Afficher la sidebar', exact: true }).click();
    await expect(adminNavigation).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(adminNavigation).toHaveCount(0);
    await page.getByRole('button', { name: 'Afficher la sidebar', exact: true }).click();
    await adminNavigation.getByRole('button', { name: 'Comptes clients', exact: true }).click();
    await expect(adminNavigation).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Comptes clients de la plateforme' })).toBeVisible();
  });

  test('l’onglet Backend affiche l’état non configuré sans variables VITE', async ({ page }) => {
    await page.getByRole('button', { name: /Paramètres/ }).click();
    await page.getByRole('tab', { name: /Backend Supabase/ }).click();

    await expect(page.getByRole('heading', { name: 'Backend Supabase' })).toBeVisible();
    await expect(page.getByText('Non configuré')).toBeVisible();
    await expect(page.getByText('Aucune session')).toBeVisible();
  });
});
