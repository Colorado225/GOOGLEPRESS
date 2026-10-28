import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabasePublicKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  ''
).trim();

/**
 * Le branchement reste progressif : sans variables d’environnement, l’application
 * continue de fonctionner avec ses données locales et aucun client réseau n’est
 * créé. Avec variables, seul le client Auth/PostgREST est initialisé ; la
 * bascule des écrans métier se fera ensuite domaine par domaine.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabasePublicKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export interface SupabaseConfigStatus {
  configured: boolean;
  url: string | null;
  publicKeyConfigured: boolean;
}

export const getSupabaseConfigStatus = (): SupabaseConfigStatus => ({
  configured: isSupabaseConfigured,
  url: supabaseUrl || null,
  publicKeyConfigured: Boolean(supabasePublicKey),
});

export const getSupabaseClient = (): SupabaseClient<Database> | null => supabase;
