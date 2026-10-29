import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DELIVERY_PROOF_SETTINGS,
  MAX_PROOF_PHOTO_LENGTH,
  MAX_PROOF_SIGNATURE_LENGTH,
  MAX_RECEIVER_NAME_LENGTH,
  buildDeliveryProof,
  describeDeliveryProof,
  generateDeliveryCode,
  hasDeliveryProof,
  hasDeliveryProofRequirements,
  isDeliveryCode,
  normalizeDeliveryProof,
  normalizeDeliveryProofSettings,
  validateDeliveryProofDraft,
} from '../../src/lib/deliveryProof';
import type { DeliveryProofSettings } from '../../src/types';

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SIGNATURE = 'data:image/png;base64,iVBORw0KGgo=';

const settings = (overrides: Partial<DeliveryProofSettings> = {}): DeliveryProofSettings => ({
  ...DEFAULT_DELIVERY_PROOF_SETTINGS,
  ...overrides,
});

describe('deliveryProof — code de remise', () => {
  it('génère toujours quatre chiffres, zéros de tête compris', () => {
    expect(generateDeliveryCode(() => 0)).toBe('0000');
    expect(generateDeliveryCode(() => 0.0042)).toBe('0042');
    expect(generateDeliveryCode(() => 0.9999)).toBe('9999');
    expect(generateDeliveryCode()).toMatch(/^\d{4}$/);
  });

  it('reconnaît un code à quatre chiffres et rejette le reste', () => {
    expect(isDeliveryCode('0042')).toBe(true);
    expect(isDeliveryCode('42')).toBe(false);
    expect(isDeliveryCode('12345')).toBe(false);
    expect(isDeliveryCode('12a4')).toBe(false);
    expect(isDeliveryCode('')).toBe(false);
    expect(isDeliveryCode(undefined)).toBe(false);
  });
});

describe('deliveryProof — réglages', () => {
  it('ne rend rien obligatoire par défaut', () => {
    expect(normalizeDeliveryProofSettings(undefined)).toEqual({
      requirePhoto: false,
      requireSignature: false,
      requireCode: false,
    });
    expect(hasDeliveryProofRequirements(DEFAULT_DELIVERY_PROOF_SETTINGS)).toBe(false);
  });

  it('ne retient que les vraies cases cochées', () => {
    expect(
      normalizeDeliveryProofSettings({
        requirePhoto: true,
        // Donnée locale corrompue : une chaîne n'est pas une case cochée.
        requireSignature: 'oui' as unknown as boolean,
        requireCode: true,
      })
    ).toEqual({ requirePhoto: true, requireSignature: false, requireCode: true });
    expect(hasDeliveryProofRequirements(settings({ requireCode: true }))).toBe(true);
  });
});

describe('deliveryProof — contrôle avant confirmation', () => {
  it('accepte une livraison sans aucune preuve quand rien n’est exigé', () => {
    expect(validateDeliveryProofDraft(null, { settings: settings() })).toEqual([]);
    expect(validateDeliveryProofDraft({}, { settings: settings() })).toEqual([]);
  });

  it('exige la photo quand le pressing l’a cochée', () => {
    const options = { settings: settings({ requirePhoto: true }) };
    expect(validateDeliveryProofDraft({}, options)).toEqual(['Ajoutez la photo du linge remis.']);
    expect(validateDeliveryProofDraft({ photoDataUrl: PHOTO }, options)).toEqual([]);
  });

  it('refuse une photo qui n’est pas une image embarquée ou qui dépasse le plafond', () => {
    const remote = 'https://exemple.ci/photo.jpg';
    expect(validateDeliveryProofDraft({ photoDataUrl: remote }, { settings: settings() })).toHaveLength(1);

    const huge = `data:image/png;base64,${'A'.repeat(MAX_PROOF_PHOTO_LENGTH)}`;
    expect(validateDeliveryProofDraft({ photoDataUrl: huge }, { settings: settings() })[0]).toContain(
      'trop lourde'
    );
  });

  it('exige la signature quand elle est obligatoire, et laisse passer une signature valide', () => {
    const options = { settings: settings({ requireSignature: true }) };
    expect(validateDeliveryProofDraft({}, options)).toEqual([
      'Faites signer le réceptionnaire avant de confirmer.',
    ]);
    expect(validateDeliveryProofDraft({ signatureDataUrl: SIGNATURE }, options)).toEqual([]);

    const tooBig = `data:image/png;base64,${'A'.repeat(MAX_PROOF_SIGNATURE_LENGTH)}`;
    expect(validateDeliveryProofDraft({ signatureDataUrl: tooBig }, options)).toHaveLength(1);
  });

  it('exige le bon code quand la tournée en possède un', () => {
    const options = { settings: settings({ requireCode: true }), expectedCode: '0042' };
    expect(validateDeliveryProofDraft({}, options)).toEqual([
      'Saisissez le code de remise à 4 chiffres donné par le client.',
    ]);
    expect(validateDeliveryProofDraft({ codeEntered: '0042' }, options)).toEqual([]);
    expect(validateDeliveryProofDraft({ codeEntered: '9999' }, options)).toEqual([
      'Le code de remise ne correspond pas à celui de cette livraison.',
    ]);
  });

  it('n’exige pas de code sur une livraison créée avant l’option', () => {
    expect(
      validateDeliveryProofDraft({}, { settings: settings({ requireCode: true }), expectedCode: undefined })
    ).toEqual([]);
  });

  it('rejette un code mal formé même quand il n’est pas obligatoire', () => {
    expect(validateDeliveryProofDraft({ codeEntered: '42' }, { settings: settings() })).toEqual([
      'Le code de remise doit contenir exactement 4 chiffres.',
    ]);
  });

  it('borne le nom du réceptionnaire et la note', () => {
    const longName = 'A'.repeat(MAX_RECEIVER_NAME_LENGTH + 1);
    expect(validateDeliveryProofDraft({ receiverName: longName }, { settings: settings() })[0]).toContain(
      'réceptionnaire'
    );
    expect(
      validateDeliveryProofDraft({ note: 'x'.repeat(301) }, { settings: settings() })[0]
    ).toContain('note de remise');
  });
});

