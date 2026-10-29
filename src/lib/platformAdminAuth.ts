/** Route dédiée à l'éditeur de PressingPro CI, volontairement hors ERP tenant. */
export const PLATFORM_ADMIN_PATH = '/administration';

export const isPlatformAdminPath = (pathname: string): boolean => {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return normalized === PLATFORM_ADMIN_PATH;
};
