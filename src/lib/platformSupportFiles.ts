import { supabase } from './supabase';
import type { PlatformSupportAttachment } from './platformOperations';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
const safeName = (name: string): string => name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-120) || 'piece-jointe';

export async function uploadPlatformSupportFile(
  organizationId: string,
  ticketId: string,
  file: File,
): Promise<PlatformSupportAttachment> {
  if (!supabase) throw new Error('Les pièces jointes nécessitent Supabase Storage ; elles sont désactivées en démonstration.');
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Formats acceptés : PNG, JPEG, WebP ou PDF.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Chaque pièce jointe est limitée à 5 Mo.');
  const path = `${organizationId}/${ticketId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from('platform-support').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return { path, name: file.name, size: file.size, type: file.type };
}

export async function createPlatformSupportFileUrl(path: string): Promise<string> {
  if (!supabase) throw new Error('Supabase Storage n’est pas configuré.');
  const { data, error } = await supabase.storage.from('platform-support').createSignedUrl(path, 120);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function openPlatformSupportFile(path: string): Promise<void> {
  const url = await createPlatformSupportFileUrl(path);
  window.open(url, '_blank', 'noopener,noreferrer');
}
