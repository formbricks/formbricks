import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { patchV3Survey } from "../patch";
import { V3SurveyReferenceValidationError } from "../reference-validation";
import { PATCH } from "./route";

const { mockAuthenticateRequest } = vi.hoisted(() => ({
  mockAuthenticateRequest: vi.fn(),
}));

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

vi.mock("../authorization", () => ({
  getAuthorizedV3Survey: vi.fn(),
}));

vi.mock("../patch", () => ({
  patchV3Survey: vi.fn(),
}));

vi.mock("@/modules/survey/lib/surveys", () => ({
  deleteSurvey: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

const getServerSession = vi.mocked((await import("next-auth")).getServerSession);
const { getAuthorizedV3Survey } = await import("../authorization");

const surveyId = "clsv1234567890123456789012";
const workspaceId = "clxx1234567890123456789012";

const survey = {
  id: surveyId,
  workspaceId,
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
  name: "Product Feedback",
  type: "link",
  status: "draft",
  metadata: {},
  languages: [
    {
      language: {
        id: "cllangenus000000000000000",
        code: "en-US",
        alias: null,
        workspaceId,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
      default: true,
      enabled: true,
    },
  ],
  questions: [],
  welcomeCard: { enabled: false },
  blocks: [
    {
      id: "clbk1234567890123456789012",
      name: "Main Block",
      elements: [
        {
          id: "feedback",
          type: "openText",
          headline: { default: "What should we improve?" },
          required: true,
        },
      ],
    },
  ],
  endings: [],
  hiddenFields: { enabled: false },
  variables: [],
} as unknown as TSurvey;

function createPatchRequest(body: unknown, url = `http://localhost/api/v3/surveys/${surveyId}`): NextRequest {
  return createRawPatchRequest(JSON.stringify(body), url);
}

function createRawPatchRequest(
  body: string,
  url = `http://localhost/api/v3/surveys/${surveyId}`
): NextRequest {
  return new NextRequest(url, {
    method: "PATCH",
    body,
    headers: {
      "content-type": "application/json",
      "x-request-id": "req_1",
    },
  });
}

describe("PATCH /api/v3/surveys/[surveyId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getServerSession.mockResolvedValue({
      user: { id: "user_1", name: "User", email: "user@example.com" },
      expires: "2026-01-01",
    } as any);
    mockAuthenticateRequest.mockResolvedValue(null);
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey,
      authResult: { workspaceId, organizationId: "org_1" },
      response: null,
    });
    vi.mocked(patchV3Survey).mockResolvedValue({ ...survey, name: "Updated Feedback" } as TSurvey);
  });

  test("returns the normalized updated survey resource", async () => {
    const res = await PATCH(createPatchRequest({ name: "Updated Feedback" }), {
      params: { surveyId },
    } as any);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(patchV3Survey).toHaveBeenCalledWith(survey, { name: "Updated Feedback" }, "req_1", "org_1");
    const body = await res.json();
    expect(body.data).toMatchObject({
      id: surveyId,
      workspaceId,
      name: "Updated Feedback",
      defaultLanguage: "en-US",
    });
  });

  test("rejects unsupported query parameters before patching", async () => {
    const res = await PATCH(
      createPatchRequest(
        { name: "Updated Feedback" },
        `http://localhost/api/v3/surveys/${surveyId}?lang=de-DE`
      ),
      { params: { surveyId } } as any
    );

    expect(res.status).toBe(400);
    expect(patchV3Survey).not.toHaveBeenCalled();
  });

  test("returns 400 for malformed JSON before patching", async () => {
    const res = await PATCH(createRawPatchRequest("{"), {
      params: { surveyId },
    } as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalid_params).toEqual([
      {
        name: "body",
        reason: "Malformed JSON input, please check your request body",
      },
    ]);
    expect(patchV3Survey).not.toHaveBeenCalled();
  });

  test("returns 401 when authentication is missing", async () => {
    getServerSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);

    const res = await PATCH(createPatchRequest({ name: "Updated Feedback" }), {
      params: { surveyId },
    } as any);

    expect(res.status).toBe(401);
    expect(getAuthorizedV3Survey).not.toHaveBeenCalled();
    expect(patchV3Survey).not.toHaveBeenCalled();
  });

  test("returns structured validation errors from the patch pipeline", async () => {
    vi.mocked(patchV3Survey).mockRejectedValue(
      new V3SurveyReferenceValidationError([
        {
          name: "defaultLanguage",
          reason: "Unsupported field 'defaultLanguage'",
          code: "unsupported_field",
        },
      ])
    );

    const res = await PATCH(createPatchRequest({ defaultLanguage: "de-DE" }), {
      params: { surveyId },
    } as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalid_params).toEqual([
      {
        name: "defaultLanguage",
        reason: "Unsupported field 'defaultLanguage'",
        code: "unsupported_field",
      },
    ]);
  });

  test("returns structured validation errors for empty patch bodies", async () => {
    vi.mocked(patchV3Survey).mockRejectedValue(
      new V3SurveyReferenceValidationError([
        {
          name: "data",
          reason: "Request body must include at least one updatable field",
        },
      ])
    );

    const res = await PATCH(createPatchRequest({}), {
      params: { surveyId },
    } as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalid_params).toEqual([
      {
        name: "data",
        reason: "Request body must include at least one updatable field",
      },
    ]);
  });

  test("returns structured validation errors for invalid references", async () => {
    vi.mocked(patchV3Survey).mockRejectedValue(
      new V3SurveyReferenceValidationError([
        {
          name: "blocks.0.logicFallback",
          reason: "Logic fallback target 'missing_block' is not defined in blocks or endings",
          code: "dangling_reference",
          identifier: "missing_block",
          referenceType: "block",
          missingId: "missing_block",
        },
      ])
    );

    const res = await PATCH(createPatchRequest({ blocks: [] }), {
      params: { surveyId },
    } as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.invalid_params).toEqual([
      {
        name: "blocks.0.logicFallback",
        reason: "Logic fallback target 'missing_block' is not defined in blocks or endings",
        code: "dangling_reference",
        identifier: "missing_block",
        referenceType: "block",
        missingId: "missing_block",
      },
    ]);
  });

  test("returns 403 for missing or inaccessible surveys", async () => {
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: null,
      authResult: null,
      response: new Response(
        JSON.stringify({
          title: "Forbidden",
          status: 403,
          detail: "You are not authorized to access this resource",
          requestId: "req_1",
        }),
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      ),
    });

    const res = await PATCH(createPatchRequest({ name: "Updated Feedback" }), {
      params: { surveyId },
    } as any);

    expect(res.status).toBe(403);
    expect(patchV3Survey).not.toHaveBeenCalled();
  });

  test("returns 500 for database errors", async () => {
    vi.mocked(patchV3Survey).mockRejectedValue(new DatabaseError("database unavailable"));

    const res = await PATCH(createPatchRequest({ name: "Updated Feedback" }), {
      params: { surveyId },
    } as any);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("internal_server_error");
  });
});
