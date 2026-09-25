import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Detail } from '../components/ui/Detail';
import { FormField } from '../components/ui/FormField';
import { InviteStatusPill } from '../components/ui/InviteStatusPill';
import { apiFetch, ApiError } from '../config/api';
import { ORG_TABS } from '../config/orgTabs';
import { useHospitalTypes } from '../hooks/useHospitalTypes';
import type { Branch } from '../types/branch';
import { formatDate } from '../utils/formatDate';
import styles from './BranchForms.module.css';

// Mirror Backend/src/middleware/validateBranch.ts (validateBranchAdminInvite).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9]{10}$/;

interface InviteForm {
  name: string;
  email: string;
  phone: string;
}

type InviteErrors = Partial<Record<keyof InviteForm, string>>;

// Backend error codes → the invite field they belong to.
const INVITE_ERROR_FIELDS: Record<string, keyof InviteForm> = {
  admin_name_required: 'name',
  admin_email_invalid: 'email',
  admin_email_taken: 'email',
  admin_phone_invalid: 'phone',
};

interface Notice {
  text: string;
  warn: boolean;
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong, please try again';
}

/**
 * Org admin's page for one branch (GET /branches/:id): its details, hospital
 * types and branch admin, plus the two actions only an org admin has —
 * deactivate/reactivate the branch, and invite (or re-invite, once an invite
 * has expired) its admin by email. The invite is POST /branches/:id/admin-invite;
 * the backend creates the account and emails the link, and this page just
 * reloads the branch to show the new "Invite pending" state.
 */
