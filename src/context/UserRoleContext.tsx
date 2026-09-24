import { createContext, useContext } from 'react';

/**
 * The signed-in user's profiles.role, read once by RequireOrgUser and shared
 * with everything behind it. Only meaningful inside the auth guard — it is
 * display/routing state, not a security boundary: every Backend endpoint
 * re-checks the role from the profiles table itself.
 */
export const UserRoleContext = createContext<string | null>(null);

export function useUserRole(): string {
  const role = useContext(UserRoleContext);
  if (!role) throw new Error('useUserRole must be used inside <RequireOrgUser>');
  return role;
}
