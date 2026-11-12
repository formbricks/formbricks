import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { applyV3OperationRateLimit } from "@/app/api/v3/lib/operation-rate-limit";
import { problemForbidden, problemTooManyRequests } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { capturePostHogEvent } from "@/lib/posthog";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { generateV3Survey } from "./operations";
import { V3SurveyGeneratePromptError, generateV3SurveyCreatePayloadFromPrompt } from "./service";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/app/api/v3/lib/operation-rate-limit", () => ({ applyV3OperationRateLimit: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("./service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./service")>()),
  generateV3SurveyCreatePayloadFromPrompt: vi.fn(),
}));

const WORKSPACE_ID = "clws000000000000000000001";
const session = { user: { id: "user_1" }, expires: "2099-01-01" } as unknown as TV3Authentication;
const body = {
  workspaceId: WORKSPACE_ID,
  prompt: "A survey about onboarding friction",
  type: "link" as const,
};
const result = {
  language: "en-US",
  payload: { workspaceId: WORKSPACE_ID },
  validation: { valid: true, invalid_params: [], languages: [] },
};

const generate = () =>
  generateV3Survey({ authentication: session, body, requestId: "req_1", instance: "/api/mcp" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(applyV3OperationRateLimit).mockResolvedValue(null);
  vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
    workspaceId: WORKSPACE_ID,
    organizationId: "org_1",
  } as Awaited<ReturnType<typeof requireV3WorkspaceAccess>>);
  vi.mocked(generateV3SurveyCreatePayloadFromPrompt).mockResolvedValue(result as never);
});

describe("generateV3Survey", () => {
  test("charges the survey-generation budget, so REST and MCP spend from one bucket", async () => {
    await generate();

    expect(applyV3OperationRateLimit).toHaveBeenCalledWith({
      config: rateLimitConfigs.api.v3SurveyGenerate,
      authentication: session,
      requestId: "req_1",
      instance: "/api/mcp",
    });
  });

  test("answers 429 and never calls the model when the budget is spent", async () => {
    vi.mocked(applyV3OperationRateLimit).mockResolvedValue(
      problemTooManyRequests("req_1", "Rate limit exceeded", 30, "/api/mcp")
    );

    const response = await generate();

    expect(response.status).toBe(429);
    expect(generateV3SurveyCreatePayloadFromPrompt).not.toHaveBeenCalled();
  });

  test("relays the workspace refusal and never calls the model", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden("req_1", "No", "/api/mcp"));

    const response = await generate();

    expect(response.status).toBe(403);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      session,
      WORKSPACE_ID,
      "readWrite",
      "req_1",
      "/api/mcp"
    );
    expect(generateV3SurveyCreatePayloadFromPrompt).not.toHaveBeenCalled();
  });

  test("generates against the workspace's organization and returns the draft", async () => {
    const response = await generate();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(result);
    expect(generateV3SurveyCreatePayloadFromPrompt).toHaveBeenCalledWith({
      organizationId: "org_1",
      workspaceId: WORKSPACE_ID,
      userId: "user_1",
      input: body,
    });
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "user_1",
      "ai_survey_generated",
      { prompt_length: body.prompt.length },
      { organizationId: "org_1", workspaceId: WORKSPACE_ID }
    );
  });

  test("maps a generation failure to its problem response instead of throwing", async () => {
    vi.mocked(generateV3SurveyCreatePayloadFromPrompt).mockRejectedValue(
      new V3SurveyGeneratePromptError([{ name: "prompt", reason: "too vague" }])
    );

    const response = await generate();

    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params).toEqual([{ name: "prompt", reason: "too vague" }]);
  });
});
