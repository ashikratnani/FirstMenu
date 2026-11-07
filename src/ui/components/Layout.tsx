// The app shell (Task 6.1): a skip-to-content link, a header with the app
// name, a keyboard-navigable primary nav, a <main> landmark that renders the
// routed page via <Outlet/>, and a footer disclaimer. Task 6.2 adds the
// footer disclaimer (Req 13.1/13.2), the first-run disclaimer (Req 13.1) and
// the storage-unavailable banner (Req 12.7), all rendered here so they appear
// on every page.
//
// Nav uses real NavLink anchors so it is reachable and operable by keyboard;
// the active route is marked with aria-current="page" (Req 14.4).

import { useRef } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import styles from './Layout.module.css';
import Disclaimer, { FirstRunDisclaimer } from './Disclaimer';
import StorageBanner from './StorageBanner';

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
  // Under HashRouter a plain href="#main" mutates the hash and is interpreted
  // as a route change (to /main), which matches nothing and blanks the page.
  // Instead we preventDefault and move focus to <main> directly (Req 14.4).
  const mainRef = useRef<HTMLElement>(null);

  return (
    <div className={styles.shell}>
      <a
        className={styles.skipLink}
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
          mainRef.current?.scrollIntoView?.();
        }}
      >
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

      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        {/* Storage-unavailable banner (Req 12.7) and first-run disclaimer
            (Req 13.1) show above the routed page on every route. */}
        <StorageBanner />
        <FirstRunDisclaimer />
        <Outlet />
      </main>

      {/* Footer disclaimer renders on every page (Req 13.1, 13.2). */}
      <footer className={styles.footer}>
        <Disclaimer />
      </footer>
    </div>
  );
}
