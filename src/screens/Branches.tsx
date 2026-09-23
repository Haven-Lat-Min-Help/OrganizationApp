import { AddBranchCard } from '../components/branches/AddBranchCard';
import { BranchCard } from '../components/branches/BranchCard';
import { PageHeader, type PageTab } from '../components/layout/PageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Button } from '../components/ui/Button';
import { branches, organization } from '../data/mockBranches';
import styles from './Branches.module.css';

const TABS: PageTab[] = [
  { label: 'Branches', path: '/branches' },
  { label: 'Staff' },
  { label: '24/7 shifts' },
  { label: 'Capabilities' },
  { label: 'Documents' },
];

/**
 * Organization landing page — the org's branches as a card grid. Branches and
 * the org summary currently read from src/data/mockBranches.ts (flagged as
 * placeholder there): Backend has no org-scoped branch endpoints yet, so this
 * UI is built ahead of that API. Swapping the mock import for a real fetch is
 * the only change needed once those endpoints exist. The header actions and
 * per-card actions aren't wired to flows yet.
 */
export function Branches() {
  return (
    <PortalShell
      header={
        <PageHeader
          title={organization.name}
          meta={
            <>
              {organization.branchCount} branches · {organization.responderCount} responders · Verified{' '}
              {organization.verifiedOn} · Reg. no. <strong>{organization.registrationNumber}</strong>
            </>
          }
          actions={
            <>
              <Button variant="secondary" size="sm">
                Bulk import staff
              </Button>
              <Button variant="dark" size="sm">
                + Add branch or staff
              </Button>
            </>
          }
          tabs={TABS}
        />
      }
    >
      <div className={styles.grid}>
        {branches.map((branch) => (
          <BranchCard key={branch.id} branch={branch} />
        ))}
        <AddBranchCard />
      </div>
    </PortalShell>
  );
}
