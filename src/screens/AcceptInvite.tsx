import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { apiFetch, ApiError } from '../config/api';
import styles from './AcceptInvite.module.css';

interface InviteDetails {
  name: string;
  email: string | null;
  org_name: string;
  /** Set for a branch-admin invite, null for an org-admin one. */
  branch_name: string | null;
}

// verifying → ready is the happy path; the rest are terminal states that
// replace the form with a message.
type Phase = 'verifying' | 'ready' | 'invalid' | 'expired' | 'error';

// Read once, in a state initializer, so React StrictMode's double-run of
// effects in dev can't find the params already stripped from the URL.
function readInviteParams(): { uid: string | null; token: string | null } {
  const params = new URLSearchParams(window.location.search);
  return { uid: params.get('uid'), token: params.get('token') };
}

const TERMINAL_MESSAGES: Record<Exclude<Phase, 'verifying' | 'ready'>, { title: string; body: string }> = {
  invalid: {
    title: 'Invite link not valid',
    body: 'This link is invalid or has already been used. If you have already set a password, sign in instead.',
  },
  expired: {
    title: 'Invite link expired',
    body: 'This invite has expired. Ask your Haven administrator to send you a new one.',
  },
  error: {
    title: 'Something went wrong',
    body: 'We could not check your invite right now. Please try again in a moment.',
  },
};

/**
 * Landing screen for the org-admin and branch-admin invite emails
 * (…/accept-invite?uid=…&token=…) — one screen for both, since the backend
 * resolves which kind of invite it is.
 * Verifies the link with POST /auth/invite/verify, then collects a password
 * and sends it to POST /auth/invite/accept — which sets the password and
 * creates the profile — before sending the user to /login. The uid/token live
 * only in component state: they're removed from the address bar right away so
 * the token doesn't linger in the URL or browser history. Role and org are
 * never read from, or sent by, the browser; the backend takes them from the
 * stored invite.
 */
export function AcceptInvite() {
  const navigate = useNavigate();
  const [{ uid, token }] = useState(readInviteParams);
  const [phase, setPhase] = useState<Phase>(uid && token ? 'verifying' : 'invalid');
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Drop the credentials from the address bar (and history entry).
  useEffect(() => {
    navigate('/accept-invite', { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (phase !== 'verifying') return;
    let cancelled = false;

    apiFetch<InviteDetails>('/auth/invite/verify', {
      method: 'POST',
      body: JSON.stringify({ uid, token }),
    })
      .then((data) => {
        if (cancelled) return;
        setInvite(data);
        setPhase('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'invite_expired') setPhase('expired');
        else if (err instanceof ApiError && err.code === 'invite_invalid') setPhase('invalid');
        else setPhase('error');
      });

    return () => {
      cancelled = true;
    };
    // uid/token are fixed for the lifetime of the screen; phase only gates the first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setPasswordError(undefined);
    setConfirmError(undefined);

    if (!password) {
      setPasswordError('Enter a password');
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      const result = await apiFetch<{ email: string | null }>('/auth/invite/accept', {
        method: 'POST',
        body: JSON.stringify({ uid, token, password }),
      });

      navigate('/login', {
        replace: true,
        state: { notice: 'Password set. Sign in to continue.', email: result.email ?? invite?.email ?? '' },
      });
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'password_invalid' || err.code === 'password_required')) {
        setPasswordError(err.message);
      } else if (err instanceof ApiError && err.code === 'invite_expired') {
        setPhase('expired');
      } else if (err instanceof ApiError && err.code === 'invite_invalid') {
        setPhase('invalid');
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.wordmark}>Haven</span>
          <span className={styles.partnerTag}>partner</span>
        </div>

        {phase === 'verifying' && <p className={styles.status}>Checking your invite…</p>}

        {(phase === 'invalid' || phase === 'expired' || phase === 'error') && (
          <>
            <div className={styles.heading}>
              <h1 className={styles.title}>{TERMINAL_MESSAGES[phase].title}</h1>
              <p className={styles.subtitle}>{TERMINAL_MESSAGES[phase].body}</p>
            </div>
            <Link to="/login" className={styles.link}>
              Go to sign in
            </Link>
          </>
        )}

        {phase === 'ready' && invite && (
          <>
            <div className={styles.heading}>
              <h1 className={styles.title}>Welcome, {invite.name}</h1>
              <p className={styles.subtitle}>
                {invite.branch_name
                  ? `Set a password to manage the ${invite.branch_name} branch of ${invite.org_name} on Haven.`
                  : `Set a password to manage ${invite.org_name} on Haven.`}
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <FormField
                label="Email"
                type="email"
                value={invite.email ?? ''}
                disabled
                readOnly
                autoComplete="username"
              />
              <FormField
                label="Password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordError(undefined);
                }}
                error={passwordError}
                autoComplete="new-password"
                required
              />
              <FormField
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setConfirmError(undefined);
                }}
                error={confirmError}
                autoComplete="new-password"
                required
              />

              {formError && (
                <p role="alert" className={styles.error}>
                  {formError}
                </p>
              )}

              <Button type="submit" variant="dark" className={styles.submit} disabled={submitting}>
                {submitting ? 'Setting password…' : 'Set password'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
