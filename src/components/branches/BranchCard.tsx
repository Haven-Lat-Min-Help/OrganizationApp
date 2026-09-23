import type { Branch, BranchStatus, FooterStat } from '../../data/mockBranches';
import styles from './BranchCard.module.css';

const STATUS_LABELS: Record<BranchStatus, string> = {
  live: 'Live',
  night_gap: 'Night gap',
  in_review: 'In review',
};

const STATUS_CLASSES: Record<BranchStatus, string> = {
  live: styles.statusLive,
  night_gap: styles.statusGap,
  in_review: styles.statusReview,
};

function Stat({ stat }: { stat: FooterStat }) {
  return (
    <span className={styles.stat}>
      {stat.label}{' '}
      <strong className={stat.tone === 'critical' ? styles.statCritical : styles.statValue}>{stat.value}</strong>
    </span>
  );
}

/**
 * One branch in the Branches grid: name + status pill, contact block (or a
 * "what's missing" notice for branches still in review), capability chips and
 * a footer with a live figure on the left and a figure or call to action on
 * the right. "Night gap" is the one status that uses Haven's emergency red —
 * an unstaffed night shift is a genuine coverage gap, not decoration.
 */
export function BranchCard({ branch }: { branch: Branch }) {
  const { footerRight } = branch;

  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <h2 className={styles.name}>{branch.name}</h2>
        <span className={`${styles.status} ${STATUS_CLASSES[branch.status]}`}>{STATUS_LABELS[branch.status]}</span>
      </div>

      <div className={styles.contact}>
        {branch.address && <p>{branch.address}</p>}
        {branch.phone && <p>{branch.phone}</p>}
        {branch.notice && <p className={styles.notice}>{branch.notice}</p>}
      </div>

      <ul className={styles.chips} aria-label="Capabilities">
        {branch.capabilities.length > 0 ? (
          branch.capabilities.map((capability) => (
            <li key={capability} className={styles.chip}>
              {capability}
            </li>
          ))
        ) : (
          <li className={`${styles.chip} ${styles.chipEmpty}`}>No capabilities set</li>
        )}
      </ul>

      <div className={styles.footer}>
        <Stat stat={branch.footerLeft} />
        {'action' in footerRight ? (
          <button type="button" className={styles.action}>
            {footerRight.action}
          </button>
        ) : (
          <Stat stat={footerRight} />
        )}
      </div>
    </article>
  );
}
