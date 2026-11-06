import { Route, Routes } from 'react-router-dom';
import Home from './ui/pages/Home';

// Minimal route table for Task 1. Later tasks add the full set of pages
// (Recipes, Foods, Prep, Grocery, Share, Print, Settings, Onboarding, Sources).
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
