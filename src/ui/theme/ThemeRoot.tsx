// Astryx theme root (active spec Requirement 15). Wraps the whole app in the
// Astryx <Theme> with the neutral theme plus FirstMenu's color overrides.
//
// Everything here ships with the app (Requirement 15.4):
// - Astryx component and theme CSS come from node_modules and are bundled.
// - Figtree (body) and Fredoka (headings, 600 latin only) are self-hosted
//   through @fontsource. The Astryx docs show a Google Fonts link; we never use it.

import type { ReactNode } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/fredoka/latin-600.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import './firstmenu.css';

export default function ThemeRoot({ children }: { children: ReactNode }) {
  // Light mode only: the FirstMenu palette has no dark variant yet.
  return (
    <Theme theme={neutralTheme} mode="light">
      {children}
    </Theme>
  );
}
