/**
 * Permisos de usuario que el backend puede entregar en `GET /v1/me`
 * (tabla «Permisos» de `docs/backend/contexto-para-frontend.md`). Los permisos de
 * sistema nunca llegan al frontend. Un test compara esta lista con esa tabla.
 */
export const PERMISSIONS = [
  'property.read',
  'property.create',
  'property.update',
  'mandate.create',
  'mandate.update',
  'mandate.terminate',
  'mandate.terminate_any',
  'media.manage',
  'document.manage',
  'document.read_support',
  'agency.read',
  'agency.list',
  'agency.update',
  'agency.resubmit',
  'agency.approve',
  'agency.request_changes',
  'agency.reject',
  'member.invite',
  'member.update_role',
  'member.read',
  'member.terminate',
  'member.terminate_any',
  'tenant_config.read',
  'tenant_config.publish',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Alcance de un permiso, de menor a mayor: `own` < `agency` < `network`. */
export type Scope = 'own' | 'agency' | 'network';
