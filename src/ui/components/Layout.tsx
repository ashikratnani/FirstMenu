// The app shell, built on Astryx AppShell + TopNav (active spec Requirement 15).
//
// - TopNav carries the app name, the primary nav and ONE primary action,
//   "Add recipe", which stays visible on phones (maintainer UI feedback,
//   issue #36: primary actions must be clear and easy to reach).
// - Below the md breakpoint, AppShell moves the nav into an accessible drawer
//   (focus-trapped dialog with a toggle button).
// - AppShell renders the skip link and the main landmark itself.
// - The storage banner, first-run disclaimer and footer disclaimer still
//   render on every page (v1 Req 12.7, 13.1, 13.2).
//
// HashRouter note: AppShell's skip link is a plain fragment link. Under a hash
// router a raw fragment jump is read as a route change and blanks the page
// (v1 regression), so clicks on it are intercepted here and focus is moved to
// the main landmark directly (v1 Req 14.4).

import type { MouseEvent } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Button } from '@astryxdesign/core/Button';
import {
  TopNav,
  TopNavHeading,
  TopNavItem,
} from '@astryxdesign/core/TopNav';
import RouterLinkProvider from '../theme/RouterLinkProvider';
import styles from './Layout.module.css';
import Disclaimer, { FirstRunDisclaimer } from './Disclaimer';
import PlanNav from './PlanNav';
import { isPlanPath } from './planNav';
import StorageBanner from './StorageBanner';

/**
 * Primary navigation entries (Requirement 1.2), in order. `match` lists the
 * paths that mark an item as current: the Plan item also covers the prep,
 * grocery, share and print routes, and Add recipe covers the typed editor.
 */
const NAV_ITEMS: ReadonlyArray<{
  to: string;
  label: string;
  match: (pathname: string) => boolean;
}> = [
  { to: '/', label: 'Make', match: (p) => p === '/' },
  {
    to: '/recipes',
    label: 'My recipes',
    match: (p) =>
      (p === '/recipes' || p.startsWith('/recipes/')) && p !== '/recipes/new',
  },
  {
    to: '/add',
    label: 'Add recipe',
    match: (p) => p === '/add' || p === '/recipes/new',
  },
  { to: '/foods', label: 'Foods', match: (p) => p === '/foods' },
  { to: '/plan', label: 'Plan', match: isPlanPath },
  { to: '/sources', label: 'Sources', match: (p) => p === '/sources' },
  { to: '/settings', label: 'Settings', match: (p) => p === '/settings' },
];

/**
 * Each screen gets exactly one filled primary button (issue #36):
 * - hidden on the new-recipe editor (you are already there) and on
 *   onboarding (every route redirects there until setup is done);
 * - secondary on screens with their own primary action (Settings and edit
 *   Save, the Print button);
 * - primary everywhere else.
 */
function addRecipeVariant(pathname: string): 'primary' | 'secondary' | null {
  if (
    pathname === '/recipes/new' ||
    pathname === '/add' ||
    pathname === '/onboarding'
  ) {
    return null;
  }
  if (
    pathname === '/settings' ||
    pathname === '/print' ||
    pathname.endsWith('/edit')
  ) {
    return 'secondary';
  }
  return 'primary';
}

/** Intercept fragment links (the AppShell skip link) so HashRouter never sees them. */
function handleFragmentLinkClick(event: MouseEvent<HTMLDivElement>) {
  const anchor = (event.target as Element | null)?.closest?.('a[href^="#"]');
  if (!anchor) return;
  const href = anchor.getAttribute('href') ?? '';
  // Router links under HashRouter look like "#/recipes"; leave those alone.
  if (href.startsWith('#/')) return;
  const target = document.getElementById(href.slice(1));
  if (!target) return;
  event.preventDefault();
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus();
  target.scrollIntoView?.();
}

export default function Layout() {
  const { pathname } = useLocation();
  const addVariant = addRecipeVariant(pathname);

  const topNav = (
    <TopNav
      label="Primary"
      heading={<TopNavHeading heading="FirstMenu" headingHref="/" />}
      endContent={
        addVariant && (
          <Button label="Add recipe" variant={addVariant} href="/add" />
        )
      }
    >
      {NAV_ITEMS.map((item) => (
        <TopNavItem
          key={item.to}
          label={item.label}
          href={item.to}
          isSelected={item.match(pathname)}
        />
      ))}
    </TopNav>
  );

  return (
    <RouterLinkProvider>
      <div className={styles.root} onClickCapture={handleFragmentLinkClick}>
        <AppShell height="auto" variant="surface" topNav={topNav}>
          <div className={styles.content}>
            {/* Storage-unavailable banner (Req 12.7) and first-run disclaimer
                (Req 13.1) show above the routed page on every route. */}
            <StorageBanner />
            <FirstRunDisclaimer />
            {isPlanPath(pathname) && <PlanNav pathname={pathname} />}
            <Outlet />
          </div>
        </AppShell>

        {/* Footer disclaimer on every page (Req 13.1, 13.2). It sits outside
            AppShell so it stays a top-level contentinfo landmark. The print
            page carries its own disclaimer, so this one is hidden when
            printing. */}
        <footer className={`${styles.footer} print-hide`}>
          <Disclaimer />
        </footer>
      </div>
    </RouterLinkProvider>
  );
}
