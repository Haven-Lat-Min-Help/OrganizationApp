import { BranchPageHeader } from '../components/branches/BranchPageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Card } from '../components/ui/Card';
import { useBranch } from '../context/BranchContext';
import styles from './Home.module.css';

/**
 * Staff of the branch admin's branch. The backend has no staff endpoints or
 * staff invite flow yet, so this is the page shell with an honest empty
 * state — no invented rows. The list and the Add staff button get wired up
 * once staff can be invited.
 */
export function BranchStaff() {
  const { branch } = useBranch();

  return (
    <PortalShell header={<BranchPageHeader title="Staff" meta={branch?.name} />}>
      <Card title="Branch staff" className={styles.card}>
        <p className={styles.empty}>No staff yet. Staff you add to this branch will appear here.</p>
      </Card>
    </PortalShell>
  );
}
