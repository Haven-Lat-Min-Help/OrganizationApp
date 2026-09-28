import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { useOptionalBranch } from '../../context/BranchContext';
import { useOrganization } from '../../context/OrganizationContext';
import styles from './OrgHeader.module.css';

// Titles skipped so "Dr. Anusiya" reads "A", not "DA".
const TITLES = new Set(['dr', 'mr', 'mrs', 'ms', 'miss', 'prof']);

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word && !TITLES.has(word.replace(/\.$/, '').toLowerCase()))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/**
 * Top bar of the partner portal: Haven wordmark + "partner" tag, the signed-in
 * organization's name (plus the branch name for a branch admin or staff member) and active
 * status (from OrganizationProvider), and the account menu (profile / sign out).
 */
export function OrgHeader() {
  const { organization } = useOrganization();
  // Present for a branch admin or staff member (BranchScope); null for the org admin.
  const branch = useOptionalBranch();
  const [userName, setUserName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // The avatar shows the signed-in person's initials (RLS: a user can read their own profile row).
  useEffect(() => {
    let cancelled = false;

    async function loadName() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase.from('profiles').select('name').eq('id', session.user.id).single();
      if (!cancelled && data) setUserName(data.name);
    }

    loadName();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.assign('/login');
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/home" className={styles.brand}>
          <span className={styles.wordmark}>Haven</span>
          <span className={styles.partnerTag}>partner</span>
        </Link>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.orgName}>
          {organization?.name}
          {branch && ` · ${branch.name}`}
        </span>

        <div className={styles.right}>
          {organization?.is_active && (
            <span className={styles.accepting}>
              <span className={styles.acceptingDot} aria-hidden="true" />
              Active
            </span>
          )}

          <div className={styles.menuWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.avatar}
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              {userName ? initials(userName) : ''}
            </button>
            {menuOpen && (
              <div className={styles.menu} role="menu">
                <Link to="/profile" className={styles.menuItem} role="menuitem" onClick={() => setMenuOpen(false)}>
                  Profile
                </Link>
                <button type="button" className={styles.menuItem} role="menuitem" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
