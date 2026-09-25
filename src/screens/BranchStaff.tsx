import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BranchPageHeader } from '../components/branches/BranchPageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { StaffTable } from '../components/staff/StaffTable';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { apiFetch, ApiError } from '../config/api';
import { useBranch } from '../context/BranchContext';
import type { StaffMember, StaffNotice } from '../types/staff';
import styles from './Home.module.css';

interface StaffState {
  /** null = not loaded yet (or the request failed, see `error`); [] = loaded, no staff. */
  staff: StaffMember[] | null;
  error: string | null;
}

/**
 * Staff of the branch admin's branch (GET /staff) — pending, expired and
 * active. The request carries no branch id: the backend takes it from the
 * caller's profile, so the browser can never ask for another branch's staff.
 */
export function BranchStaff() {
  const { branch } = useBranch();
  const navigate = useNavigate();
  // Set by AddStaff after an invite: "sent", or "added but the email failed".
  const notice = (useLocation().state as { notice?: StaffNotice } | null)?.notice ?? null;
  const [state, setState] = useState<StaffState>({ staff: null, error: null });

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ staff: StaffMember[] }>('/staff')
      .then((data) => {
        if (!cancelled) setState({ staff: data.staff, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            staff: null,
            error: err instanceof ApiError ? err.message : 'Something went wrong, please try again',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PortalShell
      header={
        <BranchPageHeader
          title="Staff"
          meta={branch?.name}
          actions={
            <Button variant="dark" size="sm" onClick={() => navigate('/staff/new')}>
              + Add staff
            </Button>
          }
        />
      }
    >
      {notice && (
        <p role="status" className={notice.warn ? styles.error : styles.success}>
          {notice.text}
        </p>
      )}
      <Card title="Branch staff" className={styles.card}>
        <StaffListBody {...state} />
      </Card>
    </PortalShell>
  );
}

/** The four states, in the order they're checked: failed, loading, empty, rows. */
function StaffListBody({ staff, error }: StaffState) {
  if (error) return <p className={styles.error}>{error}</p>;
  if (staff === null) return <p className={styles.empty}>Loading staff…</p>;
  if (staff.length === 0) {
    return <p className={styles.empty}>No staff yet. Staff you add to this branch will appear here.</p>;
  }

  return <StaffTable staff={staff} />;
}
