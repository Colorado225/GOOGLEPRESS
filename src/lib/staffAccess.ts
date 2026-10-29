import type { RemoteMembership } from './supabaseOrders';

export type StaffAccessMode =
  | 'supabase-required'
  | 'explicit-local-demo'
  | 'configuration-required';

export interface StaffAccessEnvironment {
  supabaseConfigured: boolean;
  isDevelopment: boolean;
  allowLocalDemo: boolean;
}

export const STAFF_ROLES = [
  'organization_owner',
  'shop_manager',
  'cashier',
  'workshop',
  'courier',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

const parseBooleanEnv = (value: string | undefined): boolean =>
  value?.trim().toLowerCase() === 'true';

export const getStaffAccessEnvironment = (
  supabaseConfigured: boolean
): StaffAccessEnvironment => ({
  supabaseConfigured,
  isDevelopment: import.meta.env.DEV,
  allowLocalDemo: parseBooleanEnv(import.meta.env.VITE_ALLOW_LOCAL_DEMO),
});

/**
 * La démonstration locale exige à la fois le développement et son activation
 * explicite. Elle n’est jamais un repli implicite et reste indisponible dans un
 * build de production, qui exige Supabase et une session authentifiée.
 */
export const resolveStaffAccessMode = (
  environment: StaffAccessEnvironment
): StaffAccessMode => {
  if (environment.isDevelopment && environment.allowLocalDemo) return 'explicit-local-demo';
  if (environment.supabaseConfigured) return 'supabase-required';
  return 'configuration-required';
};

/**
 * Le stockage local peut rester disponible pour l’ERP sans jamais faire passer
 * la console éditeur en démonstration lorsqu’un projet Supabase est configuré.
 * Les deux espaces conservent ainsi leurs sources et leurs données distinctes.
 */
export const resolvePlatformAdminAccessMode = (
  environment: StaffAccessEnvironment
): StaffAccessMode => {
  if (environment.supabaseConfigured) return 'supabase-required';
  return resolveStaffAccessMode(environment);
};

export const isStaffRole = (value: string): value is StaffRole =>
  (STAFF_ROLES as readonly string[]).includes(value);

export const getActiveStaffMemberships = (
  memberships: readonly RemoteMembership[]
): RemoteMembership[] =>
  memberships.filter(
    (membership) => membership.status === 'active' && isStaffRole(membership.role)
  );

export const hasActiveStaffMembership = (
  memberships: readonly RemoteMembership[]
): boolean => getActiveStaffMemberships(memberships).length > 0;

export const formatStaffRole = (role: string): string => {
  switch (role) {
    case 'organization_owner':
      return 'Propriétaire';
    case 'shop_manager':
      return 'Responsable d’agence';
    case 'cashier':
      return 'Caisse / réception';
    case 'workshop':
      return 'Atelier';
    case 'courier':
      return 'Coursier';
    default:
      return role;
  }
};
