import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getSurvey } from "@/lib/survey/service";
import { createResponseWithQuotaEvaluation } from "./lib/response";
import { POST } from "./route";

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
  applyIPRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/app/lib/pipelines", () => ({
  sendToPipeline: vi.fn(),
}));

vi.mock("@/modules/storage/utils", () => ({
  validateFileUploads: vi.fn(() => true),
}));

vi.mock("@/modules/api/lib/validation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/api/lib/validation")>();
  return {
    ...actual,
    validateResponseData: vi.fn(() => undefined),
  };
});

vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    withContext: vi.fn(() => ({
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe("POST /api/v1/client/:environmentId/responses (single-use enforcement)", () => {
  const environmentId = "clxx1234567890123456789012";
  const surveyId = "clzz9876543210987654321098";

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(getSurvey).mockResolvedValue({
      id: surveyId,
      environmentId,
      type: "link",
      singleUse: {
        enabled: true,
        isEncrypted: false,
      },
      isCaptureIpEnabled: false,
      questions: [],
      blocks: [],
    } as any);
  });

  test("returns 400 when singleUseId is missing", async () => {
    const req = new NextRequest(`http://localhost/api/v1/client/${environmentId}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vitest",
      },
      body: JSON.stringify({
        surveyId,
        finished: true,
        data: {},
        meta: {
          url: `https://example.com/s/${surveyId}?suId=abc`,
        },
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ environmentId }) } as any);

    expect(res.status).toBe(400);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const body = await res.json();
    expect(body.code).toBe("bad_request");
    expect(body.message).toBe("Missing single use id");
    expect(createResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });

  test("returns 400 when singleUseId is null", async () => {
    const req = new NextRequest(`http://localhost/api/v1/client/${environmentId}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vitest",
      },
      body: JSON.stringify({
        surveyId,
        singleUseId: null,
        finished: true,
        data: {},
        meta: {
          url: `https://example.com/s/${surveyId}?suId=abc`,
        },
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ environmentId }) } as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Missing single use id");
    expect(createResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });

  test("returns 400 when suId does not match singleUseId", async () => {
    const req = new NextRequest(`http://localhost/api/v1/client/${environmentId}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vitest",
      },
      body: JSON.stringify({
        surveyId,
        singleUseId: "abc",
        finished: true,
        data: {},
        meta: {
          url: `https://example.com/s/${surveyId}?suId=def`,
        },
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ environmentId }) } as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Invalid single use id");
    expect(createResponseWithQuotaEvaluation).not.toHaveBeenCalled();
  });
});
