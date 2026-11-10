import { Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAppState } from './state/AppProvider';
import Layout from './ui/components/Layout';
// Pages load the first time they are opened (routes.ts, decision in issue
// #37). Tests get eager versions through an alias in vitest.config.ts.
import {
  Foods,
  Grocery,
  Make,
  Onboarding,
  Plan,
  Prep,
  Print,
  RecipeDetail,
  RecipeEditor,
  Recipes,
  Settings,
  Share,
  SharedView,
  Sources,
} from './ui/pages/routes';

// Onboarding gate (Task 7.1, Req 1.1): until the child profile is set
// (state.onboarded), every route except /onboarding redirects to /onboarding so
// a first-run user reaches setup instead of an empty plan. Rendered inside
// Layout so the app shell (and its first-run disclaimer) is never blanked. The
// /shared/:data read-only view is NOT under this gate at all — it is its own
// top-level route outside Layout (see below), so a share link opens for anyone,
// onboarded or not, with no primary nav or first-run chrome.
function OnboardingGate() {
  const { onboarded } = useAppState();
  const { pathname } = useLocation();
  const exempt = pathname === '/onboarding';
  if (!onboarded && !exempt) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}

/** Shown for the moment a page's code is loading. */
function PageLoading() {
  return (
    <p role="status" aria-live="polite">
      Loading…
    </p>
  );
}

/** Lets only the page area wait while its code loads; the shell stays. */
function PageOutlet() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Outlet />
    </Suspense>
  );
}

// Full route table (design "Source layout"). All pages render inside the shared
// Layout (app shell: skip link, header, nav, main, footer).
export default function App() {
  return (
    <Routes>
      {/* The read-only shared view is its own top-level route OUTSIDE Layout
          (Task 6 note): a clean recipient view with no primary nav and no
          first-run disclaimer chrome, naturally gate-exempt (Req 11.4). */}
      <Route
        path="/shared/:data"
        element={
          <Suspense fallback={<PageLoading />}>
            <SharedView />
          </Suspense>
        }
      />
      <Route element={<Layout />}>
        <Route element={<OnboardingGate />}>
          <Route element={<PageOutlet />}>
            <Route path="/" element={<Make />} />
            <Route path="/plan" element={<Plan />} />
            {/* Task 11.1 builds the Add recipe page here; until then it
                opens the typed editor. */}
            <Route
              path="/add"
              element={<Navigate to="/recipes/new" replace />}
            />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/recipes/new" element={<RecipeEditor />} />
            <Route path="/recipes/:id" element={<RecipeDetail />} />
            <Route path="/recipes/:id/edit" element={<RecipeEditor />} />
            <Route path="/foods" element={<Foods />} />
            <Route path="/prep" element={<Prep />} />
            <Route path="/grocery" element={<Grocery />} />
            <Route path="/share" element={<Share />} />
            <Route path="/print" element={<Print />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/sources" element={<Sources />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
