import { useEffect, useRef, useState } from 'react';
import { useCalls } from '../../context/CallContext';
import type { ActiveCall, EndStatus, EndedCall, Ring } from '../../types/call';
import { Button } from '../ui/Button';
import { BlockCallerForm } from './BlockCallerForm';
import styles from './CallDock.module.css';

const ENDED_MESSAGES: Record<EndStatus, string> = {
  completed: 'The call has ended.',
  dropped: 'The call dropped: the connection was lost.',
  cancelled: 'The caller hung up.',
  missed: 'The call was missed.',
};

/**
 * Call UI over every staff page: incoming rings in a centered dialog over the
 * blurred page, and — in a floating dock — the call in progress and short
 * notices. Lives in CallScope rather than on one page, so a call can ring or
 * continue while the staff member is on Profile.
 */
export function CallDock() {
  const { rings, activeCall, lastEnded, notice, dismissNotice } = useCalls();

  const showDock = notice || activeCall || (lastEnded && !activeCall);

  return (
    <>
      {rings.length > 0 && <RingDialog rings={rings} />}

      {showDock && (
        <div className={styles.dock}>
          {notice && (
            <div className={styles.notice} role="status">
              <span>{notice}</span>
              <Button variant="ghost" size="sm" onClick={dismissNotice} aria-label="Dismiss">
                ✕
              </Button>
            </div>
          )}

          {activeCall && <ActiveCallPanel call={activeCall} />}

          {lastEnded && !activeCall && <EndedCallPanel call={lastEnded} />}
        </div>
      )}
    </>
  );
}

/**
 * Rings as a modal <dialog>: the browser puts it in the top layer and makes the
 * page behind it inert (no clicks, no Tab), and ::backdrop blurs the page.
 * Mounted only while something is ringing; it closes itself when the last ring
 * stops (accepted, declined, taken, timed out).
 *
 * Deliberately no way to wave it away: Escape and a backdrop click do nothing,
 * so a stray key can't hide an emergency — Accept or Decline, or it times out.
 * Focus starts on the title, not a button, so a stray Enter can't answer or
 * decline either.
 */
function RingDialog({ rings }: { rings: Ring[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    titleRef.current?.focus();
    return () => dialog.close();
  }, []);

  const title = rings.length > 1 ? `${rings.length} incoming emergency calls` : 'Incoming emergency call';

  return (
    <dialog
      ref={dialogRef}
      className={styles.ringDialog}
      aria-labelledby="ring-dialog-title"
      onCancel={(event) => event.preventDefault()}
    >
      <h2 id="ring-dialog-title" ref={titleRef} tabIndex={-1} className={styles.ringTitle}>
        {title}
      </h2>
      <div className={styles.ringList}>
        {rings.map((ring) => (
          <RingCard key={ring.callId} ring={ring} />
        ))}
      </div>
    </dialog>
  );
}

function RingCard({ ring }: { ring: Ring }) {
  const { acceptingCallId, accept, decline } = useCalls();
  const secondsLeft = useSecondsLeft(ring.expiresAt);
  const accepting = acceptingCallId === ring.callId;

  return (
    // role="alert" makes screen readers announce each ring as soon as it appears,
    // including a second one arriving while the dialog is already open.
    <section className={`${styles.panel} ${styles.ring}`} role="alert" aria-label="Incoming emergency call">
      <div className={styles.panelHeader}>
        <p className={styles.label}>Incoming emergency call</p>
        <span className={styles.meta} aria-hidden="true">
          0:{String(secondsLeft).padStart(2, '0')}
        </span>
      </div>
      <AidTypes names={ring.aidTypeNames} />
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => decline(ring.callId)} disabled={acceptingCallId !== null}>
          Decline
        </Button>
        <Button onClick={() => void accept(ring.callId)} disabled={acceptingCallId !== null}>
          {accepting ? 'Answering…' : 'Accept'}
        </Button>
      </div>
    </section>
  );
}

function ActiveCallPanel({ call }: { call: ActiveCall }) {
  const { toggleMute, hangUp } = useCalls();
  const elapsed = useElapsed(call.connectedAt);

  const status =
    call.audio === 'connected'
      ? call.muted
        ? 'Connected · you are muted'
        : 'Connected'
      : call.audio === 'reconnecting'
        ? 'Connection unstable, trying to recover…'
        : call.audio === 'failed'
          ? 'Audio couldn’t connect.'
          : 'Connecting audio…';

  return (
    <section className={`${styles.panel} ${styles.active}`} aria-label="Call in progress">
      <div className={styles.panelHeader}>
        <p className={styles.label}>On a call</p>
        {elapsed && (
          <span className={styles.meta} aria-label={`Call time ${elapsed}`}>
            {elapsed}
          </span>
        )}
      </div>
      <AidTypes names={call.aidTypeNames} />
      <p className={styles.status} role="status">
        {status}
      </p>
      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={toggleMute}
          aria-pressed={call.muted}
          disabled={call.audio === 'connecting' || call.audio === 'failed'}
        >
          {call.muted ? 'Unmute' : 'Mute'}
        </Button>
        <Button variant="dark" onClick={() => void hangUp()}>
          Hang up
        </Button>
      </div>
    </section>
  );
}

function EndedCallPanel({ call }: { call: EndedCall }) {
  const { dismissEnded } = useCalls();

  return (
    <section className={styles.panel} aria-label="Call ended">
      <p className={styles.label}>Call ended</p>
      <AidTypes names={call.aidTypeNames} />
      <p className={styles.status}>
        {call.audioFailed
          ? 'The audio couldn’t connect, so the call was ended. The caller can try again.'
          : ENDED_MESSAGES[call.status]}
      </p>

      {/* Keyed by call so a new call's panel starts with a closed, empty form. */}
      <BlockCallerForm key={call.callId} callId={call.callId} />

      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={dismissEnded}>
          Close
        </Button>
      </div>
    </section>
  );
}

function AidTypes({ names }: { names: string[] }) {
  return (
    <ul className={styles.aidTypes} aria-label="Emergency type">
      {names.map((name) => (
        <li key={name} className={styles.aidType}>
          {name}
        </li>
      ))}
    </ul>
  );
}

/** Re-renders once a second; returns the current time. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

/** Whole seconds until expiresAt; never below 0. */
function useSecondsLeft(expiresAt: number): number {
  return Math.max(0, Math.ceil((expiresAt - useNow()) / 1000));
}

/** "m:ss" since startedAt, or null before it starts. */
function useElapsed(startedAt: number | null): string | null {
  const now = useNow();
  if (startedAt === null) return null;

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
