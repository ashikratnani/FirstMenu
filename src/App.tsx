import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAppState } from './state/AppProvider';
import Layout from './ui/components/Layout';
import Home from './ui/pages/Home';
import Recipes from './ui/pages/Recipes';
import RecipeDetail from './ui/pages/RecipeDetail';
import RecipeEditor from './ui/pages/RecipeEditor';
import Foods from './ui/pages/Foods';
import Prep from './ui/pages/Prep';
import Grocery from './ui/pages/Grocery';
import Share from './ui/pages/Share';
import SharedView from './ui/pages/SharedView';
import Print from './ui/pages/Print';
import Settings from './ui/pages/Settings';
import Onboarding from './ui/pages/Onboarding';
import Sources from './ui/pages/Sources';

// Onboarding gate (Task 7.1, Req 1.1): until the child profile is set
// (state.onboarded), every route except /onboarding (and /shared/* read-only
// views) redirects to /onboarding so a first-run user reaches setup instead of
// an empty plan. Rendered inside Layout so the app shell (and its first-run
// disclaimer) is never blanked. Routes under <SharedView> stay reachable
// un-onboarded so a share link can be opened without a local profile.
function OnboardingGate() {
  const { onboarded } = useAppState();
  const { pathname } = useLocation();
  const exempt =
    pathname === '/onboarding' || pathname.startsWith('/shared/');
  if (!onboarded && !exempt) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}

// Full route table (design "Source layout"). All pages render inside the shared
// Layout (app shell: skip link, header, nav, <main>, footer). Pages that belong
// to later tasks are minimal placeholders for now; the Sources page is replaced
// with a generated version in Task 6.2.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route element={<OnboardingGate />}>
        <Route path="/" element={<Home />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipes/new" element={<RecipeEditor />} />
        <Route path="/recipes/:id" element={<RecipeDetail />} />
        <Route path="/recipes/:id/edit" element={<RecipeEditor />} />
        <Route path="/foods" element={<Foods />} />
        <Route path="/prep" element={<Prep />} />
        <Route path="/grocery" element={<Grocery />} />
        <Route path="/share" element={<Share />} />
        <Route path="/shared/:data" element={<SharedView />} />
        <Route path="/print" element={<Print />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/sources" element={<Sources />} />
        </Route>
      </Route>
    </Routes>
  );
}
