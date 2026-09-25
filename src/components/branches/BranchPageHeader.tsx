import type { ReactNode } from 'react';
import { PageHeader, type PageTab } from '../layout/PageHeader';

const BRANCH_TABS: PageTab[] = [
  { label: 'Overview', path: '/home' },
  { label: 'Staff', path: '/staff' },
  { label: 'Dashboard', path: '/dashboard' },
];

/**
 * Header band shared by every branch-admin screen: same PageHeader as the
 * organization pages, with the branch tabs. Each screen supplies its own
 * title, meta line and page actions (e.g. Add staff on the Staff page).
 */
export function BranchPageHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return <PageHeader title={title} meta={meta} actions={actions} tabs={BRANCH_TABS} />;
}
