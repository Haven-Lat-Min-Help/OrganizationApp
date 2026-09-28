import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Detail } from '../components/ui/Detail';
import { ORG_TABS } from '../config/orgTabs';
import { useOrganization } from '../context/OrganizationContext';
import { formatDate } from '../utils/formatDate';
import styles from './Home.module.css';

/**
 * The org admin's Overview: the organization's own details, loaded from
 * GET /organizations/me via OrganizationProvider. The numbers live on the
 * Dashboard tab.
 */
export function Home() {
  const { organization, error } = useOrganization();
  const navigate = useNavigate();

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
              
              <Button variant="dark" size="sm" onClick={() => navigate('/branches/new')}>
                + Add branch
              </Button>
            </>
          }
          tabs={ORG_TABS}
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
