// "One primary button per screen" (Requirement 17.10). A page that shows its
// own filled primary button calls `usePagePrimaryAction(true)` while it does;
// the shell then draws its "Add recipe" button as secondary. Lives apart from
// PrimaryAction.tsx so that file only exports a component (react-refresh).

import { createContext, useContext, useLayoutEffect } from 'react';

export interface PrimaryActionContextValue {
  /** True while at least one page reports its own primary button. */
  active: boolean;
  /** Report a primary button; returns the function that withdraws the report. */
  register: () => () => void;
}

export const PrimaryActionContext = createContext<PrimaryActionContextValue | null>(null);

/**
 * Call from a page while it shows its own filled primary button. Pass `false`
 * (or leave the page) and the shell's "Add recipe" button is primary again.
 * Outside a provider (a page rendered on its own in a test) it does nothing.
 */
export function usePagePrimaryAction(active: boolean): void {
  const register = useContext(PrimaryActionContext)?.register;
  useLayoutEffect(() => {
    if (!active || !register) return undefined;
    return register();
  }, [active, register]);
}

/** True while a page reports its own primary button. Used by the shell. */
export function usePrimaryActionActive(): boolean {
  return useContext(PrimaryActionContext)?.active ?? false;
}
