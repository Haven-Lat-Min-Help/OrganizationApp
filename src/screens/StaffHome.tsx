import { useEffect, useState } from 'react';
import { DutyCard } from '../components/calls/DutyCard';
import { PortalShell } from '../components/layout/PortalShell';
import { CallStatsCard } from '../components/staff/CallStatsCard';
import { StaffPageHeader } from '../components/staff/StaffPageHeader';
import { Card } from '../components/ui/Card';
import { Detail } from '../components/ui/Detail';
import { apiFetch } from '../config/api';
import { useBranch } from '../context/BranchContext';
import type { StaffMember } from '../types/staff';
import styles from './Home.module.css';

/**
 * Landing page (Overview) for a staff member: their branch beside the
 * on/off-duty switch for taking calls (DutyCard; rings themselves appear on any
 * page), then how many of the calls that rang for them they answered
 * (CallStatsCard). Their own details are on Profile; the answered calls
 * themselves on Call details.
 */
export function StaffHome() {
  const { branch } = useBranch();
  const [name, setName] = useState<string | null>(null);

  // Only for the greeting: a failure here just leaves the title as "Overview"
  // rather than blocking a page whose job is taking calls.
  useEffect(() => {
    let cancelled = false;

    apiFetch<{ staff: StaffMember }>('/staff/me')
      .then((data) => {
        if (!cancelled) setName(data.staff.name);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PortalShell
      header={
        <StaffPageHeader
          title={name ? `Welcome, ${name}` : 'Overview'}
          meta={branch ? `${branch.name} · ${branch.org_name}` : undefined}
        />
      }
    >
      <div className={styles.row}>
        <Card title="Your branch">
          {branch ? (
            <div className={styles.grid}>
              <Detail label="Branch" value={branch.name} />
              <Detail label="Organization" value={branch.org_name} />
              <Detail label="City" value={branch.city} />
              <Detail label="State" value={branch.state} />
            </div>
          ) : (
            <p className={styles.empty}>Loading…</p>
          )}
        </Card>

        {/* Independent of everything else on the page: taking calls must not wait on any of it. */}
        <DutyCard />
      </div>

      <CallStatsCard className={styles.card} />
    </PortalShell>
  );
}
