import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockShutdown = vi.fn().mockResolvedValue(undefined);
const mockCapture = vi.fn();

class MockPostHog {
  constructor(
    public apiKey: string,
    public options: Record<string, unknown>
  ) {}
  shutdown = mockShutdown;
  capture = mockCapture;
}

vi.mock("server-only", () => ({}));

vi.mock("posthog-node", () => ({
  PostHog: MockPostHog,
}));

describe("posthog-server", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  });

  describe("when NEXT_PUBLIC_POSTHOG_KEY is set", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
      process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.i.posthog.com";
    });

    test("getPostHogClient returns a PostHog instance", async () => {
      const { getPostHogClient } = await import("./posthog-server");
      const client = getPostHogClient();
      expect(client).not.toBeNull();
      expect(client!.capture).toBeDefined();
      expect(client!.shutdown).toBeDefined();
    });

    test("getPostHogClient returns the same instance on subsequent calls (singleton)", async () => {
      const { getPostHogClient } = await import("./posthog-server");
      const client1 = getPostHogClient();
      const client2 = getPostHogClient();
      expect(client1).toBe(client2);
    });

    test("getPostHogClient creates PostHog with correct config", async () => {
      const { getPostHogClient } = await import("./posthog-server");
      const client = getPostHogClient() as unknown as MockPostHog;

      expect(client.apiKey).toBe("phc_test_key");
      expect(client.options).toEqual({
        host: "https://eu.i.posthog.com",
        flushAt: 1,
        flushInterval: 0,
      });
    });

    test("shutdownPostHog calls shutdown on the client", async () => {
      const { getPostHogClient, shutdownPostHog } = await import("./posthog-server");
      getPostHogClient();
      await shutdownPostHog();
      expect(mockShutdown).toHaveBeenCalledOnce();
    });

    test("capture can be called on the client", async () => {
      const { getPostHogClient } = await import("./posthog-server");
      const client = getPostHogClient();
      client!.capture({
        distinctId: "env-123",
        event: "survey_response_finished",
        properties: { survey_id: "survey-1" },
      });
      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: "env-123",
        event: "survey_response_finished",
        properties: { survey_id: "survey-1" },
      });
    });
  });

  describe("when NEXT_PUBLIC_POSTHOG_KEY is not set", () => {
    test("getPostHogClient returns null", async () => {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
      const { getPostHogClient } = await import("./posthog-server");
      const client = getPostHogClient();
      expect(client).toBeNull();
    });

    test("shutdownPostHog does nothing when no client exists", async () => {
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
      const { shutdownPostHog } = await import("./posthog-server");
      await shutdownPostHog();
      expect(mockShutdown).not.toHaveBeenCalled();
    });
  });
});
