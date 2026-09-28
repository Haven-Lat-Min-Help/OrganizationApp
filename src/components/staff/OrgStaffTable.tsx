import type { OrgStaffMember } from '../../types/staff';
import { formatDate } from '../../utils/formatDate';
import { InviteStatusPill } from '../ui/InviteStatusPill';
import styles from './StaffTable.module.css';

/** Shown in any cell whose value is missing. */
const EMPTY = '-';

/**
 * The org admin's staff list as a table — read-only and display only; the
 * page owns loading, paging and the data. Same look as the branch StaffTable,
 * plus the branch each person belongs to, and no row links: staff details and
 * actions belong to that branch's admin.
 */
export function OrgStaffTable({ staff }: { staff: OrgStaffMember[] }) {
  return (
    <div className={styles.scroll} role="region" aria-label="Organization staff" tabIndex={0}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Phone</th>
            <th scope="col">Branch</th>
            <th scope="col">Aid types</th>
            <th scope="col">Status</th>
            <th scope="col">Added on</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr key={member.id}>
              <td className={styles.name}>{member.name}</td>
              <td>{member.email || EMPTY}</td>
              <td>{member.phone || EMPTY}</td>
              <td>{member.branch?.name ?? EMPTY}</td>
              <td>{member.aid_types.map((aidType) => aidType.name).join(', ') || EMPTY}</td>
              <td>
                <InviteStatusPill status={member.status} />
              </td>
              <td className={styles.nowrap}>{formatDate(member.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
