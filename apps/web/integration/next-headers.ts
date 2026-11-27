/**
 * A stand-in for `next/headers`, which only Next.js fills, answering with the headers of the request a
 * test is sending through `callRoute` (`api-routes.ts`). Session routes read the caller from it.
 *
 * ```ts
 * vi.mock("next/headers", async () => (await import("@/integration/next-headers")).nextHeadersMock);
 * ```
 *
 * It imports nothing on purpose: the mock factory runs while the app's modules are still loading, so a
 * module that pulled the app in here would wait on itself.
 */
let headersInFlight = new Headers();

export const setHeadersInFlight = (headers: Headers): void => {
  headersInFlight = headers;
};

export const nextHeadersMock = {
  headers: async () => headersInFlight,
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    delete: () => undefined,
  }),
};
