// Sub-navigation for the Plan area (design "Plan (/plan)", Requirement 1.3):
// Week · Prep · Grocery · Share · Print. Layout shows it above the page on
// /plan, /prep, /grocery, /share and /print. Built on the Astryx TabList; with
// no `role` set it is a navigation landmark that marks the current link with
// aria-current.

import { Tab, TabList } from '@astryxdesign/core/TabList';
import { PLAN_NAV_ITEMS } from './planNav';
import styles from './PlanNav.module.css';

export default function PlanNav({ pathname }: { pathname: string }) {
  return (
    <div className={`${styles.root} print-hide`}>
      <TabList
        value={pathname}
        onChange={() => {}}
        hasDivider
        aria-label="Plan"
      >
        {PLAN_NAV_ITEMS.map((item) => (
          <Tab
            key={item.to}
            value={item.to}
            label={item.label}
            href={item.to}
          />
        ))}
      </TabList>
    </div>
  );
}
