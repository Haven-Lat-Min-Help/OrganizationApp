import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddBranchCard } from '../components/branches/AddBranchCard';
import { BranchCard } from '../components/branches/BranchCard';
import { PageHeader } from '../components/layout/PageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Button } from '../components/ui/Button';
import { apiFetch, ApiError } from '../config/api';
import { ORG_TABS } from '../config/orgTabs';
import { useOrganization } from '../context/OrganizationContext';
import { useHospitalTypes } from '../hooks/useHospitalTypes';
import type { Branch } from '../types/branch';
import styles from './Branches.module.css';

/**
 * Org admin's branches tab — every branch in their organization as a card grid,
 * loaded from GET /branches (the backend scopes it to the caller's org), with a
 * tile and a header button that lead to the add-branch form. Hospital-type
 * names come from the type catalogue; a branch itself only carries ids.
 */
export function Branches() {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { hospitalTypes } = useHospitalTypes();
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ branches: Branch[] }>('/branches')
      .then((data) => {
        if (!cancelled) setBranches(data.branches);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const typeNames = useMemo(() => new Map(hospitalTypes.map((type) => [type.id, type.name])), [hospitalTypes]);

  return (
    <PortalShell
      header={
        <PageHeader
          title={organization?.name ?? 'Your organization'}
          meta={branches ? `${branches.length} ${branches.length === 1 ? 'branch' : 'branches'}` : undefined}
          actions={
            <Button variant="dark" size="sm" onClick={() => navigate('/branches/new')}>
              + Add branch
            </Button>
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
      {!error && !branches && <p className={styles.empty}>Loading…</p>}

      {branches && (
        <div className={styles.grid}>
          {branches.map((branch) => (
            <BranchCard key={branch.id} branch={branch} typeNames={typeNames} />
          ))}
          <AddBranchCard />
        </div>
      )}
    </PortalShell>
  );
}
