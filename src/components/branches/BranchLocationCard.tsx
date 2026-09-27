import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '../../config/api';
import { useBranch } from '../../context/BranchContext';
import type { Branch } from '../../types/branch';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Detail } from '../ui/Detail';
import { FormField } from '../ui/FormField';
import { LocationPicker, type Coordinates } from './LocationPicker';
import styles from './BranchLocationCard.module.css';

// Mirrors BRANCH_PHONE_REGEX in Backend/src/middleware/validateBranch.ts:
// mobile (10), STD landline with its leading 0 (11), 1800 toll-free (11).
const PHONE_REGEX = /^[0-9]{10,11}$/;
const SERVER_ERROR = 'Something went wrong, please try again';
// Wait this long after the pin stops moving before asking the backend (and
// through it Google) — a drag would otherwise fire a lookup per step.
const PIN_CHECK_DELAY_MS = 600;

/** POST /branches/:id/pin-check response. matches is null when there's nothing to compare. */
interface PinCheckResult {
  pin_pincode: string | null;
  branch_pincode: string | null;
  matches: boolean | null;
}

type PinCheck =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'done'; result: PinCheckResult }
  | { status: 'failed' };

/** What the live pin check found, in words. Nothing while idle (no pin, or the pin hasn't moved). */
function PinCheckNote({ check }: { check: PinCheck }) {
  if (check.status === 'idle') return null;
  if (check.status === 'checking') {
    return <p className={styles.hint}>Checking this pin against your branch address…</p>;
  }
  if (check.status === 'failed') {
    return <p className={styles.hint}>Couldn't check this pin against your address right now. You can still save.</p>;
  }

  const { pin_pincode: pinPincode, branch_pincode: branchPincode, matches } = check.result;
  if (!branchPincode) {
    return <p className={styles.hint}>Your branch address has no pincode, so this pin can't be checked against it.</p>;
  }
  if (matches === null) {
    return <p className={styles.hint}>Couldn't find a pincode at this pin. Make sure it sits on your branch.</p>;
  }
  if (matches) {
    return <p className={styles.match}>This pin is in pincode {pinPincode}, matching your branch address.</p>;
  }
  return (
    <p role="status" className={styles.warning}>
      This pin is in pincode {pinPincode}, but your branch address says {branchPincode}. Move the pin onto your
      branch — if it's already right, you'll be asked to confirm when you save.
    </p>
  );
}

function savedLocation(branch: Branch): Coordinates | null {
  return branch.latitude !== null && branch.longitude !== null
    ? { latitude: branch.latitude, longitude: branch.longitude }
    : null;
}

