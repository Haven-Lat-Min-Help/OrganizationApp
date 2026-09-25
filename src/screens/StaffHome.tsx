import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PortalShell } from '../components/layout/PortalShell';
import { StaffPageHeader } from '../components/staff/StaffPageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Detail } from '../components/ui/Detail';
import { apiFetch, ApiError } from '../config/api';
import { useBranch } from '../context/BranchContext';
import type { StaffMember } from '../types/staff';
import { formatDate } from '../utils/formatDate';
import styles from './Home.module.css';

/**
 * Landing page (Overview) for a staff member: their own details and aid types
 * (GET /staff/me — the backend takes who they are from the token) and the
 * branch they belong to (BranchProvider). Read-only here: name and phone are
 * edited on Profile, aid types only by the branch admin. Staff reach nothing
 * else — every other page is guarded for another role.
 */
export function StaffHome() {
  const navigate = useNavigate();
  const { branch } = useBranch();
  const [me, setMe] = useState<StaffMember | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ staff: StaffMember }>('/staff/me')
      .then((data) => {
        if (!cancelled) setMe(data.staff);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PortalShell
      header={
        <StaffPageHeader
          title={me ? `Welcome, ${me.name}` : 'Overview'}
          meta={branch ? `${branch.name} · ${branch.org_name}` : undefined}
          actions={
            <Button variant="secondary" size="sm" onClick={() => navigate('/profile')}>
              Edit profile
            </Button>
          }
        />
      }
    >
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {!error && !me && <p className={styles.empty}>Loading…</p>}

      {me && (
        <>
          <Card title="Your details" className={styles.card}>
            <div className={styles.grid}>
              <Detail label="Name" value={me.name} />
              <Detail label="Email" value={me.email} />
              <Detail label="Phone" value={me.phone} />
              <Detail label="Joined on" value={formatDate(me.created_at)} />
            </div>
          </Card>

          <Card title="Aid types you can treat" className={styles.card}>
            {me.aid_types.length > 0 ? (
              <ul className={styles.chips}>
                {me.aid_types.map((aidType) => (
                  <li key={aidType.id} className={styles.chip}>
                    {aidType.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No aid types set.</p>
            )}
            <p className={styles.hint}>Your branch admin manages this list.</p>
          </Card>

          {branch && (
            <Card title="Your branch" className={styles.card}>
              <div className={styles.grid}>
                <Detail label="Branch" value={branch.name} />
                <Detail label="Organization" value={branch.org_name} />
                <Detail label="City" value={branch.city} />
                <Detail label="State" value={branch.state} />
              </div>
            </Card>
          )}
        </>
      )}
    </PortalShell>
  );
}
