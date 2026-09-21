import { vi } from "vitest";

/**
 * Shared `posthog-js` stand-in for browser-side analytics tests. Import it first (it carries the
 * `vi.mock`), then drive `mockPosthog.__loaded` and assert on `mockPosthog.capture`.
 */
export const mockPosthog = {
  __loaded: false,
  capture: vi.fn(),
  getFeatureFlag: vi.fn(),
};

vi.mock("posthog-js", () => ({ default: mockPosthog }));
