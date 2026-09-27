import { BranchLocationCard } from '../components/branches/BranchLocationCard';
import { BranchPageHeader } from '../components/branches/BranchPageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Card } from '../components/ui/Card';
import { Detail } from '../components/ui/Detail';
import { useBranch } from '../context/BranchContext';
import { formatDate } from '../utils/formatDate';
import styles from './Home.module.css';

/**
 * Landing page for a branch admin — the branch they run, loaded from
 * GET /branches via BranchProvider. Same layout as the organization Home,
 * scoped to one branch.
 */
export function BranchHome() {
  const { branch, error } = useBranch();

  const location = branch ? [branch.city, branch.state, branch.country].filter(Boolean).join(', ') : '';

  return (
    <PortalShell
      header={
        <BranchPageHeader
          title={branch?.name ?? 'Your branch'}
          meta={branch ? `${branch.org_name} · ${location}` : undefined}
        />
      }
    >
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {!error && !branch && <p className={styles.empty}>Loading…</p>}

      {branch && (
        <>
          <Card title="Branch details" className={styles.card}>
            <div className={styles.grid}>
              <Detail label="Branch name" value={branch.name} />
              <Detail label="Organization" value={branch.org_name} />
              <Detail label="Status" value={branch.is_active ? 'Active' : 'Inactive'} />
              <Detail label="Registered on" value={formatDate(branch.created_at)} />
            </div>
          </Card>
          <Card title="Address" className={styles.card}>
            <div className={styles.grid}>
              <Detail label="Address line 1" value={branch.address_line1} />
              <Detail label="Address line 2" value={branch.address_line2} />
              <Detail label="City" value={branch.city} />
              <Detail label="State" value={branch.state} />
              <Detail label="Country" value={branch.country} />
              <Detail label="Pincode" value={branch.pincode} />
            </div>
          </Card>
          <BranchLocationCard branch={branch} />
        </>
      )}
    </PortalShell>
  );
}
