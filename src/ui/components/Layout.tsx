// The app shell (Task 6.1): a skip-to-content link, a header with the app
// name, a keyboard-navigable primary nav, a <main> landmark that renders the
// routed page via <Outlet/>, and a footer region. The footer disclaimer,
// first-run disclaimer and storage banner are added in Task 6.2; this leaves
// the footer slot in place.
//
// Nav uses real NavLink anchors so it is reachable and operable by keyboard;
// the active route is marked with aria-current="page" (Req 14.4).

import { Link, NavLink, Outlet } from 'react-router-dom';
import styles from './Layout.module.css';

/** Primary navigation entries (a subset of routes that make sense as nav). */
const NAV_ITEMS: ReadonlyArray<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Week', end: true },
  { to: '/recipes', label: 'Recipes' },
  { to: '/foods', label: 'Foods' },
  { to: '/prep', label: 'Prep' },
  { to: '/grocery', label: 'Grocery' },
  { to: '/share', label: 'Share' },
  { to: '/sources', label: 'Sources' },
  { to: '/settings', label: 'Settings' },
];

export default function Layout() {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>

      <header className={styles.header}>
        <h1 className={styles.appName}>
          <Link to="/">FirstMenu</Link>
        </h1>
        <nav className={styles.nav} aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={styles.navLink}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" className={styles.main}>
        <Outlet />
      </main>

      {/* Footer region; the disclaimer text is added in Task 6.2. */}
      <footer className={styles.footer} />
    </div>
  );
}
