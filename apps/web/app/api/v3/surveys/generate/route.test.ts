import { ApiKeyPermission } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { AI_ERROR_CODES } from "@/lib/ai/service";
import { POST } from "./route";
import {
  V3SurveyGeneratePromptError,
  V3SurveyGeneratedPayloadValidationError,
  generateV3SurveyCreatePayloadFromPrompt,
} from "./service";

const { mockAuthenticateRequest } = vi.hoisted(() => ({
  mockAuthenticateRequest: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/app/api/v1/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/api/v1/auth")>();
  return { ...actual, authenticateRequest: mockAuthenticateRequest };
});

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
  applyIPRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return { ...actual, AUDIT_LOG_ENABLED: false };
});

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      warn: vi.fn(),
      error: vi.fn(),
    })),
    error: vi.fn(),
  },
}));

vi.mock("./service", () => {
  class MockV3SurveyGeneratePromptError extends Error {
    invalidParams: Array<{ name: string; reason: string }>;

    constructor(invalidParams: Array<{ name: string; reason: string }>) {
      super("Prompt needs more detail");
      this.name = "V3SurveyGeneratePromptError";
      this.invalidParams = invalidParams;
    }
  }

  class MockV3SurveyGeneratedPayloadValidationError extends Error {
    invalidParams: Array<{ name: string; reason: string }>;

    constructor(invalidParams: Array<{ name: string; reason: string }>) {
      super("Generated survey payload is invalid");
      this.name = "V3SurveyGeneratedPayloadValidationError";
      this.invalidParams = invalidParams;
    }
  }

  return {
    V3SurveyGeneratePromptError: MockV3SurveyGeneratePromptError,
    V3SurveyGeneratedPayloadValidationError: MockV3SurveyGeneratedPayloadValidationError,
    generateV3SurveyCreatePayloadFromPrompt: vi.fn(),
  };
});

const getServerSession = vi.mocked((await import("next-auth")).getServerSession);

const workspaceId = "clxx1234567890123456789012";

function createGenerateRequest(body: unknown, requestId = "req-generate", headers?: Record<string, string>) {
  return new NextRequest("http://localhost/api/v3/surveys/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const apiKeyAuth = {
  type: "apiKey" as const,
  apiKeyId: "key_1",
  organizationId: "org_1",
  organizationAccess: {
    accessControl: { read: true, write: true },
  },
  workspacePermissions: [
    {
      workspaceId,
      workspaceName: "Workspace",
      permission: ApiKeyPermission.write,
    },
  ],
};

describe("POST /api/v3/surveys/generate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getServerSession.mockResolvedValue({
      user: { id: "user_1", name: "User", email: "user@example.com" },
      expires: "2026-01-01",
    } as any);
    mockAuthenticateRequest.mockResolvedValue(null);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      workspaceId,
      organizationId: "org_1",
    });
    vi.mocked(generateV3SurveyCreatePayloadFromPrompt).mockResolvedValue({
      payload: {
        workspaceId,
        type: "link",
        name: "Generated Survey",
        status: "draft",
        metadata: { title: { default: "Generated Survey" } },
        defaultLanguage: "en-US",
        languages: [{ code: "en-US", default: true, enabled: true }],
        welcomeCard: { enabled: false },
        blocks: [
          {
            id: "clbk1234567890123456789012",
            name: "Main",
            elements: [
              {
                id: "q_1",
                type: "openText",
                headline: { default: "What should we improve?" },
                required: false,
                isDraft: true,
              },
            ],
          },
        ],
        endings: [],
        hiddenFields: { enabled: false },
        variables: [],
      },
      validation: {
        valid: true,
        invalid_params: [],
        languages: [{ code: "en-US", default: true, enabled: true }],
      },
    } as Awaited<ReturnType<typeof generateV3SurveyCreatePayloadFromPrompt>>);
  });

  test("returns a generated create payload with session auth", async () => {
    const res = await POST(
      createGenerateRequest({
        workspaceId,
        prompt: "Create a product feedback survey for users after onboarding.",
      }),
      {} as any
    );

    expect(res.status).toBe(200);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      workspaceId,
      "readWrite",
      "req-generate",
      "/api/v3/surveys/generate"
    );
    expect(generateV3SurveyCreatePayloadFromPrompt).toHaveBeenCalledWith({
      organizationId: "org_1",
      input: {
        workspaceId,
        prompt: "Create a product feedback survey for users after onboarding.",
        type: "link",
      },
    });
    const body = await res.json();
    expect(body.data.payload.status).toBe("draft");
  });

  test("supports API key auth", async () => {
    getServerSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(apiKeyAuth as any);

    const res = await POST(
      createGenerateRequest(
        {
          workspaceId,
          prompt: "Create a product feedback survey for users after onboarding.",
          type: "link",
        },
        "req-api",
        { "x-api-key": "fbk_test" }
      ),
      {} as any
    );

    expect(res.status).toBe(200);
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyId: "key_1" }),
      workspaceId,
      "readWrite",
      "req-api",
      "/api/v3/surveys/generate"
    );
  });

  test("rejects unsupported survey types before generation", async () => {
    const res = await POST(
      createGenerateRequest({
        workspaceId,
        prompt: "Create a website survey for the pricing page.",
        type: "website",
      }),
      {} as any
    );

    expect(res.status).toBe(400);
    expect(generateV3SurveyCreatePayloadFromPrompt).not.toHaveBeenCalled();
  });

  test("returns prompt feedback without generated payloads", async () => {
    vi.mocked(generateV3SurveyCreatePayloadFromPrompt).mockRejectedValueOnce(
      new V3SurveyGeneratePromptError([{ name: "prompt", reason: "Add more detail" }])
    );

    const res = await POST(
      createGenerateRequest({
        workspaceId,
        prompt: "Feedback please for onboarding",
      }),
      {} as any
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalid_params).toEqual([{ name: "prompt", reason: "Add more detail" }]);
  });

  test("returns a structured AI unavailable response", async () => {
    vi.mocked(generateV3SurveyCreatePayloadFromPrompt).mockRejectedValueOnce(
      new OperationNotAllowedError(AI_ERROR_CODES.INSTANCE_NOT_CONFIGURED)
    );

    const res = await POST(
      createGenerateRequest({
        workspaceId,
        prompt: "Create a product feedback survey for users after onboarding.",
      }),
      {} as any
    );

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("ai_instance_not_configured");
  });

  test("returns validation details when the generated create payload is invalid", async () => {
    vi.mocked(generateV3SurveyCreatePayloadFromPrompt).mockRejectedValueOnce(
      new V3SurveyGeneratedPayloadValidationError([
        { name: "blocks.0.elements", reason: "Block must have at least one element" },
      ])
    );

    const res = await POST(
      createGenerateRequest({
        workspaceId,
        prompt: "Create a product feedback survey for users after onboarding.",
      }),
      {} as any
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("ai_generated_payload_invalid");
    expect(body.invalid_params).toEqual([
      { name: "blocks.0.elements", reason: "Block must have at least one element" },
    ]);
  });

  test("returns bad gateway for provider failures", async () => {
    vi.mocked(generateV3SurveyCreatePayloadFromPrompt).mockRejectedValueOnce(new Error("provider failed"));

    const res = await POST(
      createGenerateRequest({
        workspaceId,
        prompt: "Create a product feedback survey for users after onboarding.",
      }),
      {} as any
    );

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe("bad_gateway");
  });
});
