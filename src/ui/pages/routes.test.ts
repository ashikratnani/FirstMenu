import { describe, expect, it } from 'vitest';
import * as eager from './routes.eager';

// routes.ts (lazy, used by the app) and routes.eager.ts (used by tests) must
// export exactly the same pages. Read routes.ts as text, because importing it
// here would resolve to the real lazy module only outside the App alias.
import routesSource from './routes.ts?raw';

describe('page route modules', () => {
  it('lazy and eager route files export the same page names', () => {
    const lazyNames = [...routesSource.matchAll(/export const (\w+) = lazy/g)]
      .map((m) => m[1])
      .sort();
    expect(lazyNames).toEqual(Object.keys(eager).sort());
  });
});
