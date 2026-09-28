// Mirrors the rows of list_branch_staff() (Backend/supabase/migrations/
// 20260924040000_staff_list_resend_conflict.sql), returned by GET /staff,
// GET /staff/me, PATCH /staff/:id and POST /staff/:id/resend-invite.

/**
 * Where a staff member's invite stands. pending = invite sent and usable;
 * expired = past its expiry (the branch admin may resend); active = the
 * invitee has set a password. Computed by the backend at read time.
 */
export type StaffStatus = 'pending' | 'expired' | 'active';

export interface StaffAidType {
  id: string;
  name: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: StaffStatus;
  /** When the invite stops working; null once the staff member is active. */
  invite_expires_at: string | null;
  created_at: string;
  /** Sorted by name; never null, at least one for any valid staff member. */
  aid_types: StaffAidType[];
}

// Mirrors list_org_staff() (Backend/supabase/migrations/
// 20260928010000_org_staff_and_dashboard.sql), returned by
// GET /organizations/me/staff — the org admin's read-only list.

export interface OrgStaffMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: StaffStatus;
  created_at: string;
  /** Null only if the branch is gone or outside the org (the data is inconsistent). */
  branch: { id: string; name: string } | null;
  aid_types: StaffAidType[];
}

export interface OrgStaffPage {
  staff: OrgStaffMember[];
  /** Staff across every page. */
  total: number;
  /** 1-based. */
  page: number;
  page_size: number;
}

/**
 * A one-off message handed to the Staff page through navigation state (e.g.
 * after an invite). warn = something still needs doing, like a failed email.
 */
export interface StaffNotice {
  text: string;
  warn: boolean;
}
