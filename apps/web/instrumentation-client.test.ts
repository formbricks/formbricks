/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockInit = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    init: mockInit,
  },
}));

const originalLocation = window.location;

function stubPathname(pathname: string) {
  Object.defineProperty(window, "location", {
    value: { ...originalLocation, pathname },
    writable: true,
    configurable: true,
  });
}

describe("instrumentation-client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  test("initializes PostHog when NEXT_PUBLIC_POSTHOG_KEY is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("NODE_ENV", "production");
    stubPathname("/environments/123/surveys");

    await import("./instrumentation-client");

    expect(mockInit).toHaveBeenCalledOnce();
    expect(mockInit).toHaveBeenCalledWith(
      "phc_test_key",
      expect.objectContaining({
        api_host: "/ingest",
        ui_host: "https://eu.posthog.com",
        defaults: "2026-01-30",
        capture_exceptions: true,
        debug: false,
        before_send: expect.any(Function),
      })
    );
  });

  test("does not initialize PostHog when NEXT_PUBLIC_POSTHOG_KEY is not set", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");

    await import("./instrumentation-client");

    expect(mockInit).not.toHaveBeenCalled();
  });

  test("sets debug to true in development", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("NODE_ENV", "development");
    stubPathname("/");

    await import("./instrumentation-client");

    expect(mockInit).toHaveBeenCalledOnce();
    expect(mockInit).toHaveBeenCalledWith(
      "phc_test_key",
      expect.objectContaining({
        api_host: "/ingest",
        ui_host: "https://eu.posthog.com",
        defaults: "2026-01-30",
        capture_exceptions: true,
        debug: true,
        before_send: expect.any(Function),
      })
    );
  });

  test("sets debug to false in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
    vi.stubEnv("NODE_ENV", "production");
    stubPathname("/");

    await import("./instrumentation-client");

    expect(mockInit).toHaveBeenCalledOnce();
    expect(mockInit.mock.calls[0][1].debug).toBe(false);
  });

  test("passes the correct api_host for reverse proxy", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
    stubPathname("/");

    await import("./instrumentation-client");

    expect(mockInit.mock.calls[0][1].api_host).toBe("/ingest");
  });

  test("enables capture_exceptions", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
    stubPathname("/");

    await import("./instrumentation-client");

    expect(mockInit.mock.calls[0][1].capture_exceptions).toBe(true);
  });

  test("does not initialize when key is empty string", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");

    await import("./instrumentation-client");

    expect(mockInit).not.toHaveBeenCalled();
  });

  describe("excluded pages (GDPR)", () => {
    test("does not initialize on /s/ survey pages", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
      stubPathname("/s/abc123");

      await import("./instrumentation-client");

      expect(mockInit).not.toHaveBeenCalled();
    });

    test("does not initialize on /c/ contact survey pages", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
      stubPathname("/c/some-jwt-token");

      await import("./instrumentation-client");

      expect(mockInit).not.toHaveBeenCalled();
    });

    test("does not initialize on /p/ pretty URL pages", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
      stubPathname("/p/my-survey-slug");

      await import("./instrumentation-client");

      expect(mockInit).not.toHaveBeenCalled();
    });

    test("does not initialize on /auth/login", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
      stubPathname("/auth/login");

      await import("./instrumentation-client");

      expect(mockInit).not.toHaveBeenCalled();
    });

    test("does not initialize on /auth/signup", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
      stubPathname("/auth/signup");

      await import("./instrumentation-client");

      expect(mockInit).not.toHaveBeenCalled();
    });

    test("does not initialize on /auth/forgot-password", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
      stubPathname("/auth/forgot-password");

      await import("./instrumentation-client");

      expect(mockInit).not.toHaveBeenCalled();
    });

    test("does not initialize on /invite", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
      stubPathname("/invite");

      await import("./instrumentation-client");

      expect(mockInit).not.toHaveBeenCalled();
    });

    test("does not initialize on /verify-email-change", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
      stubPathname("/verify-email-change");

      await import("./instrumentation-client");

      expect(mockInit).not.toHaveBeenCalled();
    });
  });

  describe("before_send (SPA navigation)", () => {
    test("drops events when user navigates to an excluded page after init", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
      stubPathname("/environments/123/surveys");

      await import("./instrumentation-client");

      const beforeSend = mockInit.mock.calls[0][1].before_send;

      stubPathname("/auth/login");
      expect(beforeSend({ event: "$pageview" })).toBeNull();
    });

    test("allows events on non-excluded pages", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
      stubPathname("/environments/123/surveys");

      await import("./instrumentation-client");

      const beforeSend = mockInit.mock.calls[0][1].before_send;
      const event = { event: "$pageview" };

      expect(beforeSend(event)).toEqual(event);
    });

    test("drops events on survey pages during SPA navigation", async () => {
      vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test_key");
      stubPathname("/");

      await import("./instrumentation-client");

      const beforeSend = mockInit.mock.calls[0][1].before_send;

      stubPathname("/s/some-survey-id");
      expect(beforeSend({ event: "$autocapture" })).toBeNull();
    });
  });
});
