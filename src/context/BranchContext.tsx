import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, ApiError } from '../config/api';
import type { Branch } from '../types/branch';
import { useUserRole } from './UserRoleContext';

interface BranchState {
  /** null while loading, and also when the request failed (see `error`). */
  branch: Branch | null;
  error: string | null;
}

interface BranchContextValue extends BranchState {
  /** Swap in the branch a successful PATCH returned, so every screen and the top bar see the edit. */
  replaceBranch: (branch: Branch) => void;
}

const BranchContext = createContext<BranchContextValue | null>(null);

/**
 * Loads the signed-in branch admin's or staff member's own branch once
 * (GET /branches, which the backend narrows to the branch on the caller's
 * profile) and shares it with their screens and the top bar. The browser never
 * says which branch — same idea as OrganizationProvider.
 */
export function BranchProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BranchState>({ branch: null, error: null });

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ branches: Branch[] }>('/branches')
      .then((data) => {
        if (cancelled) return;
        const branch = data.branches[0] ?? null;
        setState({ branch, error: branch ? null : 'No branch is assigned to your account' });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            branch: null,
            error: err instanceof ApiError ? err.message : 'Something went wrong, please try again',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const replaceBranch = useCallback((branch: Branch) => setState({ branch, error: null }), []);
  const value = useMemo(() => ({ ...state, replaceBranch }), [state, replaceBranch]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

/** Only usable on branch-admin and staff screens, inside <BranchProvider>. */
export function useBranch(): BranchContextValue {
  const context = useContext(BranchContext);
  if (!context) throw new Error('useBranch must be used inside <BranchProvider>');
  return context;
}

/**
 * For shared chrome (the top bar) that renders for every role: the branch when
 * inside <BranchProvider>, otherwise null — no throw.
 */
export function useOptionalBranch(): Branch | null {
  return useContext(BranchContext)?.branch ?? null;
}

/**
 * Wraps children in <BranchProvider> for the branch-scoped roles — branch
 * admins and staff, who both belong to exactly one branch (GET /branches
 * returns just that one for either). The org admin never fetches a branch.
 */
export function BranchScope({ children }: { children: ReactNode }) {
  const role = useUserRole();
  return role === 'branch_admin' || role === 'staff' ? (
    <BranchProvider>{children}</BranchProvider>
  ) : (
    <>{children}</>
  );
}
