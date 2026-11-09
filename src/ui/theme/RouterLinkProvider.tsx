// Makes every Astryx link (TopNavItem, Button with href, ClickableCard, ...)
// render as a React Router <Link>, so navigation stays client-side under
// HashRouter (GitHub Pages has no server-side rewrites).
//
// Astryx passes `href`; React Router wants `to`. External URLs (http/https)
// are rendered as plain anchors so they never go through the router.

import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LinkProvider } from '@astryxdesign/core/Link';

type RouterLinkProps = Omit<ComponentProps<'a'>, 'href'> & {
  href?: string;
  to?: string;
};

function RouterLink({ href, to, ...rest }: RouterLinkProps) {
  const target = href ?? to ?? '';
  if (/^https?:\/\//.test(target)) {
    return <a href={target} {...rest} />;
  }
  return <Link to={target} {...rest} />;
}

export default function RouterLinkProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <LinkProvider component={RouterLink}>{children}</LinkProvider>;
}
