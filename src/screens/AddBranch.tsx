import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { PortalShell } from '../components/layout/PortalShell';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { MultiSelect } from '../components/ui/MultiSelect';
import { apiFetch, ApiError } from '../config/api';
import { ORG_TABS } from '../config/orgTabs';
import { useHospitalTypes } from '../hooks/useHospitalTypes';
import styles from './BranchForms.module.css';

// Mirror Backend/src/middleware/validateBranch.ts, which mirrors the DB
// constraints on public.branches — each layer validates independently.
const REG_ID_REGEX = /^[A-Z]{2}\/[A-Z]{2,15}\/[0-9]{4}\/[0-9]{3,8}$/;
const PINCODE_REGEX = /^[0-9]{6}$/;

interface FormState {
  name: string;
  regId: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const initialForm: FormState = {
  name: '',
  regId: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
};

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.name.trim().length < 2) errors.name = 'Branch name must be at least 2 characters';
  if (!REG_ID_REGEX.test(form.regId.trim().toUpperCase())) {
    errors.regId = 'Registration ID must look like MH/PUNE/2026/04128';
  }
  if (!form.country.trim()) errors.country = 'Country cannot be empty';
  if (form.pincode.trim() && !PINCODE_REGEX.test(form.pincode.trim())) errors.pincode = 'Pincode must be 6 digits';
  return errors;
}

// Backend error codes → the form field they belong to.
const SERVER_ERROR_FIELDS: Record<string, keyof FormState> = {
  branch_name_required: 'name',
  branch_name_taken: 'name',
  reg_id_invalid: 'regId',
  branch_already_exists: 'regId',
  pincode_invalid: 'pincode',
};

/**
 * Org admin's add-branch form. Validates client-side, then POST /branches — the
 * backend puts the branch under the caller's own organization (no org id is
 * sent). On success it opens the new branch's page, where its admin is invited.
 * The branch admin is deliberately a separate step: the branch exists first and
 * the invite is sent from its page.
 */
export function AddBranch() {
  const navigate = useNavigate();
  const { hospitalTypes, error: typesError } = useHospitalTypes();
  const [form, setForm] = useState<FormState>(initialForm);
  const [hospitalTypeIds, setHospitalTypeIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);

    try {
      const result = await apiFetch<{ branch_id: string }>('/branches', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          reg_id: form.regId.trim().toUpperCase(),
          address_line1: form.addressLine1.trim() || null,
          address_line2: form.addressLine2.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          country: form.country.trim(),
          pincode: form.pincode.trim() || null,
          hospital_type_ids: hospitalTypeIds,
        }),
      });

      navigate(`/branches/${result.branch_id}`, {
        state: { notice: 'Branch created. Invite its admin below.' },
      });
    } catch (err) {
      if (err instanceof ApiError && SERVER_ERROR_FIELDS[err.code]) {
        setFieldErrors({ [SERVER_ERROR_FIELDS[err.code]]: err.message });
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      }
      setSubmitting(false);
    }
  }

  return (
    <PortalShell
      header={<PageHeader title="Add branch" meta="Add a new branch to your organization" tabs={ORG_TABS} />}
    >
      <form onSubmit={handleSubmit} noValidate>
        <Card title="Branch details" className={styles.card}>
          <div className={styles.grid}>
            <FormField label="Branch name" value={form.name} onChange={handleChange('name')} error={fieldErrors.name} required />
            <FormField
              label="Clinical Establishment Reg. ID"
              value={form.regId}
              onChange={handleChange('regId')}
              error={fieldErrors.regId}
              placeholder="MH/PUNE/2026/04128"
              required
            />
            <div className={styles.field}>
              <span className={styles.label}>Hospital types</span>
              <MultiSelect
                options={hospitalTypes.map((type) => ({ id: type.id, label: type.name }))}
                selected={hospitalTypeIds}
                onChange={setHospitalTypeIds}
                placeholder="Select hospital types…"
              />
              {typesError && <p className={styles.hint}>{typesError} — refresh to try again.</p>}
            </div>
          </div>
        </Card>

        <Card title="Address" className={styles.card}>
          <div className={styles.grid}>
            <FormField label="Address line 1" value={form.addressLine1} onChange={handleChange('addressLine1')} />
            <FormField label="Address line 2" value={form.addressLine2} onChange={handleChange('addressLine2')} />
            <FormField label="City" value={form.city} onChange={handleChange('city')} />
            <FormField label="State" value={form.state} onChange={handleChange('state')} />
            <FormField label="Country" value={form.country} onChange={handleChange('country')} error={fieldErrors.country} required />
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
            {submitting ? 'Creating…' : 'Create branch'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/branches')} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </form>
    </PortalShell>
  );
}
