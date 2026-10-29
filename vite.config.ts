import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // Autorise les hôtes de prévisualisation distants (ex. tunnels de dev).
      // Serveur de développement uniquement — sans effet sur le build prod.
      allowedHosts: true as const,
      // En mode agent, HMR peut être coupé pour éviter les rechargements
      // automatiques pendant les modifications. La surveillance reste active :
      // sans elle, Vite continuerait à servir l'ancien module même après un
      // clic explicite sur « Actualiser ».
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {},
    },
  };
});
