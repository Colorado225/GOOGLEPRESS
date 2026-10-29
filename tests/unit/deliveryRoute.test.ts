import { describe, expect, it } from 'vitest';
import { buildDeliveryItinerary, sanitizeItineraryAddress } from '../../src/lib/deliveryRoute';

describe('deliveryRoute — itinéraire vers une tournée', () => {
  it('encode l’adresse pour Google Maps et Waze', () => {
    const links = buildDeliveryItinerary({ address: 'Rue des Jardins, Cocody' });
    expect(links).not.toBeNull();
    expect(links?.googleMaps).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Rue%20des%20Jardins%2C%20Cocody'
    );
    expect(links?.waze).toBe('https://waze.com/ul?q=Rue%20des%20Jardins%2C%20Cocody&navigate=yes');
  });

  it('ajoute les précisions d’adresse quand elles existent', () => {
    const links = buildDeliveryItinerary({
      address: 'Boulevard Latrille',
      addressDetails: 'Immeuble Les Palmiers, 3e étage',
    });
    expect(decodeURIComponent(links?.googleMaps ?? '')).toContain(
      'Boulevard Latrille Immeuble Les Palmiers, 3e étage'
    );
  });

  it('privilégie le point enregistré sur la carte', () => {
    const links = buildDeliveryItinerary({
      address: 'Rue des Jardins, Cocody',
      destination: { lat: 5.36, lng: -4.0083, source: 'manual', recordedAt: '2026-10-28T10:00:00.000Z' },
    });
    expect(links?.googleMaps).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=5.360000%2C-4.008300'
    );
    expect(links?.waze).toBe('https://waze.com/ul?q=5.360000%2C-4.008300&navigate=yes');
  });

  it('retombe sur l’adresse quand le point est inutilisable', () => {
    const links = buildDeliveryItinerary({
      address: 'Cocody',
      destination: { lat: 0, lng: 0, source: 'manual', recordedAt: '2026-10-28T10:00:00.000Z' },
    });
    expect(decodeURIComponent(links?.googleMaps ?? '')).toContain('destination=Cocody');
  });

  it('n’émet aucun lien sans adresse', () => {
    expect(buildDeliveryItinerary({ address: '   ' })).toBeNull();
    expect(buildDeliveryItinerary({ address: '', addressDetails: '  ' })).toBeNull();
    expect(sanitizeItineraryAddress({ address: '  ' })).toBeNull();
  });

  it('nettoie les retours à la ligne et les caractères de contrôle', () => {
    expect(
      sanitizeItineraryAddress({ address: 'Cocody\n  Riviera\u0000  ' })
    ).toBe('Cocody Riviera');
  });

  it('borne la longueur de l’adresse', () => {
    const address = sanitizeItineraryAddress({ address: 'a'.repeat(400) });
    expect(address).toHaveLength(300);
  });

  it('neutralise une tentative d’injection dans l’URL', () => {
    const links = buildDeliveryItinerary({
      address: 'Cocody &destination=https://exemple.ci/piege',
    });
    // L'esperluette reste encodée : elle ne peut pas créer un second paramètre.
    expect(links?.googleMaps).toContain('%26destination%3Dhttps%3A%2F%2Fexemple.ci%2Fpiege');
    expect(links?.googleMaps.split('&')).toHaveLength(2);
    expect(links?.googleMaps.startsWith('https://www.google.com/maps/dir/?api=1&destination=')).toBe(true);
    expect(links?.waze.startsWith('https://waze.com/ul?q=')).toBe(true);
  });
});
