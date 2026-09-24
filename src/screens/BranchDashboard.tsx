import { BranchPageHeader } from '../components/branches/BranchPageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Card } from '../components/ui/Card';
import { useBranch } from '../context/BranchContext';
import styles from './Home.module.css';

/**
 * Dashboard for the branch admin's branch. Nothing to chart yet — the backend
 * has no staff, shift or request data — so this is the page shell with an
 * honest empty state rather than made-up numbers.
 */
export function BranchDashboard() {
  const { branch } = useBranch();

  return (
    <PortalShell header={<BranchPageHeader title="Dashboard" meta={branch?.name} />}>
      <Card title="Branch activity" className={styles.card}>
        <p className={styles.empty}>Activity for this branch will appear here once staff and shifts are set up.</p>
      </Card>
    </PortalShell>
  );
}
