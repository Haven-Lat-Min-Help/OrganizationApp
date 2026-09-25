import type { ReactNode } from 'react';
import { PageHeader, type PageTab } from '../layout/PageHeader';

// Call details and Accept call have no backend yet — shown disabled (no path),
// like the unbuilt tabs on the organization pages.
const STAFF_TABS: PageTab[] = [
  { label: 'Overview', path: '/home' },
  { label: 'Call details' },
  { label: 'Accept call' },
];

/**
 * Header band for every staff screen: same PageHeader as the organization and
 * branch-admin pages, with the staff tabs. Each screen supplies its own title
 * and meta line.
 */
export function StaffPageHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return <PageHeader title={title} meta={meta} actions={actions} tabs={STAFF_TABS} />;
}
