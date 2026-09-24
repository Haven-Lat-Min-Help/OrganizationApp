import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, ApiError } from '../config/api';

// Mirrors MY_ORGANIZATION_COLUMNS in Backend/src/controllers/organizationController.ts.
export interface Organization {
  id: string;
  name: string;
  main_branch_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  is_active: boolean;
  created_at: string;
}

interface OrganizationState {
  /** null while loading, and also when the request failed (see `error`). */
  organization: Organization | null;
  error: string | null;
}

const OrganizationContext = createContext<OrganizationState | null>(null);

/**
 * Loads the signed-in user's own organization once (GET /organizations/me)
 * and shares it with every screen behind the auth guard, so the top bar and
 * the pages read the same data without each refetching it. The browser never
 * says which org — the backend derives it from the user's profile.
 */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OrganizationState>({ organization: null, error: null });

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ organization: Organization }>('/organizations/me')
      .then((data) => {
        if (!cancelled) setState({ organization: data.organization, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            organization: null,
            error: err instanceof ApiError ? err.message : 'Something went wrong, please try again',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <OrganizationContext.Provider value={state}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationState {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useOrganization must be used inside <OrganizationProvider>');
  return context;
}
