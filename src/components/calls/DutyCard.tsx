import { useCalls } from '../../context/CallContext';
import { notificationsBlocked } from '../../utils/callAlerts';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import styles from './DutyCard.module.css';

/**
 * The staff member's on/off switch for taking calls. Going on duty has to be
 * a click (not automatic on page load) — the browser only allows the ring to
 * play after one; see utils/ringtone.ts.
 */
export function DutyCard({ className }: { className?: string }) {
  const { connection, fatalError, wantOnDuty, onDuty, dutyPending, dutyError, activeCall, goOnDuty, goOffDuty } =
    useCalls();

  const connected = connection === 'connected';
  const status = fatalError
    ? { label: 'Unavailable', tone: styles.off }
    : !connected
      ? { label: wantOnDuty ? 'Reconnecting…' : 'Connecting…', tone: styles.waiting }
      : onDuty
        ? { label: activeCall ? 'On a call' : 'On duty', tone: styles.on }
        : { label: 'Off duty', tone: styles.off };

  return (
    <Card
      title="Emergency calls"
      className={className}
      action={
        <span className={`${styles.status} ${status.tone}`}>
          <span className={styles.dot} aria-hidden="true" />
          {status.label}
        </span>
      }
    >
      <p className={styles.text}>
        {onDuty
          ? 'People who need help with an aid type you treat can call you now. Keep this tab open: closing it takes you off duty.'
          : 'Go on duty to take calls from people who need help with the aid types you treat. You will hear a ring and see their emergency type, never who they are.'}
      </p>

      {!connected && wantOnDuty && !fatalError && (
        <p className={styles.hint}>Your connection dropped. You'll be back on duty as soon as it returns.</p>
      )}

      {onDuty && notificationsBlocked() && (
        <p className={styles.hint}>
          Notifications are blocked for this site, so you will only hear calls. Allow notifications in your
          browser to be alerted while working in another tab.
        </p>
      )}

      {(fatalError || dutyError) && (
        <p role="alert" className={styles.error}>
          {fatalError ?? dutyError}
        </p>
      )}

      <div className={styles.actions}>
        {onDuty ? (
          <Button variant="secondary" onClick={() => void goOffDuty()} disabled={dutyPending}>
            {dutyPending ? 'Updating…' : 'Go off duty'}
          </Button>
        ) : (
          <Button onClick={() => void goOnDuty()} disabled={dutyPending || !connected || fatalError !== null}>
            {dutyPending ? 'Going on duty…' : 'Go on duty'}
          </Button>
        )}
      </div>
    </Card>
  );
}
