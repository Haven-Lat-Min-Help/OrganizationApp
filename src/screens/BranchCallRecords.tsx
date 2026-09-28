import { useCallback, useEffect, useState } from 'react';
import { BranchPageHeader } from '../components/branches/BranchPageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { apiFetch, ApiError } from '../config/api';
import { useBranch } from '../context/BranchContext';
import type { BranchCall, BranchCallsCursor, BranchCallsPage } from '../types/calls';
import { formatDuration, formatRangAt } from '../utils/callFormat';
// Same table as the staff member's own call details, plus a Staff column.
import styles from './StaffCalls.module.css';

/**
 * Staff-Call Record for a branch admin: every call their branch answered,
 * newest first, 20 at a time — who answered, when it rang, how long it lasted
 * and what the emergency was. Never who called. Call records are kept for 30
 * days, so older ones are gone.
 */
export function BranchCallRecords() {
  const { branch } = useBranch();
  const [calls, setCalls] = useState<BranchCall[] | null>(null);
  const [nextCursor, setNextCursor] = useState<BranchCallsCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (cursor: BranchCallsCursor | null) => {
    const query = cursor ? `?${new URLSearchParams({ before: cursor.before, before_id: cursor.before_id })}` : '';
    return apiFetch<BranchCallsPage>(`/staff/calls${query}`);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadPage(null)
      .then((page) => {
        if (cancelled) return;
        setCalls(page.calls);
        setNextCursor(page.next_cursor);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      });

    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await loadPage(nextCursor);
      setCalls((prev) => [...(prev ?? []), ...page.calls]);
      setNextCursor(page.next_cursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <PortalShell header={<BranchPageHeader title="Staff-Call Record" meta={branch?.name} />}>
      <Card title="Calls your branch answered">
        {calls === null && !error && <p className={styles.empty}>Loading…</p>}

        {calls !== null && calls.length === 0 && (
          <p className={styles.empty}>Your branch hasn't answered any calls in the last 30 days.</p>
        )}

        {calls !== null && calls.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Rang at</th>
                  <th scope="col">Staff</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Emergency</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.id}>
                    <td className={styles.when}>{formatRangAt(call.rang_at)}</td>
                    <td>
                      {call.staff_name ?? (
                        // The staff member's account has since been deleted.
                        <span className={styles.muted}>Former staff</span>
                      )}
                    </td>
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

        {nextCursor && (
          <div className={styles.more}>
            <Button variant="secondary" onClick={() => void handleLoadMore()} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}

        <p className={styles.hint}>
          Only answered calls are listed. Call records are kept for 30 days. Caller details are never shown.
        </p>
      </Card>
    </PortalShell>
  );
}
