import type { ReactNode } from 'react';
import { PageHeader, type PageTab } from '../layout/PageHeader';
import { Button } from '../ui/Button';

const BRANCH_TABS: PageTab[] = [
  { label: 'Overview', path: '/home' },
  { label: 'Staff', path: '/staff' },
  { label: 'Dashboard', path: '/dashboard' },
];

/**
 * Header band shared by every branch-admin screen: same PageHeader as the
 * organization pages, with the branch tabs and the Add staff action. Each
 * screen supplies its own title and meta line.
 *
 * Add staff is disabled until the staff invite flow exists on the backend —
 * shown, not hidden, like the unbuilt tabs on the organization pages.
 */
export function BranchPageHeader({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <PageHeader
      title={title}
      meta={meta}
      actions={
        <Button variant="dark" size="sm" disabled title="Add staff — coming soon">
          + Add staff
        </Button>
      }
      tabs={BRANCH_TABS}
    />
  );
}
