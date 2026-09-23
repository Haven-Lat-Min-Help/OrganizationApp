import type { ReactNode } from 'react';
import { OrgHeader } from './OrgHeader';
import styles from './PortalShell.module.css';

interface PortalShellProps {
  /** Full-width page header band (see PageHeader), rendered under the top bar. */
  header: ReactNode;
  children: ReactNode;
}

/**
 * Shared authenticated-app frame: top bar, page header band, then the content
 * well. Every page behind RequireOrgUser renders through this so the chrome
 * and spacing stay identical as more pages are added.
 */
export function PortalShell({ header, children }: PortalShellProps) {
  return (
    <div className={styles.shell}>
      <OrgHeader />
      {header}
      <main className={styles.content}>{children}</main>
    </div>
  );
}
