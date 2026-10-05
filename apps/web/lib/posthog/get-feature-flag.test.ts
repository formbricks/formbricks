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

describe("evaluatePostHogFeatureFlag", () => {
  const getFeatureFlagDetailsStateless = vi.fn();

  const load = async (client: unknown = { getFeatureFlagDetailsStateless }, key = "phc_test_key") => {
    vi.doMock("server-only", () => ({}));
    vi.doMock("@formbricks/logger", () => ({ logger: { warn: mocks.loggerWarn } }));
    vi.doMock("@/lib/constants", () => ({ POSTHOG_KEY: key }));
    vi.doMock("./server", () => ({ posthogServerClient: client }));
    return (await import("./get-feature-flag")).evaluatePostHogFeatureFlag;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test("is unavailable, without a request, when PostHog is not configured", async () => {
    const evaluate = await load({ getFeatureFlagDetailsStateless }, "");
    await expect(evaluate("org_1", "custom-css")).resolves.toEqual({ status: "unavailable" });
    expect(getFeatureFlagDetailsStateless).not.toHaveBeenCalled();
  });

  test("asks for the one flag with the organization group", async () => {
    getFeatureFlagDetailsStateless.mockResolvedValue({ flags: { "custom-css": { enabled: true } } });
    const evaluate = await load();

    await expect(evaluate("org_1", "custom-css", { organizationId: "org_1" })).resolves.toEqual({
      status: "evaluated",
      value: true,
    });
    expect(getFeatureFlagDetailsStateless).toHaveBeenCalledWith(
      "org_1",
      { organization: "org_1" },
      undefined,
      undefined,
      undefined,
      ["custom-css"]
    );
  });

  test("an explicit off is an evaluated false", async () => {
    getFeatureFlagDetailsStateless.mockResolvedValue({ flags: { "custom-css": { enabled: false } } });
    const evaluate = await load();
    await expect(evaluate("org_1", "custom-css")).resolves.toEqual({ status: "evaluated", value: false });
  });

  test("a missing flag is an evaluated false, not an outage", async () => {
    getFeatureFlagDetailsStateless.mockResolvedValue({ flags: {} });
    const evaluate = await load();
    await expect(evaluate("org_1", "custom-css")).resolves.toEqual({ status: "evaluated", value: false });
  });

  test("keeps a variant", async () => {
    getFeatureFlagDetailsStateless.mockResolvedValue({
      flags: { "custom-css": { enabled: true, variant: "beta" } },
    });
    const evaluate = await load();
    await expect(evaluate("org_1", "custom-css")).resolves.toEqual({ status: "evaluated", value: "beta" });
  });

  test.each([
    ["a failed request", undefined],
    ["a quota block", { flags: {}, quotaLimited: ["feature_flags"] }],
    ["a flag PostHog failed to compute", { flags: { "custom-css": { enabled: false, failed: true } } }],
    ["a flag missing because of computation errors", { flags: {}, errorsWhileComputingFlags: true }],
  ])("is unavailable on %s", async (_label, response) => {
    getFeatureFlagDetailsStateless.mockResolvedValue(response);
    const evaluate = await load();
    await expect(evaluate("org_1", "custom-css")).resolves.toEqual({ status: "unavailable" });
  });

  test("is unavailable when the request throws, and logs", async () => {
    getFeatureFlagDetailsStateless.mockRejectedValue(new Error("network"));
    const evaluate = await load();
    await expect(evaluate("org_1", "custom-css")).resolves.toEqual({ status: "unavailable" });
    expect(mocks.loggerWarn).toHaveBeenCalled();
  });

  test("is unavailable when the SDK no longer exposes the detailed call", async () => {
    const evaluate = await load({ getFeatureFlag: vi.fn() });
    await expect(evaluate("org_1", "custom-css")).resolves.toEqual({ status: "unavailable" });
  });
});
