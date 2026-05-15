import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFeatureFlag: vi.fn(),
  posthog: {
    __loaded: false,
    getFeatureFlag: vi.fn(),
  },
}));

vi.mock("posthog-js", () => ({
  default: mocks.posthog,
}));

describe("getPostHogClientFeatureFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.posthog.__loaded = false;
    mocks.posthog.getFeatureFlag = mocks.getFeatureFlag;
  });

  test("returns false before PostHog is initialized", async () => {
    const { getPostHogClientFeatureFlag } = await import("./client");

    expect(getPostHogClientFeatureFlag("test-flag")).toBe(false);
    expect(mocks.getFeatureFlag).not.toHaveBeenCalled();
  });

  test("returns true from posthog.getFeatureFlag", async () => {
    mocks.posthog.__loaded = true;
    mocks.getFeatureFlag.mockReturnValue(true);

    const { getPostHogClientFeatureFlag } = await import("./client");

    expect(getPostHogClientFeatureFlag("test-flag")).toBe(true);
  });

  test("returns false from posthog.getFeatureFlag", async () => {
    mocks.posthog.__loaded = true;
    mocks.getFeatureFlag.mockReturnValue(false);

    const { getPostHogClientFeatureFlag } = await import("./client");

    expect(getPostHogClientFeatureFlag("test-flag")).toBe(false);
  });

  test("returns variant string from posthog.getFeatureFlag", async () => {
    mocks.posthog.__loaded = true;
    mocks.getFeatureFlag.mockReturnValue("variant-a");

    const { getPostHogClientFeatureFlag } = await import("./client");

    expect(getPostHogClientFeatureFlag("test-flag")).toBe("variant-a");
  });

  test("coerces undefined to false", async () => {
    mocks.posthog.__loaded = true;
    mocks.getFeatureFlag.mockReturnValue(undefined);

    const { getPostHogClientFeatureFlag } = await import("./client");

    expect(getPostHogClientFeatureFlag("test-flag")).toBe(false);
  });
});
