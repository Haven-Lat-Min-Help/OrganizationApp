import styles from './Detail.module.css';

/** Read-only label + value pair; an empty value renders a muted "Not set". */
export function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={styles.detail}>
      <span className={styles.label}>{label}</span>
      <p className={`${styles.value} ${value ? '' : styles.empty}`}>{value || 'Not set'}</p>
    </div>
  );
}
