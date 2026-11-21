// Test-only helper. The "-spec.ts" suffix keeps it out of the production build
// (tsconfig.build.json excludes **/*spec.ts) without being picked up as a test.
/**
 * `Test.createTestingModule(...).useMocker(autoMock)`: every dependency that
 * isn't provided explicitly becomes an object whose properties are jest.fn().
 * Same idea as the inline helper in the repo's smoke specs, typed.
 */
export const autoMock = (): Record<PropertyKey, jest.Mock> =>
  new Proxy({} as Record<PropertyKey, jest.Mock>, {
    get: (target, prop) => {
      if (prop === 'then') return undefined; // not a thenable
      if (!(prop in target)) target[prop] = jest.fn();
      return target[prop];
    },
  });
