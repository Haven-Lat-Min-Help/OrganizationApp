import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../../config/api';
import type { DashboardBranch, OrgDashboard as OrgDashboardData } from '../../types/dashboard';
import { formatDuration } from '../../utils/callFormat';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DailyCallsChart } from './DailyCallsChart';
import styles from './OrgDashboard.module.css';

const NONE = '—';

interface AttentionItem {
  key: string;
  text: string;
  /** Where the org admin (or that branch's admin) can fix it. */
  to?: string;
}

/**
 * What needs doing, most urgent first: coverage gaps (nobody can take a call)
 * before setup gaps (the branch isn't findable or has no admin). Deactivated
 * branches are left out — they take no calls by design.
 */
function attentionItems(branches: DashboardBranch[], uncovered: string[]): AttentionItem[] {
  const active = branches.filter((b) => b.is_active);
  const items: AttentionItem[] = [];

  if (uncovered.length > 0) {
    items.push({ key: 'uncovered', text: `No active staff can take: ${uncovered.join(', ')}` });
  }
  for (const b of active) {
    if (b.active_staff === 0) {
      items.push({ key: `${b.id}-staff`, text: `${b.name} has no active staff`, to: `/branches/${b.id}` });
    } else if (b.on_duty === 0) {
      items.push({ key: `${b.id}-duty`, text: `${b.name} has nobody on duty right now`, to: `/branches/${b.id}` });
    }
  }
  for (const b of active) {
    if (!b.has_admin) {
      items.push({ key: `${b.id}-admin`, text: `${b.name} has no branch admin`, to: `/branches/${b.id}` });
    }
    if (!b.has_location) {
      items.push({
        key: `${b.id}-location`,
        text: `${b.name} has no map location, so it isn't listed in the Haven app`,
        to: `/branches/${b.id}`,
      });
    }
    if (!b.has_phone) {
      items.push({ key: `${b.id}-phone`, text: `${b.name} has no phone number`, to: `/branches/${b.id}` });
    }
    if (b.expired_invites > 0) {
      items.push({
        key: `${b.id}-invites`,
        text: `${b.name}: ${b.expired_invites} staff ${b.expired_invites === 1 ? 'invite has' : 'invites have'} expired`,
        to: `/branches/${b.id}`,
      });
    }
  }
  return items;
}

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/**
 * The org admin's Overview dashboard (GET /organizations/me/dashboard): who is
 * on duty now, the last 30 days of calls that reached the org's staff, what
 * needs attention, the emergency mix and a row per branch. Never anything
 * about callers. On duty is a snapshot — Refresh re-reads it.
 */