export function BranchDetail() {
  const { id } = useParams();
  const handoff = useLocation().state as { notice?: string } | null;
  const { hospitalTypes } = useHospitalTypes();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(handoff?.notice ? { text: handoff.notice, warn: false } : null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [invite, setInvite] = useState<InviteForm>({ name: '', email: '', phone: '' });
  const [inviteErrors, setInviteErrors] = useState<InviteErrors>({});
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ branch: Branch }>(`/branches/${id}`)
      .then((data) => {
        if (!cancelled) setBranch(data.branch);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleToggleActive() {
    if (!branch) return;
    const deactivating = branch.is_active;
    if (deactivating && !window.confirm(`Deactivate ${branch.name}? Its admin will no longer be able to edit it.`)) {
      return;
    }

    setToggling(true);
    setActionError(null);
    setNotice(null);

    try {
      const result = await apiFetch<{ branch: Branch }>(`/branches/${branch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !deactivating }),
      });
      setBranch(result.branch);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setToggling(false);
    }
  }

  function handleInviteChange(field: keyof InviteForm) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setInvite((prev) => ({ ...prev, [field]: value }));
      setInviteErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    if (!branch) return;
    setInviteError(null);
    setNotice(null);

    const errors: InviteErrors = {};
    if (invite.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
    if (!EMAIL_REGEX.test(invite.email.trim())) errors.email = 'Enter a valid email address';
    if (invite.phone.trim() && !PHONE_REGEX.test(invite.phone.trim())) errors.phone = 'Phone must be 10 digits';
    setInviteErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setInviting(true);

    try {
      const result = await apiFetch<{ email_sent: boolean }>(`/branches/${branch.id}/admin-invite`, {
        method: 'POST',
        body: JSON.stringify({
          name: invite.name.trim(),
          email: invite.email.trim(),
          phone: invite.phone.trim() || null,
        }),
      });

      setNotice(
        result.email_sent
          ? { text: `Invite sent to ${invite.email.trim()}.`, warn: false }
          : { text: 'The invite was created but the email could not be sent. Try again in a moment.', warn: true },
      );
      setInvite({ name: '', email: '', phone: '' });

      // Reload so the admin block shows the new pending invite.
      const refreshed = await apiFetch<{ branch: Branch }>(`/branches/${branch.id}`);
      setBranch(refreshed.branch);
    } catch (err) {
      if (err instanceof ApiError && INVITE_ERROR_FIELDS[err.code]) {
        setInviteErrors({ [INVITE_ERROR_FIELDS[err.code]]: err.message });
      } else {
        setInviteError(errorMessage(err));
      }
    } finally {
      setInviting(false);
    }
  }

  const typeNames = new Map(hospitalTypes.map((type) => [type.id, type.name]));
  const selectedTypes = branch
    ? branch.hospital_type_ids.map((typeId) => typeNames.get(typeId)).filter((name): name is string => !!name)
    : [];
  const location = branch ? [branch.city, branch.state, branch.country].filter(Boolean).join(', ') : '';
  const admin = branch?.admin ?? null;
  // A live invite or an accepted admin blocks a new invite (backend answers
  // 409); only an empty or expired slot can be invited, and only while active.
  const canInvite = !!branch && branch.is_active && (!admin || admin.status === 'expired');

  return (
    <PortalShell
      header={
        <PageHeader
          title={branch?.name ?? 'Branch'}
          meta={branch ? `${branch.org_name} · ${location}` : undefined}
          actions={
            branch ? (
              <Button variant="secondary" size="sm" onClick={handleToggleActive} disabled={toggling}>
                {toggling ? 'Saving…' : branch.is_active ? 'Deactivate branch' : 'Reactivate branch'}
              </Button>
            ) : undefined
          }
          tabs={ORG_TABS}
        />
      }
    >
      {loadError && (
        <p role="alert" className={styles.error}>
          {loadError}
        </p>
      )}
      {!loadError && !branch && <p className={styles.empty}>Loading…</p>}
      {notice && <p className={notice.warn ? styles.error : styles.success}>{notice.text}</p>}
      {actionError && (
        <p role="alert" className={styles.error}>
          {actionError}
        </p>
      )}

      {branch && (
        <>
          <Card title="Branch details" className={styles.card}>
            <div className={styles.grid}>
              <Detail label="Branch name" value={branch.name} />
              <Detail label="Organization" value={branch.org_name} />
              <Detail label="Status" value={branch.is_active ? 'Active' : 'Inactive'} />
              <Detail label="Created on" value={formatDate(branch.created_at)} />
            </div>
          </Card>

          <Card title="Hospital types" className={styles.card}>
            {selectedTypes.length > 0 ? (
              <ul className={styles.chips}>
                {selectedTypes.map((name) => (
                  <li key={name} className={styles.chip}>
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No hospital types set.</p>
            )}
          </Card>

          <Card title="Address" className={styles.card}>
            <div className={styles.grid}>
              <Detail label="Address line 1" value={branch.address_line1} />
              <Detail label="Address line 2" value={branch.address_line2} />
              <Detail label="City" value={branch.city} />
              <Detail label="State" value={branch.state} />
              <Detail label="Country" value={branch.country} />
              <Detail label="Pincode" value={branch.pincode} />
            </div>
          </Card>

          <Card
            title="Branch admin"
            className={styles.card}
            action={
              admin && <InviteStatusPill status={admin.status} />
            }
          >
            <div className={styles.stack}>
              {admin && (
                <div className={styles.grid}>
                  <Detail label="Name" value={admin.name} />
                  <Detail label="Email" value={admin.email} />
                  <Detail label="Phone" value={admin.phone} />
                </div>
              )}

              {admin?.status === 'pending' && (
                <p className={styles.hint}>Waiting for {admin.name} to accept the invite and set a password.</p>
              )}
              {admin?.status === 'expired' && (
                <p className={styles.hint}>This invite expired before it was accepted. Send a new one below.</p>
              )}
              {!admin && branch.is_active && (
                <p className={styles.hint}>
                  No admin yet. Enter their details and we'll email them a link to set a password and manage this branch.
                </p>
              )}
              {!branch.is_active && !admin && (
                <p className={styles.hint}>Reactivate this branch to invite an admin.</p>
              )}

              {canInvite && (
                <form onSubmit={handleInvite} noValidate className={styles.stack}>
                  <div className={styles.grid}>
                    <FormField
                      label="Admin name"
                      value={invite.name}
                      onChange={handleInviteChange('name')}
                      error={inviteErrors.name}
                      required
                    />
                    <FormField
                      label="Admin email"
                      type="email"
                      value={invite.email}
                      onChange={handleInviteChange('email')}
                      error={inviteErrors.email}
                      autoComplete="off"
                      required
                    />
                    <FormField
                      label="Admin phone"
                      value={invite.phone}
                      onChange={handleInviteChange('phone')}
                      error={inviteErrors.phone}
                      placeholder="9876543210"
                      inputMode="numeric"
                    />
                  </div>

                  {inviteError && (
                    <p role="alert" className={styles.error}>
                      {inviteError}
                    </p>
                  )}

                  <div className={styles.formActions}>
                    <Button type="submit" disabled={inviting}>
                      {inviting ? 'Sending…' : admin ? 'Send new invite' : 'Send invite'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Card>
        </>
      )}
    </PortalShell>
  );
}
