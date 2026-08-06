import { beforeEach, describe, expect, test, vi } from "vitest";
import { AI_TRACING_FEATURE, wrapAiModelWithTracing } from "./ai-tracing";

const mocks = vi.hoisted(() => ({
  withTracing: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@posthog/ai/vercel", () => ({
  withTracing: mocks.withTracing,
}));

vi.mock("@formbricks/logger", () => ({
  logger: { warn: mocks.loggerWarn },
}));

vi.mock("./server", () => ({
  posthogTracingClient: { capture: vi.fn() },
}));

describe("wrapAiModelWithTracing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("wraps the model with the expected PostHog tracing options", () => {
    const model = { providerName: "google", modelId: "gemini-2.5-flash" };
    const wrappedModel = { ...model, wrapped: true };
    mocks.withTracing.mockReturnValue(wrappedModel);

    const result = wrapAiModelWithTracing(model as never, {
      distinctId: "user_1",
      feature: AI_TRACING_FEATURE.SurveyGeneration,
      organizationId: "org_1",
      workspaceId: "ws_1",
    });

    expect(mocks.withTracing).toHaveBeenCalledWith(
      model,
      expect.objectContaining({ capture: expect.any(Function) }),
      {
        posthogDistinctId: "user_1",
        posthogTraceId: undefined,
        posthogGroups: { organization: "org_1", workspace: "ws_1" },
        posthogProperties: { feature: AI_TRACING_FEATURE.SurveyGeneration },
        posthogPrivacyMode: true,
      }
    );
    expect(result).toBe(wrappedModel);
  });

  test("forwards a supplied traceId", () => {
    const model = { providerName: "google", modelId: "gemini-2.5-flash" };
    mocks.withTracing.mockReturnValue(model);

    wrapAiModelWithTracing(model as never, {
      distinctId: "user_1",
      feature: AI_TRACING_FEATURE.ExampleResponses,
      traceId: "trace_123",
    });

    expect(mocks.withTracing).toHaveBeenCalledWith(
      model,
      expect.anything(),
      expect.objectContaining({ posthogTraceId: "trace_123" })
    );
  });

  test("omits groups when no organizationId/workspaceId are given", () => {
    const model = { providerName: "google", modelId: "gemini-2.5-flash" };
    mocks.withTracing.mockReturnValue(model);

    wrapAiModelWithTracing(model as never, { distinctId: "user_1", feature: AI_TRACING_FEATURE.ChartQuery });

    expect(mocks.withTracing).toHaveBeenCalledWith(
      model,
      expect.anything(),
      expect.objectContaining({ posthogGroups: undefined })
    );
  });

  test("returns the model unchanged and logs a warning when withTracing throws", () => {
    const model = { providerName: "google", modelId: "gemini-2.5-flash" };
    const error = new Error("incompatible model shape");
    mocks.withTracing.mockImplementation(() => {
      throw error;
    });

    const result = wrapAiModelWithTracing(model as never, {
      distinctId: "user_1",
      feature: AI_TRACING_FEATURE.Translation,
    });

    expect(result).toBe(model);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      { error, feature: AI_TRACING_FEATURE.Translation },
      "Failed to wrap AI model with PostHog tracing"
    );
  });
});

describe("wrapAiModelWithTracing with null client", () => {
  test("no-ops and returns the model unchanged", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    vi.doMock("@posthog/ai/vercel", () => ({ withTracing: mocks.withTracing }));
    vi.doMock("@formbricks/logger", () => ({ logger: { warn: mocks.loggerWarn } }));
    vi.doMock("./server", () => ({ posthogTracingClient: null }));

    const { wrapAiModelWithTracing: wrapWithNullClient, AI_TRACING_FEATURE: FEATURE } =
      await import("./ai-tracing");
    const model = { providerName: "google", modelId: "gemini-2.5-flash" };

    const result = wrapWithNullClient(model as never, {
      distinctId: "user_1",
      feature: FEATURE.ChartQuery,
    });

    expect(result).toBe(model);
    expect(mocks.withTracing).not.toHaveBeenCalled();
  });
});
