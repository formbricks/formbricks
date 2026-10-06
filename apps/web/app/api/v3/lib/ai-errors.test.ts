import { beforeEach, describe, expect, test, vi } from "vitest";
import { AIOAuthTokenError, AIOutputTokenLimitError } from "@formbricks/ai";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { mapV3AIError } from "./ai-errors";

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
  instance: "/api/internal/surveys/import/stream",
  workspaceId: "clxx1234567890123456789012",
  organizationId: "org_123",
  operation: "surveys.import",
};

const readProblem = async (response: Response | null) =>
  (await response?.json()) as { status: number; code?: string; detail?: string };

describe("mapV3AIError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test.each([
    ["ai_features_not_enabled", 403],
    ["ai_smart_tools_disabled", 403],
    ["ai_instance_not_configured", 503],
  ])("maps the AI gate reason %s to %i with its own code", async (code, status) => {
    const response = mapV3AIError(new OperationNotAllowedError(code), context);

    expect(response?.status).toBe(status);
    expect((await readProblem(response)).code).toBe(code);
  });

  test("maps exhausted quota to 429 with Retry-After", () => {
    const response = mapV3AIError(new TooManyRequestsError("quota", 30), context);

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("30");
  });

  test("maps a missing organization to 403 without naming it", async () => {
    const response = mapV3AIError(new ResourceNotFoundError("Organization", "org_123"), context);

    expect(response?.status).toBe(403);
    expect(JSON.stringify(await readProblem(response))).not.toContain("org_123");
  });

  test("maps rejected provider credentials to 502 ai_provider_auth_failed", async () => {
    const response = mapV3AIError(
      new AIOAuthTokenError("token_request_failed", { statusCode: 401, tokenUrlHost: "idp.example" }),
      context
    );

    expect(response?.status).toBe(502);
    expect((await readProblem(response)).code).toBe("ai_provider_auth_failed");
  });

  test.each([
    ["an unrelated OperationNotAllowedError", new OperationNotAllowedError("not an AI code")],
    ["an output-limit error, which each operation words for its own input", new AIOutputTokenLimitError()],
    ["a plain error", new Error("boom")],
  ])("leaves %s to the caller", (_case, error) => {
    expect(mapV3AIError(error, context)).toBeNull();
  });
});
