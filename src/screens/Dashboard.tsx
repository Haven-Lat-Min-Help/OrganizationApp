import { OrgDashboard } from '../components/dashboard/OrgDashboard';
import { PageHeader } from '../components/layout/PageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { ORG_TABS } from '../config/orgTabs';
import { useOrganization } from '../context/OrganizationContext';

/**
 * The org admin's Dashboard tab: duty, calls, what needs attention and a row
 * per branch (OrgDashboard). The organization's own details live on Overview.
 */
export function Dashboard() {
  const { organization } = useOrganization();

  return (
    <PortalShell
      header={
        <PageHeader
          title="Dashboard"
          meta={organization ? `${organization.name} · All branches` : undefined}
          tabs={ORG_TABS}
        />
      }
    >
      <OrgDashboard />
    </PortalShell>
  );
}
