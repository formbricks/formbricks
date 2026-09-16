import { mockPosthog } from "@/lib/posthog/__mocks__/posthog-js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

describe("getPostHogClientFeatureFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPosthog.__loaded = false;
  });

  test("returns false before PostHog is initialized", async () => {
    const { getPostHogClientFeatureFlag } = await import("./client");

    expect(getPostHogClientFeatureFlag("test-flag")).toBe(false);
    expect(mockPosthog.getFeatureFlag).not.toHaveBeenCalled();
  });

  test("returns true from posthog.getFeatureFlag", async () => {
    mockPosthog.__loaded = true;
    mockPosthog.getFeatureFlag.mockReturnValue(true);

    const { getPostHogClientFeatureFlag } = await import("./client");

    expect(getPostHogClientFeatureFlag("test-flag")).toBe(true);
  });

  test("returns false from posthog.getFeatureFlag", async () => {
    mockPosthog.__loaded = true;
    mockPosthog.getFeatureFlag.mockReturnValue(false);

    const { getPostHogClientFeatureFlag } = await import("./client");

    expect(getPostHogClientFeatureFlag("test-flag")).toBe(false);
  });

  test("returns variant string from posthog.getFeatureFlag", async () => {
    mockPosthog.__loaded = true;
    mockPosthog.getFeatureFlag.mockReturnValue("variant-a");

    const { getPostHogClientFeatureFlag } = await import("./client");

    expect(getPostHogClientFeatureFlag("test-flag")).toBe("variant-a");
  });

  test("coerces undefined to false", async () => {
    mockPosthog.__loaded = true;
    mockPosthog.getFeatureFlag.mockReturnValue(undefined);

    const { getPostHogClientFeatureFlag } = await import("./client");

    expect(getPostHogClientFeatureFlag("test-flag")).toBe(false);
  });
});

describe("capturePostHogClientEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPosthog.__loaded = false;
  });

  test("drops the event while PostHog is not initialised", async () => {
    const { capturePostHogClientEvent } = await import("./client");

    capturePostHogClientEvent("upgrade_cta_clicked", { feature: "workflows" });

    expect(mockPosthog.capture).not.toHaveBeenCalled();
  });

  test("captures the event with its properties once initialised", async () => {
    mockPosthog.__loaded = true;
    const { capturePostHogClientEvent } = await import("./client");

    capturePostHogClientEvent("upgrade_cta_clicked", { feature: "workflows" });

    expect(mockPosthog.capture).toHaveBeenCalledWith("upgrade_cta_clicked", { feature: "workflows" });
  });
});

describe("capturePostHogClientEventWhenReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockPosthog.__loaded = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("captures at once when PostHog is already initialised", async () => {
    mockPosthog.__loaded = true;
    const { capturePostHogClientEventWhenReady } = await import("./client");

    capturePostHogClientEventWhenReady("upgrade_prompt_viewed", { feature: "workflows" });

    expect(mockPosthog.capture).toHaveBeenCalledTimes(1);
    expect(mockPosthog.capture).toHaveBeenCalledWith("upgrade_prompt_viewed", { feature: "workflows" });
  });

  test("waits for PostHog to initialise, then captures exactly once", async () => {
    const { capturePostHogClientEventWhenReady } = await import("./client");

    capturePostHogClientEventWhenReady("upgrade_prompt_viewed", { feature: "workflows" });
    vi.advanceTimersByTime(200);
    expect(mockPosthog.capture).not.toHaveBeenCalled();

    mockPosthog.__loaded = true;
    vi.advanceTimersByTime(50);
    expect(mockPosthog.capture).toHaveBeenCalledTimes(1);
    expect(mockPosthog.capture).toHaveBeenCalledWith("upgrade_prompt_viewed", { feature: "workflows" });

    vi.advanceTimersByTime(10_000);
    expect(mockPosthog.capture).toHaveBeenCalledTimes(1);
  });

  test("gives up once the readiness window has passed", async () => {
    const { capturePostHogClientEventWhenReady } = await import("./client");

    capturePostHogClientEventWhenReady("upgrade_prompt_viewed", { feature: "workflows" });
    vi.advanceTimersByTime(6000);
    mockPosthog.__loaded = true;
    vi.advanceTimersByTime(1000);

    expect(mockPosthog.capture).not.toHaveBeenCalled();
  });

  test("cancelling before PostHog is ready drops the event", async () => {
    const { capturePostHogClientEventWhenReady } = await import("./client");

    const cancel = capturePostHogClientEventWhenReady("upgrade_prompt_viewed", { feature: "workflows" });
    cancel();
    mockPosthog.__loaded = true;
    vi.advanceTimersByTime(500);

    expect(mockPosthog.capture).not.toHaveBeenCalled();
  });
});
