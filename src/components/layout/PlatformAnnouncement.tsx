import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import {
  fetchPlatformPublicConfig,
  type PlatformPublicConfig,
} from '../../lib/platformAdmin';

/** Annonce de l'éditeur, sans secret ni réglage modifiable côté tenant. */
export const PlatformAnnouncement: React.FC = () => {
  const [config, setConfig] = useState<PlatformPublicConfig | null>(null);

  const load = useCallback(async () => {
    try {
      setConfig(await fetchPlatformPublicConfig());
    } catch {
      // Une annonce indisponible ne bloque jamais le travail du pressing.
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener('pressingpro:platform-config-updated', load);
    return () => window.removeEventListener('pressingpro:platform-config-updated', load);
  }, [load]);

  if (!config?.support_message.trim()) return null;
  const tone = config.support_message_tone;

  return (
    <div
      role={tone === 'critical' ? 'alert' : 'status'}
      className={`flex items-start gap-2 border-b px-4 py-2.5 text-[12px] font-semibold leading-relaxed ${
        tone === 'critical'
          ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200'
          : tone === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
            : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200'
      }`}
    >
      <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p><strong className="font-black">Information PressingPro CI :</strong> {config.support_message}</p>
    </div>
  );
};
