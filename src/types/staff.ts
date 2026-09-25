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

/**
 * A one-off message handed to the Staff page through navigation state (e.g.
 * after an invite). warn = something still needs doing, like a failed email.
 */
export interface StaffNotice {
  text: string;
  warn: boolean;
}
