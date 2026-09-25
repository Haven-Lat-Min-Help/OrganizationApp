import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BranchPageHeader } from '../components/branches/BranchPageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { MultiSelect } from '../components/ui/MultiSelect';
import { apiFetch, ApiError } from '../config/api';
import { useBranch } from '../context/BranchContext';
import { useAidTypes } from '../hooks/useAidTypes';
import type { StaffNotice } from '../types/staff';
import { EMAIL_REGEX, STAFF_ERROR_FIELDS, validateStaffDetails, type StaffFormErrors } from '../utils/staffForm';
import styles from './BranchForms.module.css';

interface FormState {
  name: string;
  email: string;
  phone: string;
}

type FormErrors = StaffFormErrors;

const initialForm: FormState = { name: '', email: '', phone: '' };

/** The shared staff rules, plus email — only an invite sets it. */
function validate(form: FormState, aidTypeIds: string[]): FormErrors {
  const errors = validateStaffDetails(form.name, form.phone, aidTypeIds);
  if (!EMAIL_REGEX.test(form.email.trim())) errors.email = 'Enter a valid email address';
  return errors;
}

/** Shown above the buttons; `toStaffList` adds a link for errors fixed from the list (Resend). */
interface FormError {
  text: string;
  toStaffList?: boolean;
}

/**
 * Branch admin's page for inviting a staff member into their own branch
 * (POST /staff/invite). Reached from + Add staff on the Staff page; the Staff
 * tab stays highlighted here since NavLink matches /staff by prefix.
 *
 * Sends only the staff member's details — never a branch or org id: the
 * backend takes both from the caller's profile. Aid types are shown by name
 * and sent by id. A field's error clears as soon as that field is edited; the
 * next submit re-checks everything.
 */
export function AddStaff() {
  const { branch } = useBranch();
  const navigate = useNavigate();
  const { aidTypes, error: aidTypesError } = useAidTypes();
  const [form, setForm] = useState<FormState>(initialForm);
  const [aidTypeIds, setAidTypeIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // No aid types means the "at least one" rule can't be met, so nothing can be sent.
  const aidTypesLoading = aidTypes.length === 0 && !aidTypesError;
  const aidTypesUnavailable = !!aidTypesError;

  function handleChange(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function handleAidTypesChange(ids: string[]) {
    setAidTypeIds(ids);
    setFieldErrors((prev) => ({ ...prev, aidTypeIds: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors = validate(form, aidTypeIds);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);

    const name = form.name.trim();
    const email = form.email.trim();

    try {
      // Only the staff member's details — the backend takes branch/org from the caller's profile.
      const result = await apiFetch<{ staff_user_id: string; email_sent: boolean }>('/staff/invite', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone: form.phone.trim() || null,
          aid_type_ids: aidTypeIds,
        }),
      });

      // When the email fails the backend expires the invite at once, so Resend is available.
      const notice: StaffNotice = result.email_sent
        ? { text: `Invite sent to ${email}.`, warn: false }
        : { text: `${name} was added, but the invite email couldn't be sent. Resend it from the list below.`, warn: true };

      navigate('/staff', { state: { notice } });
    } catch (err) {
      if (err instanceof ApiError && STAFF_ERROR_FIELDS[err.code]) {
        setFieldErrors({ [STAFF_ERROR_FIELDS[err.code]]: err.message });
      } else if (err instanceof ApiError && err.code === 'staff_invite_expired') {
        setFormError({ text: err.message, toStaffList: true });
      } else {
        setFormError({ text: err instanceof ApiError ? err.message : 'Something went wrong, please try again' });
      }
      setSubmitting(false);
    }
  }

  return (
    <PortalShell header={<BranchPageHeader title="Add staff" meta={branch?.name} />}>
      <form onSubmit={handleSubmit} noValidate>
        <Card title="Staff details" className={styles.card}>
          <div className={styles.grid}>
            <FormField
              label="Full name"
              value={form.name}
              onChange={handleChange('name')}
              error={fieldErrors.name}
              autoComplete="off"
              required
            />
            <FormField
              label="Email"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              error={fieldErrors.email}
              autoComplete="off"
              required
            />
            <FormField
              label="Phone (optional)"
              type="tel"
              value={form.phone}
              onChange={handleChange('phone')}
              error={fieldErrors.phone}
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
            />
            <div className={styles.field}>
              <span className={styles.label}>Aid types they can treat</span>
              <MultiSelect
                options={aidTypes.map((aidType) => ({ id: aidType.id, label: aidType.name }))}
                selected={aidTypeIds}
                onChange={handleAidTypesChange}
                placeholder={aidTypesLoading ? 'Loading aid types…' : 'Select aid types…'}
                disabled={aidTypesLoading || aidTypesUnavailable}
              />
              {aidTypesUnavailable && (
                <p role="alert" className={styles.fieldError}>
                  Aid types failed to load. Refresh the page or try again after some time.
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
            {formError.text}
            {formError.toStaffList && (
              <>
                {' '}
                <Link to="/staff" className={styles.errorLink}>
                  Go to staff list
                </Link>
              </>
            )}
          </p>
        )}

        <div className={styles.formActions}>
          <Button type="submit" disabled={submitting || aidTypesUnavailable}>
            {submitting ? 'Sending…' : 'Send invite'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/staff')} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>
    </PortalShell>
  );
}
