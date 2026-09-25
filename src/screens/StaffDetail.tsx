import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BranchPageHeader } from '../components/branches/BranchPageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Detail } from '../components/ui/Detail';
import { FormField } from '../components/ui/FormField';
import { InviteStatusPill } from '../components/ui/InviteStatusPill';
import { MultiSelect } from '../components/ui/MultiSelect';
import { apiFetch, ApiError } from '../config/api';
import { useBranch } from '../context/BranchContext';
import { useAidTypes } from '../hooks/useAidTypes';
import type { StaffMember, StaffNotice } from '../types/staff';
import { formatDate } from '../utils/formatDate';
import { STAFF_ERROR_FIELDS, validateStaffDetails, type StaffFormErrors } from '../utils/staffForm';
import styles from './BranchForms.module.css';

/** The editable fields while in edit mode. Email is never editable. */
interface Draft {
  name: string;
  phone: string;
  aidTypeIds: string[];
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong, please try again';
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/**
 * Only the fields the admin actually changed — a real partial PATCH. Sending
 * every field would overwrite anything changed elsewhere since this page
 * loaded (a staff member can edit their own phone via PATCH /profile), with
 * the stale value on screen: a lost update. An emptied phone is sent as null,
 * which clears it; an untouched phone isn't sent at all.
 */
function changedFields(staff: StaffMember, draft: Draft) {
  const patch: { name?: string; phone?: string | null; aid_type_ids?: string[] } = {};
  const name = draft.name.trim();
  const phone = draft.phone.trim() || null;

  if (name !== staff.name) patch.name = name;
  if (phone !== staff.phone) patch.phone = phone;
  if (!sameIds(draft.aidTypeIds, staff.aid_types.map((aidType) => aidType.id))) {
    patch.aid_type_ids = draft.aidTypeIds;
  }
  return patch;
}

/**
 * Branch admin's page for one staff member (GET /staff/:id): their details,
 * aid types and invite status. Loads itself from the URL, so it survives a
 * refresh or a shared link.
 *
 * - Edit switches the details and aid types into a form (name, phone, aid
 *   types; email is shown but fixed). Save sends only what changed
 *   (PATCH /staff/:id) and shows the row the backend returns.
 * - Resend is offered only when the invite has EXPIRED — which also covers a
 *   first invite whose email failed, since the backend expires those at once.
 *   A pending invite still has a working link, so the backend would refuse it.
 *   The response is the refreshed row, so the new expiry shows straight away.
 */
export function StaffDetail() {
  const { id } = useParams();
  const { branch } = useBranch();
  const navigate = useNavigate();
  const { aidTypes, error: aidTypesError } = useAidTypes();
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<StaffNotice | null>(null);
  const [resending, setResending] = useState(false);
  // null = viewing; a Draft = editing, pre-filled from the current staff row.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<StaffFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ staff: StaffMember }>(`/staff/${id}`)
      .then((data) => {
        if (!cancelled) setStaff(data.staff);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  function startEditing() {
    if (!staff) return;
    setNotice(null);
    setFieldErrors({});
    setFormError(null);
    setDraft({
      name: staff.name,
      phone: staff.phone ?? '',
      aidTypeIds: staff.aid_types.map((aidType) => aidType.id),
    });
  }

  function cancelEditing() {
    setDraft(null);
    setFieldErrors({});
    setFormError(null);
  }

  function handleDraftChange(field: 'name' | 'phone') {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function handleAidTypesChange(ids: string[]) {
    setDraft((prev) => (prev ? { ...prev, aidTypeIds: ids } : prev));
    setFieldErrors((prev) => ({ ...prev, aidTypeIds: undefined }));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!staff || !draft) return;
    setFormError(null);

    const errors = validateStaffDetails(draft.name, draft.phone, draft.aidTypeIds);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const patch = changedFields(staff, draft);
    // Nothing changed: no request (the backend would answer 400 no_changes).
    if (Object.keys(patch).length === 0) {
      setDraft(null);
      return;
    }

    setSaving(true);

    try {
      const result = await apiFetch<{ staff: StaffMember }>(`/staff/${staff.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setStaff(result.staff);
      setDraft(null);
      setNotice({ text: 'Changes saved.', warn: false });
    } catch (err) {
      if (err instanceof ApiError && STAFF_ERROR_FIELDS[err.code]) {
        setFieldErrors({ [STAFF_ERROR_FIELDS[err.code]]: err.message });
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleResend() {
    if (!staff) return;
    setResending(true);
    setNotice(null);

    try {
      const result = await apiFetch<{ staff: StaffMember }>(`/staff/${staff.id}/resend-invite`, { method: 'POST' });
      setStaff(result.staff);
      setNotice({ text: `A new invite link was sent to ${result.staff.email}.`, warn: false });
    } catch (err) {
      setNotice({ text: errorMessage(err), warn: true });

      // Already resent (e.g. from another tab), so what's on screen is stale — reload it.
      if (err instanceof ApiError && err.code === 'staff_invite_not_expired') {
        apiFetch<{ staff: StaffMember }>(`/staff/${staff.id}`)
          .then((data) => setStaff(data.staff))
          .catch(() => {});
      }
    } finally {
      setResending(false);
    }
  }

  const aidTypeNames = staff?.aid_types.map((aidType) => aidType.name) ?? [];
  const editing = draft !== null;

  return (
    <PortalShell
      header={
        <BranchPageHeader
          title={staff?.name ?? 'Staff member'}
          meta={branch?.name}
          actions={
            <>
              {staff && !editing && (
                <Button variant="dark" size="sm" onClick={startEditing}>
                  Edit
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => navigate('/staff')} disabled={saving}>
                Back to staff
              </Button>
            </>
          }
        />
      }
    >
      {loadError && (
        <p role="alert" className={styles.error}>
          {loadError}
        </p>
      )}
      {!loadError && !staff && <p className={styles.empty}>Loading…</p>}
      {notice && (
        <p role="status" className={notice.warn ? styles.error : styles.success}>
          {notice.text}
        </p>
      )}

      {staff && draft && (
        <form onSubmit={handleSave} noValidate>
          <Card title="Edit staff details" className={styles.card}>
            <div className={styles.grid}>
              <FormField
                label="Full name"
                value={draft.name}
                onChange={handleDraftChange('name')}
                error={fieldErrors.name}
                autoComplete="off"
                required
              />
              <Detail label="Email (can't be changed)" value={staff.email} />
              <FormField
                label="Phone (optional)"
                type="tel"
                value={draft.phone}
                onChange={handleDraftChange('phone')}
                error={fieldErrors.phone}
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile number"
              />
              <div className={styles.field}>
                <span className={styles.label}>Aid types they can treat</span>
                <MultiSelect
                  options={aidTypes.map((aidType) => ({ id: aidType.id, label: aidType.name }))}
                  selected={draft.aidTypeIds}
                  onChange={handleAidTypesChange}
                  placeholder="Select aid types…"
                  disabled={!!aidTypesError || aidTypes.length === 0}
                />
                {aidTypesError && (
                  <p role="alert" className={styles.fieldError}>
                    Aid types failed to load, so they can't be changed right now. Name and phone can still be saved.
                  </p>
                )}
                {fieldErrors.aidTypeIds && (
                  <p role="alert" className={styles.fieldError}>
                    {fieldErrors.aidTypeIds}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {formError && (
            <p role="alert" className={styles.error}>
              {formError}
            </p>
          )}

          <div className={`${styles.formActions} ${styles.card}`}>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button type="button" variant="secondary" onClick={cancelEditing} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {staff && !editing && (
        <>
          <Card title="Staff details" className={styles.card}>
            <div className={styles.grid}>
              <Detail label="Name" value={staff.name} />
              <Detail label="Email" value={staff.email} />
              <Detail label="Phone" value={staff.phone} />
              <Detail
                label={staff.status === 'active' ? 'Joined on' : 'Invited on'}
                value={formatDate(staff.created_at)}
              />
            </div>
          </Card>

          <Card title="Aid types they can treat" className={styles.card}>
            {aidTypeNames.length > 0 ? (
              <ul className={styles.chips}>
                {aidTypeNames.map((name) => (
                  <li key={name} className={styles.chip}>
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No aid types set.</p>
            )}
          </Card>
        </>
      )}

      {staff && (
        <Card title="Invite" className={styles.card} action={<InviteStatusPill status={staff.status} />}>
          <div className={styles.stack}>
            {staff.status === 'active' && (
              <p className={styles.hint}>{staff.name} has accepted the invite and can sign in.</p>
            )}
            {staff.status === 'pending' && staff.invite_expires_at && (
              <p className={styles.hint}>
                Waiting for {staff.name} to accept. Their link works until{' '}
                <strong>{formatDate(staff.invite_expires_at)}</strong>.
              </p>
            )}
            {staff.status === 'expired' && (
              <>
                <p className={styles.hint}>
                  This invite can no longer be used — the link expired, or the email couldn't be sent. Send{' '}
                  {staff.name} a new link.
                </p>
                <div className={styles.formActions}>
                  <Button type="button" onClick={handleResend} disabled={resending || editing}>
                    {resending ? 'Sending…' : 'Resend invite'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </PortalShell>
  );
}
