import { beforeEach, describe, expect, test, vi } from "vitest";
import { instrumentMcpServerWithTracing } from "./mcp-tracing";

const mocks = vi.hoisted(() => ({
  instrument: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@posthog/mcp", () => ({
  instrument: mocks.instrument,
  PostHogMCPAnalyticsProperty: {
    Parameters: "$mcp_parameters",
    Response: "$mcp_response",
  },
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

    test("strips captured parameters and response, keeps other properties", () => {
      instrumentMcpServerWithTracing({});

      const event = {
        distinct_id: "user_1",
        event: "$mcp_tool_call",
        properties: {
          $mcp_tool_name: "get_survey",
          $mcp_parameters: { surveyId: "survey_1" },
          $mcp_response: { name: "Survey" },
          $mcp_duration_ms: 42,
        },
        timestamp: "2026-01-01T00:00:00.000Z",
        type: "capture" as const,
      };

      const result = getBeforeSend()(event);

      expect(result.properties).toEqual({
        $mcp_tool_name: "get_survey",
        $mcp_duration_ms: 42,
      });
    });
  });
});

describe("instrumentMcpServerWithTracing with null client", () => {
  test("no-ops and returns undefined", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    vi.doMock("@posthog/mcp", () => ({
      instrument: mocks.instrument,
      PostHogMCPAnalyticsProperty: { Parameters: "$mcp_parameters", Response: "$mcp_response" },
    }));
    vi.doMock("@formbricks/logger", () => ({ logger: { warn: mocks.loggerWarn } }));
    vi.doMock("./server", () => ({ posthogTracingClient: null }));

    const { instrumentMcpServerWithTracing: instrumentWithNullClient } = await import("./mcp-tracing");

    const result = instrumentWithNullClient({});

    expect(result).toBeUndefined();
    expect(mocks.instrument).not.toHaveBeenCalled();
  });
});
