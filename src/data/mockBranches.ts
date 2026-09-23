/**
 * MOCK DATA — placeholder for the organization portal's Branches tab.
 *
 * Backend has no endpoints for an organization's branches, responders, ICU
 * bed counts or licence review yet (it serves /organizations only to
 * super_admin — see Backend/src/routes). This file exists so the UI can be
 * built and reviewed now; swap it for real fetches once those endpoints
 * exist. Shapes are deliberately close to what an API response would look
 * like, to keep that swap mechanical.
 */

export interface OrganizationSummary {
  name: string;
  branchCount: number;
  responderCount: number;
  verifiedOn: string;
  registrationNumber: string;
  acceptingCases: boolean;
}

export type BranchStatus = 'live' | 'night_gap' | 'in_review';

/** A labelled figure in a card footer, e.g. "ICU beds — 4 free". */
export interface FooterStat {
  label: string;
  value: string;
  /** Reserved for genuine gaps (e.g. an unstaffed night shift) — Haven's emergency red. */
  tone?: 'critical';
}

export interface Branch {
  id: string;
  name: string;
  status: BranchStatus;
  address: string | null;
  phone: string | null;
  /** Shown in place of the address/phone block when the branch isn't live yet. */
  notice?: string;
  capabilities: string[];
  footerLeft: FooterStat;
  /** A figure, or a call to action when the branch needs something done. */
  footerRight: FooterStat | { action: string };
}

export const organization: OrganizationSummary = {
  name: 'Manipal Hospitals',
  branchCount: 5,
  responderCount: 62,
  verifiedOn: '12 Mar 2026',
  registrationNumber: 'KA-H-20481',
  acceptingCases: true,
};

export const branches: Branch[] = [
  {
    id: 'b-old-airport',
    name: 'Old Airport Road',
    status: 'live',
    address: '98 HAL Old Airport Rd, Bengaluru 560017',
    phone: '+91 80 2502 4444',
    capabilities: ['Trauma', 'Burns unit', 'Cardiac'],
    footerLeft: { label: 'ICU beds', value: '4 free' },
    footerRight: { label: 'Responders', value: '18' },
  },
  {
    id: 'b-whitefield',
    name: 'Whitefield',
    status: 'live',
    address: '143 EPIP Industrial Area, Bengaluru 560066',
    phone: '+91 80 6677 1111',
    capabilities: ['Trauma', 'Paediatric ER'],
    footerLeft: { label: 'ICU beds', value: '2 free' },
    footerRight: { label: 'Responders', value: '11' },
  },
  {
    id: 'b-sarjapur',
    name: 'Sarjapur Road',
    status: 'night_gap',
    address: 'Sarjapur Main Rd, Bengaluru 560035',
    phone: '+91 80 4888 2222',
    capabilities: ['Trauma'],
    footerLeft: { label: 'Night shift', value: '0 assigned', tone: 'critical' },
    footerRight: { action: 'Assign' },
  },
  {
    id: 'b-hebbal',
    name: 'Hebbal',
    status: 'live',
    address: '23 Bellary Rd, Bengaluru 560024',
    phone: '+91 80 2333 6666',
    capabilities: ['Cardiac', 'Stroke unit'],
    footerLeft: { label: 'ICU beds', value: '6 free' },
    footerRight: { label: 'Responders', value: '14' },
  },
  {
    id: 'b-yeshwanthpur',
    name: 'Yeshwanthpur',
    status: 'in_review',
    address: 'Tumkur Rd, Bengaluru 560022',
    phone: null,
    notice: 'Awaiting licence upload',
    capabilities: [],
    footerLeft: { label: 'Submitted', value: '2 days ago' },
    footerRight: { action: 'Upload licence' },
  },
];
