import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: vi.fn(),
    shutdown: vi.fn(),
  })),
  loggerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { error: mocks.loggerError },
}));

vi.mock("posthog-node", () => ({
  PostHog: mocks.PostHog,
}));

describe("server - posthogServerClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Clean up globalThis between tests
    const g = globalThis as Record<string, unknown>;
    delete g.posthogServerClient;
    delete g.posthogHandlersRegistered;
  });

  test("returns null when POSTHOG_KEY is not set", async () => {
    vi.doMock("@/lib/constants", () => ({
      POSTHOG_KEY: undefined,
    }));

    const { posthogServerClient } = await import("./server");
    expect(posthogServerClient).toBeNull();
    expect(mocks.PostHog).not.toHaveBeenCalled();
  });

  test("creates PostHog client when POSTHOG_KEY is set", async () => {
    vi.doMock("@/lib/constants", () => ({
      POSTHOG_KEY: "phc_test_key",
    }));

    const { posthogServerClient } = await import("./server");
    expect(posthogServerClient).not.toBeNull();
    expect(mocks.PostHog).toHaveBeenCalledWith("phc_test_key", {
      host: "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  });

  test("reuses client from globalThis in development", async () => {
    const fakeClient = { capture: vi.fn(), shutdown: vi.fn() };
    (globalThis as Record<string, unknown>).posthogServerClient = fakeClient;

    vi.doMock("@/lib/constants", () => ({
      POSTHOG_KEY: "phc_test_key",
    }));

    const { posthogServerClient } = await import("./server");
    expect(posthogServerClient).toBe(fakeClient);
    expect(mocks.PostHog).not.toHaveBeenCalled();
  });
});
