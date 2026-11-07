// Storage-unavailable banner (Task 6.2, Req 12.7). When changes cannot be
// persisted, the app keeps working in memory and shows a banner with the exact
// design wording (design.md "Error Handling"). Reads `storageBanner` from
// context so it appears on every page via the Layout.

import { useApp } from '../../state/AppProvider';
import styles from './StorageBanner.module.css';

// Exact wording from design.md "Error Handling"; do not reword.
export const STORAGE_UNAVAILABLE_MESSAGE =
  "Changes can't be saved on this device.";

export default function StorageBanner() {
  const { storageBanner } = useApp();
  if (!storageBanner) return null;

  return (
    <div className={styles.banner} role="status">
      {STORAGE_UNAVAILABLE_MESSAGE}
    </div>
  );
}
