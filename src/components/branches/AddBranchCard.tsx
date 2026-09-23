import styles from './AddBranchCard.module.css';

/** Dashed call-to-action tile that closes the branches grid. */
export function AddBranchCard() {
  return (
    <button type="button" className={styles.card}>
      <span className={styles.plus} aria-hidden="true">
        +
      </span>
      <span className={styles.title}>Add a branch</span>
      <span className={styles.hint}>Address, emergency line, capabilities</span>
    </button>
  );
}
