import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { isOrgRole } from '../config/roles';
import { UserRoleContext } from '../context/UserRoleContext';

type State = { status: 'checking' } | { status: 'unauthorized' } | { status: 'authorized'; role: string };

/**
 * Route guard: redirects to /login unless the current session belongs to a
 * profile with an organization role. Re-checks on every mount rather than
 * trusting client state, since role lives in the profiles table (RLS: a
 * user can only read their own row), not in the JWT. The role it finds is
 * shared through UserRoleContext so screens can show the right pages for an
 * org admin vs a branch admin without a second lookup.
 */
export function RequireOrgUser({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) setState({ status: 'unauthorized' });
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (cancelled) return;
      setState(
        !error && profile && isOrgRole(profile.role)
          ? { status: 'authorized', role: profile.role }
          : { status: 'unauthorized' },
      );
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'checking') return null;
  if (state.status === 'unauthorized') return <Navigate to="/login" replace />;
  return <UserRoleContext.Provider value={state.role}>{children}</UserRoleContext.Provider>;
}
