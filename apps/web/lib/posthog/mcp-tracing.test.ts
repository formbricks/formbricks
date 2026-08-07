import { PostHogMCPAnalyticsProperty } from "@posthog/mcp";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { instrumentMcpServerWithTracing } from "./mcp-tracing";

const mocks = vi.hoisted(() => ({
  instrument: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("server-only", () => ({}));

// Only `instrument` is mocked - `PostHogMCPAnalyticsProperty` stays the real,
// installed enum so beforeSend's allowlist is exercised against every
// property the actual SDK can produce, not a hand-picked subset that would
// only ever confirm what the allowlist was written from.
vi.mock("@posthog/mcp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@posthog/mcp")>()),
  instrument: mocks.instrument,
}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: mocks.loggerWarn },
}));

vi.mock("./server", () => ({
  posthogTracingClient: { capture: vi.fn() },
}));

describe("instrumentMcpServerWithTracing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("instruments the server with the expected options, forwarding the supplied identify callback", () => {
    const server = { fake: "server" };
    const handle = { capture: vi.fn() };
    const identify = vi.fn();
    mocks.instrument.mockReturnValue(handle);

    const result = instrumentMcpServerWithTracing(server, identify);

    expect(mocks.instrument).toHaveBeenCalledWith(
      server,
      expect.objectContaining({ capture: expect.any(Function) }),
      expect.objectContaining({
        identify,
        beforeSend: expect.any(Function),
        context: false,
        reportMissing: false,
      })
    );
    expect(result).toBe(handle);
  });

  test("returns undefined and logs a warning when instrument throws", () => {
    const error = new Error("incompatible server shape");
    mocks.instrument.mockImplementation(() => {
      throw error;
    });

    const result = instrumentMcpServerWithTracing({});

    expect(result).toBeUndefined();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      { error },
      "Failed to instrument MCP server with PostHog tracing"
    );
  });

  describe("beforeSend", () => {
    const getBeforeSend = () => mocks.instrument.mock.calls[0][2].beforeSend;

    test("no-ops when properties is missing", () => {
      instrumentMcpServerWithTracing({});

      const event = {
        distinct_id: "user_1",
        event: "$mcp_tool_call",
        properties: undefined as never,
        timestamp: "2026-01-01T00:00:00.000Z",
        type: "capture" as const,
      };

      expect(() => getBeforeSend()(event)).not.toThrow();
    });

    test("keeps only allowlisted metadata and strips every other real SDK property, including content-bearing ones", () => {
      instrumentMcpServerWithTracing({});

      // Every property the real, installed @posthog/mcp SDK can ever write,
      // populated with a distinct sentinel value each - proves the allowlist
      // decides per-property, not by coincidentally matching a hand-picked set.
      const properties: Record<string, unknown> = {
        $groups: { organization: "org_1" },
        $process_person_profile: false,
        $set: { email: "person@example.com" },
      };
      for (const property of Object.values(PostHogMCPAnalyticsProperty)) {
        properties[property] = `content-for-${property}`;
      }

      const event = {
        distinct_id: "user_1",
        event: "$mcp_tool_call",
        properties,
        timestamp: "2026-01-01T00:00:00.000Z",
        type: "capture" as const,
      };

      const result = getBeforeSend()(event);

      // Structural PostHog properties (not part of the SDK's own enum) survive.
      expect(result.properties.$groups).toEqual({ organization: "org_1" });
      expect(result.properties.$process_person_profile).toBe(false);
      expect(result.properties.$set).toEqual({ email: "person@example.com" });

      // Explicitly allowlisted metadata survives.
      const allowedMetadata = [
        PostHogMCPAnalyticsProperty.Source,
        PostHogMCPAnalyticsProperty.SessionId,
        PostHogMCPAnalyticsProperty.ResourceName,
        PostHogMCPAnalyticsProperty.ToolName,
        PostHogMCPAnalyticsProperty.ToolDescription,
        PostHogMCPAnalyticsProperty.ToolCategory,
        PostHogMCPAnalyticsProperty.ListedToolNames,
        PostHogMCPAnalyticsProperty.DurationMs,
        PostHogMCPAnalyticsProperty.ServerName,
        PostHogMCPAnalyticsProperty.ServerVersion,
        PostHogMCPAnalyticsProperty.ClientName,
        PostHogMCPAnalyticsProperty.ClientVersion,
        PostHogMCPAnalyticsProperty.ProtocolVersion,
        PostHogMCPAnalyticsProperty.IsError,
        PostHogMCPAnalyticsProperty.ErrorType,
      ];
      for (const property of allowedMetadata) {
        expect(result.properties[property]).toBe(`content-for-${property}`);
      }

      // Everything else - including content-bearing and free-text properties -
      // is stripped by default, not by name.
      const deniedProperties = Object.values(PostHogMCPAnalyticsProperty).filter(
        (property) => !(allowedMetadata as string[]).includes(property)
      );
      expect(deniedProperties).toEqual(
        expect.arrayContaining([
          PostHogMCPAnalyticsProperty.Parameters,
          PostHogMCPAnalyticsProperty.Response,
          PostHogMCPAnalyticsProperty.ErrorMessage,
          PostHogMCPAnalyticsProperty.Intent,
          PostHogMCPAnalyticsProperty.IntentSource,
          PostHogMCPAnalyticsProperty.ConversationId,
        ])
      );
      for (const property of deniedProperties) {
        expect(result.properties[property]).toBeUndefined();
      }
    });
  });
});

describe("instrumentMcpServerWithTracing with null client", () => {
  test("no-ops and returns undefined", async () => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    vi.doMock("@posthog/mcp", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@posthog/mcp")>()),
      instrument: mocks.instrument,
    }));
    vi.doMock("@formbricks/logger", () => ({ logger: { warn: mocks.loggerWarn } }));
    vi.doMock("./server", () => ({ posthogTracingClient: null }));

    const { instrumentMcpServerWithTracing: instrumentWithNullClient } = await import("./mcp-tracing");

    const result = instrumentWithNullClient({});

    expect(result).toBeUndefined();
    expect(mocks.instrument).not.toHaveBeenCalled();
  });
});
