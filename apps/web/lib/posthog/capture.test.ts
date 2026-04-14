import { beforeEach, describe, expect, test, vi } from "vitest";
import { capturePostHogEvent } from "./capture";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: mocks.loggerWarn },
}));

vi.mock("./server", () => ({
  posthogServerClient: { capture: mocks.capture },
}));

describe("capturePostHogEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calls posthog capture with correct params", () => {
    capturePostHogEvent("user123", "test_event", { key: "value" });

    expect(mocks.capture).toHaveBeenCalledWith({
      distinctId: "user123",
      event: "test_event",
      properties: {
        key: "value",
        $lib: "posthog-node",
        source: "server",
      },
    });
  });

  test("adds default properties when no properties provided", () => {
    capturePostHogEvent("user123", "test_event");

    expect(mocks.capture).toHaveBeenCalledWith({
      distinctId: "user123",
      event: "test_event",
      properties: {
        $lib: "posthog-node",
        source: "server",
      },
    });
  });

  test("does not throw when capture throws", () => {
    mocks.capture.mockImplementation(() => {
      throw new Error("Network error");
    });

    expect(() => capturePostHogEvent("user123", "test_event")).not.toThrow();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      { error: expect.any(Error), eventName: "test_event" },
      "Failed to capture PostHog event"
    );
  });
});

describe("capturePostHogEvent with null client", () => {
  test("no-ops when posthogServerClient is null", async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock("server-only", () => ({}));
    vi.doMock("@formbricks/logger", () => ({
      logger: { warn: mocks.loggerWarn },
    }));
    vi.doMock("./server", () => ({
      posthogServerClient: null,
    }));

    const { capturePostHogEvent: captureWithNullClient } = await import("./capture");

    captureWithNullClient("user123", "test_event", { key: "value" });

    expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });
});
