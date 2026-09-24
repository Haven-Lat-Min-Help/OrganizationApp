import { Link } from 'react-router-dom';
import styles from './AddBranchCard.module.css';

/** Dashed call-to-action tile that closes the branches grid. */
export function AddBranchCard() {
  return (
    <Link to="/branches/new" className={styles.card}>
      <span className={styles.plus} aria-hidden="true">
        +
      </span>
      <span className={styles.title}>Add a branch</span>
      <span className={styles.hint}>Name, address, registration ID, hospital types</span>
    </Link>
  );
}
