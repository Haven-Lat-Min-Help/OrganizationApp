import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '../context/UserRoleContext';

/**
 * Same path, different page per role: the branch admin gets the branch pages,
 * staff get their own pages, and the org admin keeps the organization pages.
 * Routing only — the backend enforces the real access rules on every call.
 */
export function RoleSwitch({
  branchAdmin,
  staff,
  otherwise,
}: {
  branchAdmin: ReactElement;
  staff: ReactElement;
  otherwise: ReactElement;
}) {
  const role = useUserRole();
  if (role === 'branch_admin') return branchAdmin;
  if (role === 'staff') return staff;
  return otherwise;
}

/** Pages that exist only for an org admin (branch management); anyone else is sent home. */
export function OrgAdminOnly({ children }: { children: ReactElement }) {
  return useUserRole() === 'org_admin' ? children : <Navigate to="/home" replace />;
}

/** Pages that exist only for a branch admin; anyone else is sent home. */
export function BranchAdminOnly({ children }: { children: ReactElement }) {
  return useUserRole() === 'branch_admin' ? children : <Navigate to="/home" replace />;
}
