import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Vitest leaves import.meta.env.BASE_URL at "/" even though vite.config.ts
// serves the app from /FirstMenu/. Picture and license URLs are built from it
// (src/ui/components/artUrl.ts), so tests run with the real Pages base path.
vi.stubEnv('BASE_URL', '/FirstMenu/');

// jsdom does not implement the <dialog> methods that Astryx Dialog calls.
// Minimal stand-ins keep `open` in sync so dialog content is queryable.
if (typeof HTMLDialogElement !== 'undefined') {
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (typeof proto.show !== 'function') {
    proto.show = function show(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (typeof proto.close !== 'function') {
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
