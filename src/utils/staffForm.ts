// Client-side rules for the staff forms (AddStaff, and editing on StaffDetail).
// Mirror Backend/src/middleware/validateStaffInvite.ts and
// validateUpdateStaff.ts — each layer validates independently; this one just
// saves a round trip.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9]{10}$/;

/** One message per field. aidTypeIds is the aid-type picker, not a text input. */
export type StaffFormErrors = Partial<Record<'name' | 'email' | 'phone' | 'aidTypeIds', string>>;

/** The rules shared by inviting and editing: name, optional phone, at least one aid type. */
export function validateStaffDetails(name: string, phone: string, aidTypeIds: string[]): StaffFormErrors {
  const errors: StaffFormErrors = {};
  if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (phone.trim() && !PHONE_REGEX.test(phone.trim())) errors.phone = 'Phone must be 10 digits';
  if (aidTypeIds.length === 0) errors.aidTypeIds = 'Select at least one aid type';
  return errors;
}

/**
 * Backend error codes from POST /staff/invite and PATCH /staff/:id → the form
 * field they belong to. Codes not listed here show above the form's buttons.
 */
export const STAFF_ERROR_FIELDS: Record<string, keyof StaffFormErrors> = {
  staff_name_required: 'name',
  staff_email_invalid: 'email',
  email_taken: 'email',
  staff_already_exists: 'email',
  staff_invite_pending: 'email',
  staff_phone_invalid: 'phone',
  aid_type_ids_required: 'aidTypeIds',
  aid_type_id_invalid: 'aidTypeIds',
  too_many_aid_types: 'aidTypeIds',
};
