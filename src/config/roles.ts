/**
 * Roles allowed into this app. Mirrors the invite-only org roles in the
 * profiles.role check constraint (see Backend/supabase/migrations) — patients
 * and super_admins belong to other apps and are turned away at login and by
 * the route guard.
 */
const ORG_ROLES = ['org_admin', 'branch_admin', 'staff'];

export function isOrgRole(role: string | null | undefined): boolean {
  return role != null && ORG_ROLES.includes(role);
}
