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
import StorageBanner from './StorageBanner';

/** Primary navigation entries. Task 9 regroups these under Make and Plan. */
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

function isActive(pathname: string, to: string, end?: boolean): boolean {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
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

  const topNav = (
    <TopNav
      label="Primary"
      heading={<TopNavHeading heading="FirstMenu" headingHref="/" />}
      endContent={
        <Button label="Add recipe" variant="primary" href="/recipes/new" />
      }
    >
      {NAV_ITEMS.map((item) => (
        <TopNavItem
          key={item.to}
          label={item.label}
          href={item.to}
          isSelected={isActive(pathname, item.to, item.end)}
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
