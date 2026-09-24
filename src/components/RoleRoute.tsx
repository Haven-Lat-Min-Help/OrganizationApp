import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '../context/UserRoleContext';

/**
 * Same path, different page per role: the branch admin gets the branch pages,
 * every other org role keeps the existing organization pages. Routing only —
 * the backend enforces the real access rules on every call.
 */
export function RoleSwitch({ branchAdmin, otherwise }: { branchAdmin: ReactElement; otherwise: ReactElement }) {
  return useUserRole() === 'branch_admin' ? branchAdmin : otherwise;
}

/** Pages that exist only for an org admin (branch management); anyone else is sent home. */
export function OrgAdminOnly({ children }: { children: ReactElement }) {
  return useUserRole() === 'org_admin' ? children : <Navigate to="/home" replace />;
}

/** Pages that exist only for a branch admin; anyone else is sent home. */
export function BranchAdminOnly({ children }: { children: ReactElement }) {
  return useUserRole() === 'branch_admin' ? children : <Navigate to="/home" replace />;
}
