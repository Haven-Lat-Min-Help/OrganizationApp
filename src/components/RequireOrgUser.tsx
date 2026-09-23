import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { isOrgRole } from '../config/roles';

type Status = 'checking' | 'authorized' | 'unauthorized';

/**
 * Route guard: redirects to /login unless the current session belongs to a
 * profile with an organization role. Re-checks on every mount rather than
 * trusting client state, since role lives in the profiles table (RLS: a
 * user can only read their own row), not in the JWT.
 */
export function RequireOrgUser({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) setStatus('unauthorized');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (cancelled) return;
      setStatus(!error && isOrgRole(profile?.role) ? 'authorized' : 'unauthorized');
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'checking') return null;
  if (status === 'unauthorized') return <Navigate to="/login" replace />;
  return <>{children}</>;
}
