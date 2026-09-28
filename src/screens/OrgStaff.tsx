import { useEffect, useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { OrgStaffTable } from '../components/staff/OrgStaffTable';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { apiFetch, ApiError } from '../config/api';
import { ORG_TABS } from '../config/orgTabs';
import { useOrganization } from '../context/OrganizationContext';
import type { OrgStaffPage } from '../types/staff';
import homeStyles from './Home.module.css';
import styles from './OrgStaff.module.css';

/**
 * Every staff member of the org admin's organization (GET
 * /organizations/me/staff) — pending, expired and active, across all
 * branches, 10 per page, with the branch each belongs to. Read-only: adding
 * and editing staff is the branch admin's job. The request carries no org
 * id: the backend takes it from the caller's profile.
 */
export function OrgStaff() {
  const { organization } = useOrganization();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OrgStaffPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // The previous page stays on screen until the next arrives, so the table doesn't jump.
    apiFetch<OrgStaffPage>(`/organizations/me/staff?page=${page}`)
      .then((result) => {
        if (cancelled) return;
        const lastPage = Math.max(1, Math.ceil(result.total / result.page_size));
        // Staff removed since the last page was counted: step back to the real last page.
        if (result.staff.length === 0 && page > lastPage) {
          setPage(lastPage);
          return;
        }
        setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  const lastPage = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const firstShown = data ? (data.page - 1) * data.page_size + 1 : 0;
  const lastShown = data ? firstShown + data.staff.length - 1 : 0;

  function renderBody() {
    if (error && !data) return <p className={homeStyles.error}>{error}</p>;
    if (!data) return <p className={homeStyles.empty}>Loading staff…</p>;
    if (data.total === 0) {
      return (
        <p className={homeStyles.empty}>
          No staff yet. Staff that your branch admins add will appear here.
        </p>
      );
    }

    return (
      <>
        {error && (
          <p role="alert" className={homeStyles.error}>
            {error}
          </p>
        )}
        <OrgStaffTable staff={data.staff} />
        <nav className={styles.pager} aria-label="Staff pages">
          <span className={styles.range} aria-live="polite">
            {firstShown}–{lastShown} of {data.total}
          </span>
          <div className={styles.pagerButtons}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={loading || page <= 1}
            >
              Previous
            </Button>
            <span className={styles.pageOf}>
              Page {page} of {lastPage}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={loading || page >= lastPage}
            >
              Next
            </Button>
          </div>
        </nav>
      </>
    );
  }

  return (
    <PortalShell
      header={
        <PageHeader
          title="Staff"
          meta={organization ? `All branches · ${organization.name}` : undefined}
          tabs={ORG_TABS}
        />
      }
    >
      <Card title="All staff" className={homeStyles.card}>
        {renderBody()}
      </Card>
    </PortalShell>
  );
}
