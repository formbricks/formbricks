import { beforeEach, describe, expect, test, vi } from "vitest";
import { AIOutputTokenLimitError } from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { mapV3SurveyGenerateError } from "./error-mapping";
import { V3SurveyGeneratePromptError, V3SurveyGeneratedPayloadValidationError } from "./service";

vi.mock("server-only", () => ({}));

// The mapper only needs the AI error-code union from this module; the real one pulls in env,
// organization lookups and license checks.
vi.mock("@/lib/ai/service", () => ({
  AI_ERROR_CODES: {
    FEATURES_NOT_ENABLED: "ai_features_not_enabled",
    SMART_TOOLS_DISABLED: "ai_smart_tools_disabled",
    INSTANCE_NOT_CONFIGURED: "ai_instance_not_configured",
    QUOTA_EXCEEDED: "ai_quota_exceeded",
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn(), withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })) },
}));

const context = {
  requestId: "req_123",
  instance: "/api/v3/surveys/generate",
  workspaceId: "clxx1234567890123456789012",
  organizationId: "org_123",
};

const readProblem = async (response: Response) =>
  (await response.json()) as { status: number; code?: string; invalid_params?: unknown };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mapV3SurveyGenerateError", () => {
  test("maps a thin prompt to 400 and passes the invalid params through", async () => {
    const invalidParams = [{ name: "prompt", reason: "Prompt needs more detail" }];

    const response = mapV3SurveyGenerateError(new V3SurveyGeneratePromptError(invalidParams), context);

    expect(response.status).toBe(400);
    await expect(readProblem(response)).resolves.toMatchObject({ invalid_params: invalidParams });
  });

  test("maps provider rate limiting to 429 with Retry-After", () => {
    const response = mapV3SurveyGenerateError(new TooManyRequestsError("rate limited", 30), context);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  test("maps an unconfigured instance to 503 and other AI codes to 403", async () => {
    const notConfigured = mapV3SurveyGenerateError(
      new OperationNotAllowedError("ai_instance_not_configured"),
      context
    );
    const disabled = mapV3SurveyGenerateError(
      new OperationNotAllowedError("ai_smart_tools_disabled"),
      context
    );

    expect(notConfigured.status).toBe(503);
    expect(disabled.status).toBe(403);
    await expect(readProblem(disabled)).resolves.toMatchObject({ code: "ai_smart_tools_disabled" });
  });

  test("does not treat an unrelated OperationNotAllowedError as an AI-unavailable problem", () => {
    const response = mapV3SurveyGenerateError(new OperationNotAllowedError("something else"), context);

    expect(response.status).toBe(502);
  });

  test("maps an invalid generated payload to 422 with its own code", async () => {
    const invalidParams = [{ name: "elements", reason: "unsupported element type" }];

    const response = mapV3SurveyGenerateError(
      new V3SurveyGeneratedPayloadValidationError(invalidParams),
      context
    );

    expect(response.status).toBe(422);
    await expect(readProblem(response)).resolves.toMatchObject({
      code: "ai_generated_payload_invalid",
      invalid_params: invalidParams,
    });
  });

  test("maps hitting the output token limit to 422 ai_output_too_long", async () => {
    const response = mapV3SurveyGenerateError(
      new AIOutputTokenLimitError({ maxOutputTokens: 8192, outputTokens: 8192 }),
      context
    );

    expect(response.status).toBe(422);
    await expect(readProblem(response)).resolves.toMatchObject({ code: "ai_output_too_long" });
  });

  /**
   * The organization behind a workspace the caller already reached. Answering 404 put a server-derived id
   * in the body as `resource_id`, against `problemNotFound`'s own contract; 403 is what every other v3
   * surface says for a resource the caller may not see.
   */
  test("maps a missing organization to 403, without naming the organization", async () => {
    const response = mapV3SurveyGenerateError(new ResourceNotFoundError("Organization", "org_123"), context);

    expect(response.status).toBe(403);
    const problem = await readProblem(response);
    expect(problem).toMatchObject({ code: "forbidden" });
    expect(JSON.stringify(problem)).not.toContain("org_123");
  });

  test("falls back to 502 and logs for an unrecognized error", () => {
    const error = new Error("provider exploded");

    const response = mapV3SurveyGenerateError(error, context);

    expect(response.status).toBe(502);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: error, requestId: context.requestId }),
      "Failed to generate v3 survey create payload"
    );
  });
});
