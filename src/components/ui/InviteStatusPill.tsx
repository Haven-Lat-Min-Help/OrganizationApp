import styles from './InviteStatusPill.module.css';

/** Where an invited person stands — same three states for branch admins and staff. */
export type InviteStatus = 'pending' | 'expired' | 'active';

const STATUS: Record<InviteStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: styles.good },
  pending: { label: 'Invite pending', className: styles.warn },
  expired: { label: 'Invite expired', className: styles.muted },
};

/**
 * Status pill for an invited person: the branch admin block on BranchDetail
 * and each row of the staff table. Expired is muted rather than red — it
 * needs action, it isn't an emergency (red is reserved for critical status).
 */
export function InviteStatusPill({ status }: { status: InviteStatus }) {
  const { label, className } = STATUS[status];
  return <span className={`${styles.pill} ${className}`}>{label}</span>;
}
