import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../../state/AppProvider';
import StorageBanner, { STORAGE_UNAVAILABLE_MESSAGE } from './StorageBanner';

/**
 * A Map-backed Storage. When `throwOnSet` is true, setItem throws so
 * AppProvider's storage probe reports storage unavailable (Req 12.7), which
 * drives `storageBanner` true.
 */
function makeStorage(opts: { throwOnSet?: boolean } = {}): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => map.delete(k),
    setItem: (k: string, v: string) => {
      if (opts.throwOnSet) {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      map.set(k, v);
    },
  } satisfies Storage;
}

describe('StorageBanner', () => {
  it('shows the exact wording when storage is unavailable', () => {
    render(
      <AppProvider storage={makeStorage({ throwOnSet: true })}>
        <StorageBanner />
      </AppProvider>,
    );
    expect(screen.getByText(STORAGE_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    // Guard against drift from the design.md "Error Handling" wording.
    expect(STORAGE_UNAVAILABLE_MESSAGE).toBe(
      "Changes can't be saved on this device.",
    );
  });

  it('is absent when storage is available', () => {
    render(
      <AppProvider storage={makeStorage()}>
        <StorageBanner />
      </AppProvider>,
    );
    expect(
      screen.queryByText(STORAGE_UNAVAILABLE_MESSAGE),
    ).not.toBeInTheDocument();
  });
});
