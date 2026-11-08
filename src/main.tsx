import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './state/AppProvider';
import ThemeRoot from './ui/theme/ThemeRoot';
import './ui/theme.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// HashRouter keeps routing client-side so GitHub Pages always serves index.html
// (see design.md: Pages has no server-side rewrites).
createRoot(rootElement).render(
  <StrictMode>
    <ThemeRoot>
      <HashRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </HashRouter>
    </ThemeRoot>
  </StrictMode>,
);
