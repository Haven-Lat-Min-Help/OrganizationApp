import type { PageTab } from '../components/layout/PageHeader';

/**
 * Tab row shared by the organization admin's pages. Tabs without a path are the
 * ones not built yet (shown disabled). /branches also stays highlighted on
 * /branches/new and /branches/:id, since NavLink matches by prefix.
 */
export const ORG_TABS: PageTab[] = [
  { label: 'Overview', path: '/home' },
  { label: 'Branches', path: '/branches' },
  { label: 'Staff' },
  { label: '24/7 shifts' },
  { label: 'Capabilities' },
  { label: 'Documents' },
];
