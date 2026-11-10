import { expect, vi } from 'vitest';

/**
 * Spies on every way a page could talk to the network (fetch, XMLHttpRequest,
 * navigator.sendBeacon). Call `expectNoNetwork()` at the end of a flow.
 */
export function spyOnNetwork() {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open');
  const xhrSend = vi.spyOn(XMLHttpRequest.prototype, 'send');
  const beacon = vi.fn().mockReturnValue(true);
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  return {
    expectNoNetwork() {
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrOpen).not.toHaveBeenCalled();
      expect(xhrSend).not.toHaveBeenCalled();
      expect(beacon).not.toHaveBeenCalled();
    },
  };
}