describe('deliveryProof — enregistrement et relecture', () => {
  it('ne crée aucune preuve quand le coursier n’a rien saisi', () => {
    expect(
      buildDeliveryProof({}, { capturedAt: '2026-10-28T10:00:00.000Z' })
    ).toBeNull();
    expect(
      buildDeliveryProof({ photoDataUrl: null, note: '   ' }, { capturedAt: '2026-10-28T10:00:00.000Z' })
    ).toBeNull();
  });

  it('nettoie, horodate et signe la preuve enregistrée', () => {
    const proof = buildDeliveryProof(
      {
        photoDataUrl: PHOTO,
        signatureDataUrl: SIGNATURE,
        codeEntered: ' 0042 ',
        receiverName: '  Awa   Koné  ',
        note: '  Remis au gardien.  ',
      },
      {
        capturedAt: '2026-10-28T10:00:00.000Z',
        capturedByEmployeeId: 'emp-1',
        capturedByEmployeeName: 'Yao Coursier',
      }
    );

    expect(proof).not.toBeNull();
    expect(proof?.receiverName).toBe('Awa Koné');
    expect(proof?.note).toBe('Remis au gardien.');
    expect(proof?.codeEntered).toBe('0042');
    expect(proof?.capturedAt).toBe('2026-10-28T10:00:00.000Z');
    expect(proof?.capturedByEmployeeName).toBe('Yao Coursier');
    expect(describeDeliveryProof(proof)).toEqual([
      'Photo',
      'Signature',
      'Code de remise',
      'Réceptionné par Awa Koné',
    ]);
  });

  it('ignore une image invalide sans perdre le reste de la preuve', () => {
    const proof = buildDeliveryProof(
      { photoDataUrl: 'data:text/html;base64,PHNjcmlwdD4=', receiverName: 'Awa' },
      { capturedAt: '2026-10-28T10:00:00.000Z' }
    );
    expect(proof?.photoDataUrl).toBeUndefined();
    expect(proof?.receiverName).toBe('Awa');
    expect(hasDeliveryProof(proof)).toBe(true);
  });

  it('relit une preuve stockée en écartant ce qui est inexploitable', () => {
    expect(normalizeDeliveryProof(undefined)).toBeUndefined();
    expect(normalizeDeliveryProof({ photoDataUrl: PHOTO })).toBeUndefined(); // pas d'horodatage
    expect(normalizeDeliveryProof('invalide')).toBeUndefined();

    const proof = normalizeDeliveryProof({
      photoDataUrl: 'https://exemple.ci/p.jpg',
      signatureDataUrl: SIGNATURE,
      receiverName: 'Awa',
      capturedAt: '2026-10-28T10:00:00.000Z',
    });
    expect(proof?.photoDataUrl).toBeUndefined();
    expect(proof?.signatureDataUrl).toBe(SIGNATURE);
    expect(proof?.receiverName).toBe('Awa');

    // Une note seule survit à la relecture, sans devenir une preuve vérifiable.
    const noteOnly = normalizeDeliveryProof({
      note: 'Remis au gardien.',
      capturedAt: '2026-10-28T10:00:00.000Z',
    });
    expect(noteOnly?.note).toBe('Remis au gardien.');
    expect(hasDeliveryProof(noteOnly)).toBe(false);
  });

  it('distingue une preuve exploitable d’une preuve vide', () => {
    expect(hasDeliveryProof(undefined)).toBe(false);
    expect(hasDeliveryProof({ capturedAt: '2026-10-28T10:00:00.000Z' })).toBe(false);
    expect(hasDeliveryProof({ capturedAt: '2026-10-28T10:00:00.000Z', receiverName: 'Awa' })).toBe(true);
    expect(describeDeliveryProof(undefined)).toEqual([]);
  });
});
