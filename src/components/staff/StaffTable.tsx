import { Link } from 'react-router-dom';
import type { StaffMember } from '../../types/staff';
import { InviteStatusPill } from '../ui/InviteStatusPill';
import styles from './StaffTable.module.css';

/** Shown in any cell whose value is missing. */
const EMPTY = '-';

/**
 * The branch staff list as a table — display only; the page owns loading and
 * the data. Each row links to that staff member's page (/staff/:id), where
 * their full details and actions (Resend) live. Stays a table at every width: on a narrow screen the table
 * scrolls sideways inside its own box rather than pushing the whole page
 * wider. The box is focusable so keyboard users can scroll it too.
 */
export function StaffTable({ staff }: { staff: StaffMember[] }) {
  return (
    <div className={styles.scroll} role="region" aria-label="Branch staff" tabIndex={0}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Phone</th>
            <th scope="col">Aid types</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className={styles.srOnly}>Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr key={member.id}>
              <td className={styles.name}>{member.name}</td>
              <td>{member.email || EMPTY}</td>
              <td>{member.phone || EMPTY}</td>
              <td>{member.aid_types.map((aidType) => aidType.name).join(', ') || EMPTY}</td>
              <td>
                <InviteStatusPill status={member.status} />
              </td>
              <td className={styles.actions}>
                <Link to={`/staff/${member.id}`} className={styles.view} aria-label={`View ${member.name}`}>
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