/** "020-2612 3456" and "02026123456" are the same number — same stripping as the backend. */
function cleanPhone(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/**
 * Branch admin's "Location & contact" card on their home page. The pin is what
 * puts the branch in the mobile app's nearby-hospitals list, so a branch
 * without one gets a warning. Editing is branch admin only and only while the
 * branch is active — the backend enforces both; this page just doesn't offer
 * what would be refused.
 *
 * Pin check, twice:
 * - Live, as the pin moves (POST /branches/:id/pin-check, once it settles) —
 *   so a wrong pin is flagged before Save. Advisory only.
 * - At save: if the pincode at the new pin differs from the branch's, the
 *   backend answers 409 pincode_mismatch and nothing is saved. The admin
 *   either moves the pin or confirms, which re-sends with
 *   confirm_pincode_mismatch. This one is the real guard.
 */
export function BranchLocationCard({ branch }: { branch: Branch }) {
  const { replaceBranch } = useBranch();
  const [editing, setEditing] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [phone, setPhone] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pinCheck, setPinCheck] = useState<PinCheck>({ status: 'idle' });

  const saved = savedLocation(branch);
  const pinMoved =
    location !== null && (location.latitude !== saved?.latitude || location.longitude !== saved?.longitude);

  // Live pin check. Each new pin cancels the previous timer and request, so a
  // slow answer for an old pin can never overwrite the answer for the new one.
  const checkLatitude = editing && pinMoved && location ? location.latitude : null;
  const checkLongitude = editing && pinMoved && location ? location.longitude : null;

  useEffect(() => {
    if (checkLatitude === null || checkLongitude === null) {
      setPinCheck({ status: 'idle' });
      return;
    }

    setPinCheck({ status: 'checking' });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiFetch<PinCheckResult>(`/branches/${branch.id}/pin-check`, {
        method: 'POST',
        body: JSON.stringify({ latitude: checkLatitude, longitude: checkLongitude }),
        signal: controller.signal,
      })
        .then((result) => setPinCheck({ status: 'done', result }))
        .catch(() => {
          if (!controller.signal.aborted) setPinCheck({ status: 'failed' });
        });
    }, PIN_CHECK_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [branch.id, checkLatitude, checkLongitude]);

  function startEditing() {
    setLocation(saved);
    setPhone(branch.phone ?? '');
    setLocationError(null);
    setPhoneError(null);
    setFormError(null);
    setMismatch(null);
    setNotice(null);
    setEditing(true);
  }

  function handleLocationChange(next: Coordinates | null) {
    setLocation(next);
    setLocationError(null);
    // A moved pin is a new question — the old mismatch warning no longer applies.
    setMismatch(null);
  }

  async function save(confirmMismatch: boolean) {
    setFormError(null);

    const errors = { location: null as string | null, phone: null as string | null };
    if (!location) errors.location = 'Select the branch location on the map';
    const phoneDigits = cleanPhone(phone);
    if (phoneDigits && !PHONE_REGEX.test(phoneDigits)) errors.phone = 'Phone must be 10 or 11 digits';
    setLocationError(errors.location);
    setPhoneError(errors.phone);
    if (errors.location || errors.phone || !location) return;

    // Send only what changed: re-sending an unchanged pin would be harmless
    // (the backend skips the check), but an untouched phone should stay untouched.
    const body: Record<string, unknown> = {};
    if (location.latitude !== saved?.latitude || location.longitude !== saved?.longitude) {
      body.latitude = location.latitude;
      body.longitude = location.longitude;
    }
    if (phoneDigits !== (branch.phone ?? '')) body.phone = phoneDigits || null;

    if (Object.keys(body).length === 0) {
      setEditing(false);
      return;
    }
    if (confirmMismatch) body.confirm_pincode_mismatch = true;

    setSaving(true);
    try {
      const result = await apiFetch<{ branch: Branch }>(`/branches/${branch.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      replaceBranch(result.branch);
      setEditing(false);
      setMismatch(null);
      setNotice('Location and contact saved.');
    } catch (err) {
      if (!(err instanceof ApiError)) {
        setFormError(SERVER_ERROR);
      } else if (err.code === 'pincode_mismatch') {
        setMismatch(err.message);
      } else if (err.code === 'location_invalid') {
        setLocationError(err.message);
      } else if (err.code === 'phone_invalid') {
        setPhoneError(err.message);
      } else {
        setFormError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void save(false);
  }

  return (
    <Card
      title="Location & contact"
      className={styles.card}
      action={
        !editing &&
        branch.is_active && (
          <Button variant="secondary" size="sm" onClick={startEditing}>
            {saved ? 'Edit' : 'Set location'}
          </Button>
        )
      }
    >
      {notice && <p className={styles.success}>{notice}</p>}

      {!editing && (
        <div className={styles.stack}>
          {!saved && (
            <p className={styles.warning}>
              Patients can't find this branch in the Haven app until you set its location.
            </p>
          )}
          {saved && <LocationPicker value={saved} readOnly />}
          <div className={styles.grid}>
            <Detail label="Latitude" value={saved ? String(saved.latitude) : null} />
            <Detail label="Longitude" value={saved ? String(saved.longitude) : null} />
            <Detail label="Phone" value={branch.phone} />
          </div>
          {!branch.is_active && (
            <p className={styles.hint}>This branch is deactivated, so its location and contact can't be edited.</p>
          )}
        </div>
      )}

      {editing && (
        <form onSubmit={handleSubmit} noValidate className={styles.stack}>
          <LocationPicker value={location} onChange={handleLocationChange} />
          {locationError && (
            <p role="alert" className={styles.fieldError}>
              {locationError}
            </p>
          )}
          {/* Once the save-time mismatch prompt is up it says the same thing, so the live note steps aside. */}
          {!mismatch && <PinCheckNote check={pinCheck} />}

          <div className={styles.grid}>
            <FormField
              label="Branch phone"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setPhoneError(null);
              }}
              error={phoneError ?? undefined}
              placeholder="020 2612 3456"
              inputMode="tel"
            />
          </div>

          {mismatch && (
            <div role="alert" className={styles.mismatch}>
              <p className={styles.mismatchText}>{mismatch}</p>
              <div className={styles.actions}>
                <Button type="button" size="sm" onClick={() => void save(true)} disabled={saving}>
                  Yes, the location is correct
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setMismatch(null)} disabled={saving}>
                  Move the pin
                </Button>
              </div>
            </div>
          )}

          {formError && (
            <p role="alert" className={styles.error}>
              {formError}
            </p>
          )}

          {!mismatch && (
            <div className={styles.actions}>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}
