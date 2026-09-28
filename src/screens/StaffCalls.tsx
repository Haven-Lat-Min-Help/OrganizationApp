import { useCallback, useEffect, useState } from 'react';
import { PortalShell } from '../components/layout/PortalShell';
import { StaffPageHeader } from '../components/staff/StaffPageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { apiFetch, ApiError } from '../config/api';
import { useBranch } from '../context/BranchContext';
import type { AnsweredCall, AnsweredCallsPage } from '../types/calls';
import { formatDuration, formatRangAt } from '../utils/callFormat';
import styles from './StaffCalls.module.css';

/**
 * Call details for a staff member: the calls they answered, newest first, 20
 * at a time — when each rang, how long it lasted and what the emergency was.
 * Never who called. Call records are kept for 30 days, so older ones are gone.
 */
export function StaffCalls() {
  const { branch } = useBranch();
  const [calls, setCalls] = useState<AnsweredCall[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (before: string | null) => {
    const query = before ? `?before=${encodeURIComponent(before)}` : '';
    return apiFetch<AnsweredCallsPage>(`/staff/me/calls${query}`);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadPage(null)
      .then((page) => {
        if (cancelled) return;
        setCalls(page.calls);
        setNextBefore(page.next_before);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      });

    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  async function handleLoadMore() {
    if (!nextBefore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await loadPage(nextBefore);
      setCalls((prev) => [...(prev ?? []), ...page.calls]);
      setNextBefore(page.next_before);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <PortalShell
      header={
        <StaffPageHeader
          title="Call details"
          meta={branch ? `${branch.name} · ${branch.org_name}` : undefined}
        />
      }
    >
      <Card title="Calls you answered">
        {calls === null && !error && <p className={styles.empty}>Loading…</p>}

        {calls !== null && calls.length === 0 && (
          <p className={styles.empty}>You haven't answered any calls in the last 30 days.</p>
        )}

        {calls !== null && calls.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Rang at</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Emergency</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id}>
                    <td className={styles.when}>{formatRangAt(call.rang_at)}</td>
                    <td className={styles.duration}>
                      {call.duration_seconds === null ? (
                        <span className={`${styles.tag} ${styles.tagLive}`}>On call now</span>
                      ) : (
                        <>
                          {formatDuration(call.duration_seconds)}
                          {call.status === 'dropped' && (
                            <span className={styles.tag} title="The connection was lost before the call was ended">
                              Dropped
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      {call.aid_type_names.length > 0 ? (
                        <ul className={styles.chips}>
                          {call.aid_type_names.map((name) => (
                            <li key={name} className={styles.chip}>
                              {name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        // The aid type has since been removed from Haven.
                        <span className={styles.muted}>Not recorded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        {nextBefore && (
          <div className={styles.more}>
            <Button variant="secondary" onClick={() => void handleLoadMore()} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}

        <p className={styles.hint}>Call records are kept for 30 days. You never see who called.</p>
      </Card>
    </PortalShell>
  );
}
