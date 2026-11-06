import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

// Trivial smoke test proving the Vitest + React Testing Library harness works
// and that HashRouter-style routing renders the Home route (Task 1 deliverable).
describe('App', () => {
  it('renders the home page heading', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: /firstmenu/i }),
    ).toBeInTheDocument();
  });

  it('shows the not-medical-advice disclaimer', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText(/not medical advice/i)).toBeInTheDocument();
  });
});
