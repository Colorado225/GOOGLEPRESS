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
 * La démonstration locale est un scénario explicitement choisi, pas le mode
 * implicite d'un build de production. Un build de production sans Supabase
 * affiche une erreur de configuration au lieu d'ouvrir l'ERP.
 */
export const resolveStaffAccessMode = (
  environment: StaffAccessEnvironment
): StaffAccessMode => {
  if (environment.allowLocalDemo) return 'explicit-local-demo';
  if (environment.supabaseConfigured) return 'supabase-required';
  return environment.isDevelopment ? 'explicit-local-demo' : 'configuration-required';
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
