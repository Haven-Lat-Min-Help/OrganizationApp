import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './PageHeader.module.css';

export interface PageTab {
  label: string;
  /** Present = a real route (rendered as a NavLink); absent = not built yet. */
  path?: string;
}

interface PageHeaderProps {
  title: string;
  /** Line under the title — plain text or rich (e.g. with an emphasized reg. number). */
  meta?: ReactNode;
  actions?: ReactNode;
  tabs?: PageTab[];
}

/**
 * White band under the top bar: page title, meta line, page-level actions and
 * an optional tab row. Tabs without a `path` render visibly disabled — surfaced,
 * not hidden — so the navigation matches the design without pretending pages
 * exist that haven't been built.
 */
export function PageHeader({ title, meta, actions, tabs }: PageHeaderProps) {
  return (
    <div className={styles.band}>
      <div className={styles.inner}>
        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{title}</h1>
            {meta && <p className={styles.meta}>{meta}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>

        {tabs && (
          <nav className={styles.tabs} aria-label="Sections">
            {tabs.map(({ label, path }) =>
              path ? (
                <NavLink
                  key={label}
                  to={path}
                  className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}
                >
                  {label}
                </NavLink>
              ) : (
                <button
                  key={label}
                  type="button"
                  className={styles.tab}
                  disabled
                  title={`${label} — coming soon`}
                >
                  {label}
                </button>
              ),
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
