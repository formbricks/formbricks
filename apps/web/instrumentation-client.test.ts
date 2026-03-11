import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockInit = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    init: mockInit,
  },
}));

describe("instrumentation-client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("initializes PostHog when NEXT_PUBLIC_POSTHOG_KEY is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("NODE_ENV", "production");

    await import("./instrumentation-client");

    expect(mockInit).toHaveBeenCalledOnce();
    expect(mockInit).toHaveBeenCalledWith("phc_test_key", {
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      defaults: "2026-01-30",
      capture_exceptions: true,
      debug: false,
    });
  });

  test("does not initialize PostHog when NEXT_PUBLIC_POSTHOG_KEY is not set", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");

    await import("./instrumentation-client");

    expect(mockInit).not.toHaveBeenCalled();
  });

  test("sets debug to true in development", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("NODE_ENV", "development");

    await import("./instrumentation-client");

    expect(mockInit).toHaveBeenCalledOnce();
    expect(mockInit).toHaveBeenCalledWith("phc_test_key", {
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      defaults: "2026-01-30",
      capture_exceptions: true,
      debug: true,
    });
  });

  test("sets debug to false in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("NODE_ENV", "production");

    await import("./instrumentation-client");

    expect(mockInit).toHaveBeenCalledOnce();
    expect(mockInit.mock.calls[0][1].debug).toBe(false);
  });

  test("passes the correct api_host for reverse proxy", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");

    await import("./instrumentation-client");

    expect(mockInit.mock.calls[0][1].api_host).toBe("/ingest");
  });

  test("enables capture_exceptions", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");

    await import("./instrumentation-client");

    expect(mockInit.mock.calls[0][1].capture_exceptions).toBe(true);
  });

  test("does not initialize when key is empty string", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");

    await import("./instrumentation-client");

    expect(mockInit).not.toHaveBeenCalled();
  });
});
