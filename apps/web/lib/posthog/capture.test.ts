import { beforeEach, describe, expect, test, vi } from "vitest";
import { capturePostHogEvent, groupIdentifyPostHog } from "./capture";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  groupIdentify: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: mocks.loggerWarn },
}));

vi.mock("./server", () => ({
  posthogServerClient: { capture: mocks.capture, groupIdentify: mocks.groupIdentify },
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
      groups: undefined,
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
      groups: undefined,
    });
  });

  test("includes organization and workspace groups when provided", () => {
    capturePostHogEvent(
      "user123",
      "test_event",
      { key: "value" },
      { organizationId: "org_1", workspaceId: "ws_1" }
    );

    expect(mocks.capture).toHaveBeenCalledWith({
      distinctId: "user123",
      event: "test_event",
      properties: {
        key: "value",
        $lib: "posthog-node",
        source: "server",
      },
      groups: { organization: "org_1", workspace: "ws_1" },
    });
  });

  test("includes only organization group when workspaceId missing", () => {
    capturePostHogEvent("user123", "test_event", undefined, { organizationId: "org_1" });

    expect(mocks.capture).toHaveBeenCalledWith({
      distinctId: "user123",
      event: "test_event",
      properties: {
        $lib: "posthog-node",
        source: "server",
      },
      groups: { organization: "org_1" },
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

describe("groupIdentifyPostHog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calls posthog groupIdentify with correct params", () => {
    groupIdentifyPostHog("organization", "org_1", { name: "Acme" });

    expect(mocks.groupIdentify).toHaveBeenCalledWith({
      groupType: "organization",
      groupKey: "org_1",
      properties: { name: "Acme" },
    });
  });

  test("identifies workspace group", () => {
    groupIdentifyPostHog("workspace", "ws_1", { name: "Marketing" });

    expect(mocks.groupIdentify).toHaveBeenCalledWith({
      groupType: "workspace",
      groupKey: "ws_1",
      properties: { name: "Marketing" },
    });
  });

  test("does not throw when groupIdentify throws", () => {
    mocks.groupIdentify.mockImplementation(() => {
      throw new Error("Network error");
    });

    expect(() => groupIdentifyPostHog("organization", "org_1")).not.toThrow();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      { error: expect.any(Error), groupType: "organization", groupKey: "org_1" },
      "Failed to identify PostHog group"
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

    const { capturePostHogEvent: captureWithNullClient, groupIdentifyPostHog: identifyWithNullClient } =
      await import("./capture");

    captureWithNullClient("user123", "test_event", { key: "value" });
    identifyWithNullClient("organization", "org_1");

    expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.groupIdentify).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });
});
