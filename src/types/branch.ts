// Mirrors the branch responses in Backend/src/controllers/branchController.ts
// (BRANCH_COLUMNS, with the embedded branch_hospital_types rows flattened into
// hospital_type_ids).

/**
 * The branch's admin and where their invite stands. Sent to org admins only.
 * pending = invite sent and usable; expired = sent but past its expiry (the org
 * admin may re-invite); active = the invitee has set a password.
 */
export interface BranchAdmin {
  name: string;
  email: string | null;
  phone: string | null;
  status: 'pending' | 'expired' | 'active';
}

export interface Branch {
  id: string;
  name: string;
  org_id: string;
  org_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  admin_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  hospital_type_ids: string[];
  /** Present for org admins only; null when no admin has been invited yet. */
  admin?: BranchAdmin | null;
}
