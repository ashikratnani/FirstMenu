// Plan sub-navigation entries (design "Plan (/plan)", Requirement 1.3).

export const PLAN_NAV_ITEMS: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/plan', label: 'Week' },
  { to: '/prep', label: 'Prep' },
  { to: '/grocery', label: 'Grocery' },
  { to: '/share', label: 'Share' },
  { to: '/print', label: 'Print' },
];

/** True on the routes that belong to the Plan area. */
export function isPlanPath(pathname: string): boolean {
  return PLAN_NAV_ITEMS.some((item) => item.to === pathname);
}
