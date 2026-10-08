import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFeatureFlag: vi.fn(),
  loggerWarn: vi.fn(),
}));

describe("getPostHogFeatureFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test("returns false when PostHog is not configured", async () => {
    vi.doMock("server-only", () => ({}));
    vi.doMock("@formbricks/logger", () => ({
      logger: { warn: mocks.loggerWarn },
    }));
    vi.doMock("@/lib/constants", () => ({ POSTHOG_KEY: undefined }));
    vi.doMock("./server", () => ({
      posthogServerClient: { getFeatureFlag: mocks.getFeatureFlag },
    }));

    const { getPostHogFeatureFlag } = await import("./get-feature-flag");

    await expect(getPostHogFeatureFlag("user123", "test-flag")).resolves.toBe(false);
    expect(mocks.getFeatureFlag).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

  test("returns false when posthogServerClient is null", async () => {
    vi.doMock("server-only", () => ({}));
    vi.doMock("@formbricks/logger", () => ({
      logger: { warn: mocks.loggerWarn },
    }));
    vi.doMock("@/lib/constants", () => ({ POSTHOG_KEY: "phc_test_key" }));
    vi.doMock("./server", () => ({
      posthogServerClient: null,
    }));

    const { getPostHogFeatureFlag } = await import("./get-feature-flag");

    await expect(getPostHogFeatureFlag("user123", "test-flag")).resolves.toBe(false);
    expect(mocks.getFeatureFlag).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

  test("forwards distinctId, flagKey, and mapped groups to PostHog", async () => {
    mocks.getFeatureFlag.mockResolvedValue(true);

    vi.doMock("server-only", () => ({}));
    vi.doMock("@formbricks/logger", () => ({
      logger: { warn: mocks.loggerWarn },
    }));
    vi.doMock("@/lib/constants", () => ({ POSTHOG_KEY: "phc_test_key" }));
    vi.doMock("./server", () => ({
      posthogServerClient: { getFeatureFlag: mocks.getFeatureFlag },
    }));

    const { getPostHogFeatureFlag } = await import("./get-feature-flag");

    await expect(
      getPostHogFeatureFlag("user123", "experiment-flag", {
        organizationId: "org_123",
        workspaceId: "ws_456",
      })
    ).resolves.toBe(true);

    expect(mocks.getFeatureFlag).toHaveBeenCalledWith("experiment-flag", "user123", {
      groups: {
        organization: "org_123",
        workspace: "ws_456",
      },
    });
  });

  test("preserves variant string responses", async () => {
    mocks.getFeatureFlag.mockResolvedValue("variant-a");

    vi.doMock("server-only", () => ({}));
    vi.doMock("@formbricks/logger", () => ({
      logger: { warn: mocks.loggerWarn },
    }));
    vi.doMock("@/lib/constants", () => ({ POSTHOG_KEY: "phc_test_key" }));
    vi.doMock("./server", () => ({
      posthogServerClient: { getFeatureFlag: mocks.getFeatureFlag },
    }));

    const { getPostHogFeatureFlag } = await import("./get-feature-flag");

    await expect(getPostHogFeatureFlag("user123", "experiment-flag")).resolves.toBe("variant-a");
  });

  test("coerces undefined to false", async () => {
    mocks.getFeatureFlag.mockResolvedValue(undefined);

    vi.doMock("server-only", () => ({}));
    vi.doMock("@formbricks/logger", () => ({
      logger: { warn: mocks.loggerWarn },
    }));
    vi.doMock("@/lib/constants", () => ({ POSTHOG_KEY: "phc_test_key" }));
    vi.doMock("./server", () => ({
      posthogServerClient: { getFeatureFlag: mocks.getFeatureFlag },
    }));

    const { getPostHogFeatureFlag } = await import("./get-feature-flag");

    await expect(getPostHogFeatureFlag("user123", "experiment-flag")).resolves.toBe(false);
  });

  test("logs and returns false when PostHog throws", async () => {
    mocks.getFeatureFlag.mockRejectedValue(new Error("network error"));

    vi.doMock("server-only", () => ({}));
    vi.doMock("@formbricks/logger", () => ({
      logger: { warn: mocks.loggerWarn },
    }));
    vi.doMock("@/lib/constants", () => ({ POSTHOG_KEY: "phc_test_key" }));
    vi.doMock("./server", () => ({
      posthogServerClient: { getFeatureFlag: mocks.getFeatureFlag },
    }));

    const { getPostHogFeatureFlag } = await import("./get-feature-flag");

    await expect(getPostHogFeatureFlag("user123", "experiment-flag")).resolves.toBe(false);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      { error: expect.any(Error), flagKey: "experiment-flag" },
      "Failed to evaluate PostHog feature flag"
    );
  });
});
