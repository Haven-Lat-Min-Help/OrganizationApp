import { Link } from 'react-router-dom';
import type { Branch, BranchAdmin } from '../../types/branch';
import styles from './BranchCard.module.css';

function adminLabel(admin: BranchAdmin | null | undefined): string {
  if (!admin) return 'Not invited';
  if (admin.status === 'active') return admin.name;
  if (admin.status === 'pending') return `${admin.name} (invited)`;
  return 'Invite expired';
}

/**
 * One branch in the org admin's Branches grid: name + active/inactive pill, the
 * address, its hospital-type chips, and a footer with the branch admin's state
 * and a link to the branch page. typeNames maps hospital_type_id → name (the
 * branch only carries ids).
 */
export function BranchCard({ branch, typeNames }: { branch: Branch; typeNames: Map<string, string> }) {
  const address = [branch.address_line1, branch.city, branch.state, branch.pincode].filter(Boolean).join(', ');
  const chips = branch.hospital_type_ids.map((id) => typeNames.get(id)).filter((name): name is string => !!name);

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <h2 className={styles.name}>{branch.name}</h2>
        <span className={`${styles.status} ${branch.is_active ? styles.statusLive : styles.statusReview}`}>
          {branch.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className={styles.contact}>{address ? <p>{address}</p> : <p>No address added</p>}</div>

      <ul className={styles.chips} aria-label="Hospital types">
        {chips.length > 0 ? (
          chips.map((name) => (
            <li key={name} className={styles.chip}>
              {name}
            </li>
          ))
        ) : (
          <li className={`${styles.chip} ${styles.chipEmpty}`}>No hospital types set</li>
        )}
      </ul>

      <div className={styles.footer}>
        <span className={styles.stat}>
          Admin <strong className={styles.statValue}>{adminLabel(branch.admin)}</strong>
        </span>
        <Link to={`/branches/${branch.id}`} className={styles.action}>
          View
        </Link>
      </div>
    </article>
  );
}