export function OrgDashboard() {
  const [data, setData] = useState<OrgDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setData(await apiFetch<OrgDashboardData>('/organizations/me/dashboard'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
    return (
      <Card title="Dashboard" className={styles.card}>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : (
          <p className={styles.empty}>Loading dashboard…</p>
        )}
      </Card>
    );
  }

  const { staff, calls, daily, aid_mix: aidMix, uncovered_aid_types: uncovered, branches } = data;
  const attention = attentionItems(branches, uncovered);
  const topAid = aidMix[0]?.calls ?? 0;

  return (
    <section aria-label="Dashboard" className={styles.dashboard}>
      <div className={styles.toolbar}>
        <span className={styles.updated}>Updated {formatUpdated(data.generated_at)}</span>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <div className={styles.tiles}>
        <StatTile
          label="On duty now"
          value={String(staff.on_duty)}
          caption={`of ${staff.active} active staff`}
        />
        <StatTile
          label="Calls answered"
          value={String(calls.answered)}
          caption={`of ${calls.reached} that reached your staff · 30 days`}
        />
        <StatTile
          label="Average time to answer"
          value={calls.avg_answer_seconds === null ? NONE : formatDuration(calls.avg_answer_seconds)}
          caption="From first ring to pick-up · 30 days"
        />
        <StatTile
          label="Missed calls"
          value={String(calls.missed)}
          caption="Rang your staff, nobody answered in time"
        />
      </div>

      <Card title="Calls in the last 30 days" className={styles.card}>
        {calls.reached === 0 ? (
          <p className={styles.empty}>No calls have reached your staff in the last 30 days.</p>
        ) : (
          <>
            <DailyCallsChart days={daily} />
            <p className={styles.note}>
              Every call rings all matching staff on duty across Haven, so "not answered by your staff" includes calls
              another hospital picked up first and callers who hung up.
              {calls.avg_talk_seconds !== null && ` Average call length: ${formatDuration(calls.avg_talk_seconds)}.`}
              {calls.dropped > 0 && ` ${calls.dropped} answered ${calls.dropped === 1 ? 'call was' : 'calls were'} dropped.`}
            </p>
          </>
        )}
      </Card>

      <div className={styles.pair}>
        <Card title="Needs attention" className={styles.pairCard}>
          {attention.length === 0 ? (
            <p className={styles.allGood}>
              <span className={styles.dotGood} aria-hidden="true" />
              All set — every active branch is covered and fully set up.
            </p>
          ) : (
            <ul className={styles.attention}>
              {attention.map((item) => (
                <li key={item.key} className={styles.attentionItem}>
                  <span className={styles.dotWarn} aria-hidden="true" />
                  {item.to ? (
                    <Link to={item.to} className={styles.attentionLink}>
                      {item.text}
                    </Link>
                  ) : (
                    <span>{item.text}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {(staff.pending_invites > 0 || staff.expired_invites > 0) && (
            <p className={styles.note}>
              Staff invites: {staff.pending_invites} pending, {staff.expired_invites} expired.
            </p>
          )}
        </Card>

        <Card title="Emergencies · 30 days" className={styles.pairCard}>
          {aidMix.length === 0 ? (
            <p className={styles.empty}>No calls yet.</p>
          ) : (
            <>
              <dl className={styles.mix}>
                {aidMix.map((row) => (
                  <div key={row.name} className={styles.mixRow}>
                    <dt className={styles.mixLabel}>{row.name}</dt>
                    <dd className={styles.mixBarCell}>
                      <span className={styles.mixTrack}>
                        <span className={styles.mixBar} style={{ width: `${(row.calls / topAid) * 100}%` }} />
                      </span>
                      <span className={styles.mixValue}>{row.calls}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className={styles.note}>A call with two emergencies counts once for each.</p>
            </>
          )}
        </Card>
      </div>

      <Card title="Branches" className={styles.card}>
        {branches.length === 0 ? (
          <p className={styles.empty}>
            No branches yet. <Link to="/branches/new">Add your first branch</Link>.
          </p>
        ) : (
          <div className={styles.scroll} role="region" aria-label="Branches" tabIndex={0}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Branch</th>
                  <th scope="col" className={styles.num}>Active staff</th>
                  <th scope="col" className={styles.num}>On duty now</th>
                  <th scope="col" className={styles.num}>Invites pending</th>
                  <th scope="col" className={styles.num}>Answered · 30 days</th>
                  <th scope="col" className={styles.num}>Avg. time to answer</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id} className={b.is_active ? undefined : styles.inactiveRow}>
                    <td>
                      <Link to={`/branches/${b.id}`} className={styles.branchLink}>
                        {b.name}
                      </Link>
                      {!b.is_active && <span className={styles.tag}>Inactive</span>}
                    </td>
                    <td className={styles.num}>{b.active_staff}</td>
                    <td className={styles.num}>{b.on_duty}</td>
                    <td className={styles.num}>{b.pending_invites}</td>
                    <td className={styles.num}>{b.answered}</td>
                    <td className={styles.num}>
                      {b.avg_answer_seconds === null ? NONE : formatDuration(b.avg_answer_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

function StatTile({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileCaption}>{caption}</span>
    </div>
  );
}
