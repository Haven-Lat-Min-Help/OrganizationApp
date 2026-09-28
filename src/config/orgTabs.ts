import type { PageTab } from '../components/layout/PageHeader';

/**
 * Tab row shared by the organization admin's pages. /branches also stays
 * highlighted on /branches/new and /branches/:id, since NavLink matches by prefix.
 */
export const ORG_TABS: PageTab[] = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Overview', path: '/home' },
  { label: 'Branches', path: '/branches' },
  { label: 'Staff', path: '/staff' },
];
