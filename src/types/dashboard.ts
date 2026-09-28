// Mirrors org_dashboard() (Backend/supabase/migrations/
// 20260928010000_org_staff_and_dashboard.sql), returned by
// GET /organizations/me/dashboard. Call figures cover the last 30 days (IST).

export interface DashboardStaff {
  active: number;
  /** Live: read from the socket server when the dashboard was generated. */
  on_duty: number;
  pending_invites: number;
  expired_invites: number;
}

export interface DashboardCalls {
  /** Calls that rang at least one of the org's staff (or that a branch answered). */
  reached: number;
  /** Of those, the ones one of the org's branches answered. */
  answered: number;
  /** Rang and nobody anywhere answered in time. */
  missed: number;
  /** Answered here, then the connection was lost. */
  dropped: number;
  /** Null when nothing was answered. */
  avg_answer_seconds: number | null;
  /** Null when no answered call has completed. */
  avg_talk_seconds: number | null;
}

export interface DashboardDay {
  /** YYYY-MM-DD, an IST calendar day. */
  day: string;
  reached: number;
  answered: number;
}

export interface DashboardAidMix {
  name: string;
  calls: number;
}

export interface DashboardBranch {
  id: string;
  name: string;
  is_active: boolean;
  has_admin: boolean;
  has_location: boolean;
  has_phone: boolean;
  active_staff: number;
  on_duty: number;
  pending_invites: number;
  expired_invites: number;
  answered: number;
  avg_answer_seconds: number | null;
}

export interface OrgDashboard {
  staff: DashboardStaff;
  calls: DashboardCalls;
  /** Always 30 entries, oldest first; days with no calls are zeros. */
  daily: DashboardDay[];
  /** Most calls first. A call with two aid types counts once for each. */
  aid_mix: DashboardAidMix[];
  /** Aid types no active staff member of an active branch can take. */
  uncovered_aid_types: string[];
  /** Active branches first, then oldest first. */
  branches: DashboardBranch[];
  generated_at: string;
}
