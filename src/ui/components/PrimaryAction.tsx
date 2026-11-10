// Provider for the page-reported primary action (Requirement 17.10). The
// shell (Layout) wraps its routed pages in this, replacing the trial's
// pathname-based `addRecipeVariant`, which could not see page state.

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { PrimaryActionContext } from './primaryActionContext';

export function PrimaryActionProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const register = useCallback(() => {
    setCount((n) => n + 1);
    return () => setCount((n) => n - 1);
  }, []);
  const value = useMemo(() => ({ active: count > 0, register }), [count, register]);
  return <PrimaryActionContext.Provider value={value}>{children}</PrimaryActionContext.Provider>;
}
