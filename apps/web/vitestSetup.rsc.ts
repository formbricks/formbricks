import { vi } from "vitest";

/**
 * Setup for the `rsc` Vitest project (ENG-2444), deliberately NOT the shared `vitestSetup.ts`.
 *
 * That file is unusable here for two reasons, and the second is the important one:
 *
 * 1. It imports `@testing-library/react`, which pulls `react-dom/client` — React refuses to load it
 *    under the `react-server` condition.
 * 2. **It mocks React's `cache` to the identity function** (`const testCache = (func) => func`). That
 *    is a sensible default for unit tests, and it is exactly what makes the `page` authorization
 *    surface untestable there: with `cache` stubbed out there is no request scope to hold the slot,
 *    so the surface always falls back to the async-scoped boundary and the ENG-2444 behaviour never
 *    runs. Keep this file free of a `react` mock.
 */
vi.mock("server-only", () => ({}));
