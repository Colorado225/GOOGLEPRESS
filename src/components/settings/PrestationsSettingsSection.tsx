import React, { useState } from 'react';
import { SegmentedControl } from '../common/SegmentedControl';
import { PressingSettingsSection } from './PressingSettingsSection';
import { BlanchisserieSettingsSection } from './BlanchisserieSettingsSection';

type PrestationsPan = 'pressing' | 'blanchisserie';

/**
 * Onglet « Prestations » des Paramètres.
 *
 * Deux familles de tarifs, chacune avec son modèle :
 *
 * - **Pressing** : les traitements (nettoyage à sec, lavage + repassage…), avec
 *   un modèle à la pièce, au kilo ou au forfait par prestation ;
 * - **Blanchisserie** : les forfaits au nombre de vêtements.
 */
export const PrestationsSettingsSection: React.FC = () => {
  const [pan, setPan] = useState<PrestationsPan>('pressing');

  return (
    <div className="space-y-4">
      <SegmentedControl<PrestationsPan>
        ariaLabel="Choisir la famille de prestations à régler"
        options={[
          { id: 'pressing', label: 'Pressing' },
          { id: 'blanchisserie', label: 'Blanchisserie' },
        ]}
        value={pan}
        onChange={setPan}
      />
      {pan === 'pressing' ? <PressingSettingsSection /> : <BlanchisserieSettingsSection />}
    </div>
  );
};
