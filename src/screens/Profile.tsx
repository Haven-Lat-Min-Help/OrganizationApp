import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { apiFetch, ApiError } from '../config/api';
import styles from './Profile.module.css';

// Mirrors Backend/src/middleware/validateProfileUpdate.ts, which mirrors the
// DB check constraints on public.profiles — each layer validates independently.
const PHONE_REGEX = /^[0-9]{10}$/;
const PINCODE_REGEX = /^[0-9]{6}$/;

interface Profile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  role: string;
}

interface FormState {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

function toForm(profile: Profile): FormState {
  return {
    name: profile.name,
    phone: profile.phone ?? '',
    addressLine1: profile.address_line1 ?? '',
    addressLine2: profile.address_line2 ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
    country: profile.country,
    pincode: profile.pincode ?? '',
  };
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (form.phone.trim() && !PHONE_REGEX.test(form.phone.trim())) errors.phone = 'Phone must be 10 digits';
  if (!form.country.trim()) errors.country = 'Country cannot be empty';
  if (form.pincode.trim() && !PINCODE_REGEX.test(form.pincode.trim())) errors.pincode = 'Pincode must be 6 digits';
  return errors;
}

// Backend error codes → the form field they belong to, so a server-side
// rejection lands under the right input instead of a generic banner.
const SERVER_ERROR_FIELDS: Record<string, keyof FormState> = {
  name_invalid: 'name',
  phone_invalid: 'phone',
  country_invalid: 'country',
  pincode_invalid: 'pincode',
};

function formatRole(role: string): string {
  const label = role.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={styles.detail}>
      <span className={styles.detailLabel}>{label}</span>
      <p className={`${styles.detailValue} ${value ? '' : styles.detailEmpty}`}>{value || 'Not set'}</p>
    </div>
  );
}

/**
 * Own-profile screen for the signed-in organization user (opened from the
 * account menu). Loads GET /profile, shows every detail read-only, and an Edit
 * button swaps in a form that validates client-side and then sends
 * PATCH /profile — see Backend/src/controllers/profileController.ts, which
 * serves every role. Email and role are display-only: the backend ignores
 * them on update.
 */
export function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch<{ profile: Profile }>('/profile')
      .then((data) => {
        if (!cancelled) setProfile(data.profile);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function startEditing() {
    if (!profile) return;
    setForm(toForm(profile));
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setForm(null);
    setFieldErrors({});
    setFormError(null);
  }

  function handleChange(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setFormError(null);
    setSuccess(null);

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);

    try {
      const result = await apiFetch<{ profile: Omit<Profile, 'email'> }>('/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          address_line1: form.addressLine1.trim() || null,
          address_line2: form.addressLine2.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          country: form.country.trim(),
          pincode: form.pincode.trim() || null,
        }),
      });

      // PATCH doesn't return email (it lives in auth.users) — keep the one we have.
      setProfile((prev) => ({ ...result.profile, email: prev?.email ?? null }));
      setEditing(false);
      setForm(null);
      setSuccess('Profile updated.');
    } catch (err) {
      if (err instanceof ApiError && SERVER_ERROR_FIELDS[err.code]) {
        setFieldErrors({ [SERVER_ERROR_FIELDS[err.code]]: err.message });
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell
      header={
        <PageHeader
          title="Profile"
          meta="Your account details"
          actions={
            profile && !editing ? (
              <Button variant="secondary" size="sm" onClick={startEditing}>
                Edit profile
              </Button>
            ) : undefined
          }
        />
      }
    >
      {loadError && (
        <p role="alert" className={styles.error}>
          {loadError}
        </p>
      )}
      {!loadError && !profile && <p className={styles.empty}>Loading…</p>}
      {success && <p className={styles.success}>{success}</p>}

      {profile && !editing && (
        <>
          <Card title="Personal details" className={styles.card}>
            <div className={styles.grid}>
              <Detail label="Name" value={profile.name} />
              <Detail label="Email" value={profile.email} />
              <Detail label="Phone" value={profile.phone} />
              <Detail label="Role" value={formatRole(profile.role)} />
            </div>
          </Card>
          <Card title="Address" className={styles.card}>
            <div className={styles.grid}>
              <Detail label="Address line 1" value={profile.address_line1} />
              <Detail label="Address line 2" value={profile.address_line2} />
              <Detail label="City" value={profile.city} />
              <Detail label="State" value={profile.state} />
              <Detail label="Country" value={profile.country} />
              <Detail label="Pincode" value={profile.pincode} />
            </div>
          </Card>
        </>
      )}

      {profile && editing && form && (
        <form onSubmit={handleSubmit} noValidate>
          <Card title="Personal details" className={styles.card}>
            <div className={styles.grid}>
              <FormField
                label="Name"
                value={form.name}
                onChange={handleChange('name')}
                error={fieldErrors.name}
                required
              />
              <FormField label="Email" value={profile.email ?? ''} disabled readOnly />
              <FormField
                label="Phone"
                value={form.phone}
                onChange={handleChange('phone')}
                error={fieldErrors.phone}
                placeholder="9876543210"
                inputMode="numeric"
              />
              <FormField label="Role" value={formatRole(profile.role)} disabled readOnly />
            </div>
          </Card>
          <Card title="Address" className={styles.card}>
            <div className={styles.grid}>
              <FormField label="Address line 1" value={form.addressLine1} onChange={handleChange('addressLine1')} />
              <FormField label="Address line 2" value={form.addressLine2} onChange={handleChange('addressLine2')} />
              <FormField label="City" value={form.city} onChange={handleChange('city')} />
              <FormField label="State" value={form.state} onChange={handleChange('state')} />
              <FormField
                label="Country"
                value={form.country}
                onChange={handleChange('country')}
                error={fieldErrors.country}
                required
              />
              <FormField
                label="Pincode"
                value={form.pincode}
                onChange={handleChange('pincode')}
                error={fieldErrors.pincode}
                placeholder="411001"
                inputMode="numeric"
              />
            </div>
          </Card>

          {formError && (
            <p role="alert" className={styles.error}>
              {formError}
            </p>
          )}

          <div className={styles.formActions}>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
            <Button type="button" variant="secondary" onClick={cancelEditing} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </PortalShell>
  );
}
