// Mirrors GET /staff/me/call-stats and GET /staff/me/calls
// (Backend/src/controllers/callController.ts).

/** Rolling windows: the last 24 hours, 7 days or 30 days. */
export type CallStatsPeriod = 'day' | 'week' | 'month';

export interface CallStats {
  period: CallStatsPeriod;
  /** Calls that rang for this staff member. */
  rung: number;
  /** Of those, the ones they answered. Never more than rung. */
  accepted: number;
}

export interface AnsweredCall {
  id: string;
  status: 'ongoing' | 'completed' | 'dropped';
  rang_at: string;
  answered_at: string;
  /** Null while the call is still going. */
  duration_seconds: number | null;
  aid_type_names: string[];
}

export interface AnsweredCallsPage {
  calls: AnsweredCall[];
  /** Cursor for the next page; null on the last one. */
  next_before: string | null;
}

// Mirrors GET /staff/calls (branch admin): every call their branch answered.

export interface BranchCall extends AnsweredCall {
  /** Who answered it. Null once that staff member's account is deleted. */
  staff_name: string | null;
}

export interface BranchCallsCursor {
  before: string;
  before_id: string;
}

export interface BranchCallsPage {
  calls: BranchCall[];
  /** Cursor for the next page; null on the last one. */
  next_cursor: BranchCallsCursor | null;
}
