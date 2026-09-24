import { PageHeader, type PageTab } from '../components/layout/PageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Detail } from '../components/ui/Detail';
import { useOrganization } from '../context/OrganizationContext';
import styles from './Home.module.css';

const TABS: PageTab[] = [
  { label: 'Overview', path: '/home' },
  { label: 'Branches' },
  { label: 'Staff' },
  { label: '24/7 shifts' },
  { label: 'Capabilities' },
  { label: 'Documents' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Landing page after login — for now, the signed-in user's own organization
 * details, loaded from GET /organizations/me via OrganizationProvider. Branch
 * cards, staff and the other tabs come later, once the backend has data for
 * them; until then those tabs render disabled.
 */
export function Home() {
  const { organization, error } = useOrganization();

  const location = organization
    ? [organization.city, organization.state, organization.country].filter(Boolean).join(', ')
    : '';

  return (
    <PortalShell
      header={
        <PageHeader
          title={organization?.name ?? 'Your organization'}
          meta={organization ? `Main branch: ${organization.main_branch_name} · ${location}` : undefined}
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
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {!error && !organization && <p className={styles.empty}>Loading…</p>}

      {organization && (
        <>
          <Card title="Organization details" className={styles.card}>
            <div className={styles.grid}>
              <Detail label="Name" value={organization.name} />
              <Detail label="Main branch" value={organization.main_branch_name} />
              <Detail label="Status" value={organization.is_active ? 'Active' : 'Inactive'} />
              <Detail label="Registered on" value={formatDate(organization.created_at)} />
            </div>
          </Card>
          <Card title="Address" className={styles.card}>
            <div className={styles.grid}>
              <Detail label="Address line 1" value={organization.address_line1} />
              <Detail label="Address line 2" value={organization.address_line2} />
              <Detail label="City" value={organization.city} />
              <Detail label="State" value={organization.state} />
              <Detail label="Country" value={organization.country} />
              <Detail label="Pincode" value={organization.pincode} />
            </div>
          </Card>
        </>
      )}
    </PortalShell>
  );
}
