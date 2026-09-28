import type { ReactNode } from 'react';
import { CallProvider } from '../../context/CallContext';
import { useUserRole } from '../../context/UserRoleContext';
import { CallDock } from './CallDock';

/**
 * Staff only: connects to the calling server and shows the call dock (rings,
 * the call in progress) over every staff page. Other roles never open a
 * socket — the server would refuse them anyway.
 */
export function CallScope({ children }: { children: ReactNode }) {
  const role = useUserRole();
  if (role !== 'staff') return <>{children}</>;

  return (
    <CallProvider>
      {children}
      <CallDock />
    </CallProvider>
  );
}
