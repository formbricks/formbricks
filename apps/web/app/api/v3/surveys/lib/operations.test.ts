import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { capturePostHogEvent } from "@/lib/posthog";
import { archiveSurvey, deleteSurvey, restoreSurvey } from "@/modules/survey/lib/surveys";
import { getSurveyCount, getWorkspaceSurveyCount } from "@/modules/survey/list/lib/survey";
import { getSurveyListPage } from "@/modules/survey/list/lib/survey-page";
import { getAuthorizedV3Survey } from "../authorization";
import { V3SurveyCreatePermissionError, V3SurveyInputValidationError, createV3Survey } from "../create";
import { parseV3SurveysListQuery } from "../parse-v3-surveys-list-query";
import { V3SurveyStaleError, V3SurveyStoredDocumentError, patchV3Survey } from "../patch";
import { prepareV3SurveyCreateInput, prepareV3SurveyPatchInput } from "../prepare";
import { V3SurveyReferenceValidationError } from "../reference-validation";
import { ZV3CreateSurveyBody } from "../schemas";
import {
  V3SurveyLanguageError,
  V3SurveyUnsupportedShapeError,
  serializeV3SurveyListItem,
  serializeV3SurveyResource,
} from "../serializers";
import { V3SurveyWritePermissionError } from "../write-permissions";
import {
  archiveV3Survey,
  createV3SurveyResponse,
  createV3SurveyResponseFromRawInput,
  deleteV3Survey,
  getV3Survey,
  listV3Surveys,
  editV3SurveyBlocksResponse,
  patchV3SurveyResponse,
  setV3SurveyBlockOrderResponse,
  restoreV3Survey,
  validateV3Survey,
  validateV3SurveyFromRawInput,
} from "./operations";

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/modules/survey/lib/surveys", () => ({
  deleteSurvey: vi.fn(),
  archiveSurvey: vi.fn(),
  restoreSurvey: vi.fn(),
}));

vi.mock("@/modules/survey/list/lib/survey", () => ({
  getSurveyCount: vi.fn(),
  getWorkspaceSurveyCount: vi.fn(),
}));

vi.mock("@/modules/survey/list/lib/survey-page", () => ({
  getSurveyListPage: vi.fn(),
}));

vi.mock("../authorization", () => ({
  getAuthorizedV3Survey: vi.fn(),
}));

vi.mock("../create", async () => {
  const actual = await vi.importActual<typeof import("../create")>("../create");
  return {
    ...actual,
    createV3Survey: vi.fn(),
  };
});

vi.mock("../parse-v3-surveys-list-query", () => ({
  parseV3SurveysListQuery: vi.fn(),
}));

vi.mock("../patch", () => ({
  patchV3Survey: vi.fn(),
  V3SurveyStoredDocumentError: class V3SurveyStoredDocumentError extends Error {
    constructor(readonly invalidParams: unknown[]) {
      super("Stored survey does not satisfy the v3 survey document contract");
      this.name = "V3SurveyStoredDocumentError";
    }
  },
  // Real class, not a vi.fn: operations.ts branches on `instanceof` to map the 409.
  V3SurveyStaleError: class V3SurveyStaleError extends Error {
    constructor(
      readonly expectedUpdatedAt: Date,
      readonly currentUpdatedAt: Date,
      readonly detectedAt: "read" | "write"
    ) {
      super("Survey was modified since it was last read");
      this.name = "V3SurveyStaleError";
    }
  },
}));

vi.mock("../prepare", () => ({
  prepareV3SurveyCreateInput: vi.fn(),
  prepareV3SurveyPatchInput: vi.fn(),
}));

vi.mock("../serializers", async () => {
  const actual = await vi.importActual<typeof import("../serializers")>("../serializers");
  return {
    ...actual,
    serializeV3SurveyListItem: vi.fn(),
    serializeV3SurveyResource: vi.fn(),
  };
});

const workspaceId = "tz4a98xxat96iws9zmbrgj3a";
const validSurveyId = "tz4a98xxat96iws9zmbrgj4c";
const requestId = "req_123";
const instance = "/api/v3/surveys";
const authentication = { type: "apiKey", apiKey: { id: "api_key_1" } } as any;
const sessionAuthentication = {
  user: { id: "user_1", email: "user@example.com", name: "User" },
  expires: "2026-05-01",
} as any;
const authResult = { workspaceId, organizationId: "org_1" };
const survey = {
  id: "survey_1",
  workspaceId,
  name: "Customer Survey",
  status: "draft",
  type: "link",
  questions: [{ id: "question_1" }],
};
const serializedSurvey = {
  id: "survey_1",
  name: "Customer Survey",
};
const updatedSurvey = {
  ...survey,
  name: "Updated Survey",
};
const serializedUpdatedSurvey = {
  id: "survey_1",
  name: "Updated Survey",
};
const createBody = {
  workspaceId,
  name: "Customer Survey",
  defaultLanguage: "en-US",
  blocks: [
    {
      id: "tz4a98xxat96iws9zmbrgj4b",
      name: "Main Block",
      elements: [
        {
          id: "feedback",
          type: "openText",
          headline: { "en-US": "What should we improve?" },
          required: true,
        },
      ],
    },
  ],
} as any;
const parsedCreateBody = ZV3CreateSurveyBody.parse(createBody);

function mockListQuery(overrides: Record<string, unknown> = {}) {
  vi.mocked(parseV3SurveysListQuery).mockReturnValue({
    ok: true,
    workspaceId,
    limit: 20,
    cursor: null,
    sortBy: undefined,
    filterCriteria: {},
    includeTotalCount: true,
    ...overrides,
  } as any);
}

async function readJson(response: Response) {
  return response.json();
}

describe("listV3Surveys", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockListQuery();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(authResult);
    vi.mocked(getSurveyListPage).mockResolvedValue({ surveys: [survey], nextCursor: "cursor_next" } as any);
    vi.mocked(getSurveyCount).mockResolvedValue(7);
    vi.mocked(getWorkspaceSurveyCount).mockResolvedValue(9);
    vi.mocked(serializeV3SurveyListItem).mockReturnValue(serializedSurvey as any);
  });

  test("returns a serialized paginated survey list", async () => {
    const response = await listV3Surveys({
      searchParams: new URLSearchParams({ workspaceId }),
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(requireV3WorkspaceAccess)).toHaveBeenCalledWith(
      authentication,
      workspaceId,
      "read",
      requestId,
      instance
    );
    expect(vi.mocked(getSurveyListPage)).toHaveBeenCalledWith(workspaceId, {
      limit: 20,
      cursor: null,
      sortBy: undefined,
      filterCriteria: {},
    });
    expect(await readJson(response)).toEqual({
      data: [serializedSurvey],
      meta: { limit: 20, nextCursor: "cursor_next", totalCount: 7, workspaceSurveyCount: 9 },
    });
  });

  test("reports an empty workspace when it holds no survey at all", async () => {
    vi.mocked(getWorkspaceSurveyCount).mockResolvedValue(0);

    const response = await listV3Surveys({
      searchParams: new URLSearchParams({ workspaceId }),
      authentication,
      requestId,
      instance,
    });

    expect((await readJson(response)).meta.workspaceSurveyCount).toBe(0);
  });

  test("skips both counts when they are not requested", async () => {
    mockListQuery({ includeTotalCount: false });

    const response = await listV3Surveys({
      searchParams: new URLSearchParams({ workspaceId }),
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(getSurveyCount)).not.toHaveBeenCalled();
    expect(vi.mocked(getWorkspaceSurveyCount)).not.toHaveBeenCalled();
    const body = await readJson(response);
    expect(body.meta.totalCount).toBeNull();
    expect(body.meta.workspaceSurveyCount).toBeNull();
  });

  test("returns bad request for invalid query parameters", async () => {
    vi.mocked(parseV3SurveysListQuery).mockReturnValue({
      ok: false,
      invalid_params: [{ name: "workspaceId", reason: "Required" }],
    } as any);

    const response = await listV3Surveys({
      searchParams: new URLSearchParams(),
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(400);
    expect((await readJson(response)).invalid_params).toEqual([{ name: "workspaceId", reason: "Required" }]);
  });

  test("returns authorization responses from workspace access", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden(requestId, "nope", instance));

    const response = await listV3Surveys({
      searchParams: new URLSearchParams({ workspaceId }),
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(403);
    expect(vi.mocked(getSurveyListPage)).not.toHaveBeenCalled();
  });

  test("maps resource and database failures to v3 problem responses", async () => {
    vi.mocked(getSurveyListPage).mockRejectedValueOnce(new ResourceNotFoundError("Workspace", workspaceId));

    const forbidden = await listV3Surveys({
      searchParams: new URLSearchParams({ workspaceId }),
      authentication,
      requestId,
      instance,
    });
    expect(forbidden.status).toBe(403);

    vi.mocked(getSurveyListPage).mockRejectedValueOnce(new DatabaseError("db down"));
    const internal = await listV3Surveys({
      searchParams: new URLSearchParams({ workspaceId }),
      authentication,
      requestId,
      instance,
    });
    expect(internal.status).toBe(500);
  });
});

describe("createV3SurveyResponse", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(authResult);
    vi.mocked(createV3Survey).mockResolvedValue(survey as any);
    vi.mocked(serializeV3SurveyResource).mockReturnValue(serializedSurvey as any);
  });

  test("creates a survey, serializes it, and enriches the audit log", async () => {
    const auditLog = {} as any;

    const response = await createV3SurveyResponse({
      body: parsedCreateBody,
      authentication,
      requestId,
      instance,
      auditLog,
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe("/api/v3/surveys/survey_1");
    // Negative control for the level, not just the check: validateV3Survey was moved across this
    // same seam from "readWrite" to "read" because it writes nothing. Create does write, so it must
    // stay at "readWrite" — without this, the same move here would pass the suite.
    expect(vi.mocked(requireV3WorkspaceAccess)).toHaveBeenCalledWith(
      authentication,
      workspaceId,
      "readWrite",
      requestId,
      instance
    );
    expect(vi.mocked(createV3Survey)).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        name: "Customer Survey",
        type: "link",
        status: "draft",
        defaultLanguage: "en-US",
        metadata: {},
        blocks: [
          expect.objectContaining({
            elements: [
              expect.objectContaining({
                headline: { default: "What should we improve?" },
              }),
            ],
          }),
        ],
      }),
      authentication,
      requestId,
      "org_1",
      undefined
    );
    expect(capturePostHogEvent).not.toHaveBeenCalled();
    expect(auditLog).toMatchObject({
      organizationId: "org_1",
      targetId: "survey_1",
      newObject: serializedSurvey,
    });
    expect(await readJson(response)).toEqual({ data: serializedSurvey });
  });

  test("captures survey_created for session-authenticated product template creates", async () => {
    const response = await createV3SurveyResponse({
      body: createBody,
      authentication: sessionAuthentication,
      requestId,
      instance,
      createdFrom: "template",
    });

    expect(response.status).toBe(201);
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "user_1",
      "survey_created",
      {
        survey_id: "survey_1",
        survey_type: "link",
        organization_id: "org_1",
        workspace_id: workspaceId,
        question_count: 1,
        created_from: "template",
      },
      { organizationId: "org_1", workspaceId }
    );
  });

  test("returns authorization responses from workspace access", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden(requestId, "nope", instance));

    const response = await createV3SurveyResponse({
      body: parsedCreateBody,
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(403);
    expect(vi.mocked(createV3Survey)).not.toHaveBeenCalled();
  });

  test("returns bad requests for invalid raw create input", async () => {
    const response = await createV3SurveyResponseFromRawInput({
      body: { workspaceId, name: "Customer Survey", blocks: [] },
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(400);
    expect(vi.mocked(requireV3WorkspaceAccess)).not.toHaveBeenCalled();
    expect(vi.mocked(createV3Survey)).not.toHaveBeenCalled();
    expect(await readJson(response)).toMatchObject({
      invalid_params: [
        expect.objectContaining({
          name: "blocks",
        }),
      ],
    });
  });

  test("maps validation, shape, permission, missing resource, and database errors", async () => {
    vi.mocked(createV3Survey).mockRejectedValueOnce(
      new V3SurveyReferenceValidationError([{ name: "blocks.0", reason: "Unknown element" }])
    );
    expect(
      (
        await createV3SurveyResponse({
          body: parsedCreateBody,
          authentication,
          requestId,
          instance,
        })
      ).status
    ).toBe(422);

    vi.mocked(createV3Survey).mockRejectedValueOnce(new V3SurveyUnsupportedShapeError("Unsupported"));
    expect(
      (
        await createV3SurveyResponse({
          body: parsedCreateBody,
          authentication,
          requestId,
          instance,
        })
      ).status
    ).toBe(400);

    vi.mocked(createV3Survey).mockRejectedValueOnce(new V3SurveyCreatePermissionError("No external URLs"));
    expect(
      (
        await createV3SurveyResponse({
          body: parsedCreateBody,
          authentication,
          requestId,
          instance,
        })
      ).status
    ).toBe(403);

    vi.mocked(createV3Survey).mockRejectedValueOnce(new ResourceNotFoundError("Workspace", workspaceId));
    expect(
      (
        await createV3SurveyResponse({
          body: parsedCreateBody,
          authentication,
          requestId,
          instance,
        })
      ).status
    ).toBe(403);

    vi.mocked(createV3Survey).mockRejectedValueOnce(new DatabaseError("db down"));
    expect(
      (
        await createV3SurveyResponse({
          body: parsedCreateBody,
          authentication,
          requestId,
          instance,
        })
      ).status
    ).toBe(500);
  });

  // ENG-2587. The document passes `ZV3CreateSurveyBody` but fails the survey service's stricter
  // write schema; `executeV3SurveyCreate` catches that with a pre-write parse and throws this typed
  // error. Before the fix there was no branch for it and it landed on the generic 500.
  test("maps V3SurveyInputValidationError to 422 naming the offending path", async () => {
    vi.mocked(createV3Survey).mockRejectedValueOnce(
      new V3SurveyInputValidationError([{ name: "blocks.0.elements.0.buttonUrl", reason: "Invalid url" }])
    );

    const response = await createV3SurveyResponse({
      body: parsedCreateBody,
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(422);
    expect(await readJson(response)).toMatchObject({
      invalid_params: [expect.objectContaining({ name: "blocks.0.elements.0.buttonUrl" })],
    });
  });

  // The reason the branch above is keyed on the typed error and not on `ValidationError`:
  // `createSurvey` also throws `ValidationError` from work that runs *after* its transaction
  // commits (`subscribeOrganizationMembersToSurveyResponses` -> `updateUser` re-validates the
  // user's stored `notificationSettings` JSON). The survey row exists by then, so answering 4xx
  // would tell the caller nothing was written and invite a duplicate retry — and it would drop a
  // genuine server fault out of 5xx alerting. Those must keep the 500.
  test("keeps a bare ValidationError on the 500 path, so post-commit faults are not reported as 4xx", async () => {
    vi.mocked(createV3Survey).mockRejectedValueOnce(
      new ValidationError("Validation failed: notificationSettings.alertExpected boolean")
    );

    const response = await createV3SurveyResponse({
      body: parsedCreateBody,
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(500);
  });
});

describe("getV3Survey", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({ survey, authResult, response: null } as any);
    vi.mocked(serializeV3SurveyResource).mockReturnValue(serializedSurvey as any);
  });

  test("returns a serialized survey resource with language selection", async () => {
    const response = await getV3Survey({
      surveyId: "survey_1",
      lang: ["en-US"],
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(getAuthorizedV3Survey)).toHaveBeenCalledWith({
      surveyId: "survey_1",
      authentication,
      access: "read",
      requestId,
      instance,
    });
    expect(vi.mocked(serializeV3SurveyResource)).toHaveBeenCalledWith(survey, { lang: ["en-US"] });
    expect(await readJson(response)).toEqual({ data: serializedSurvey });
  });

  test("returns authorization responses from survey access", async () => {
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: null,
      authResult: null,
      response: problemForbidden(requestId, "nope", instance),
    } as any);

    const response = await getV3Survey({
      surveyId: "survey_1",
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(403);
  });

  test("maps serializer language and shape errors to bad requests", async () => {
    vi.mocked(serializeV3SurveyResource).mockImplementationOnce(() => {
      throw new V3SurveyLanguageError("Unknown language", "xx-YY");
    });
    const languageResponse = await getV3Survey({
      surveyId: "survey_1",
      lang: ["xx-YY"],
      authentication,
      requestId,
      instance,
    });
    expect(languageResponse.status).toBe(400);
    expect((await readJson(languageResponse)).invalid_params[0]).toMatchObject({
      name: "lang",
      identifier: "xx-YY",
    });

    vi.mocked(serializeV3SurveyResource).mockImplementationOnce(() => {
      throw new V3SurveyUnsupportedShapeError("Unsupported shape");
    });
    const shapeResponse = await getV3Survey({
      surveyId: "survey_1",
      authentication,
      requestId,
      instance,
    });
    expect(shapeResponse.status).toBe(400);
  });

  test("maps database errors from survey access", async () => {
    vi.mocked(getAuthorizedV3Survey).mockRejectedValue(new DatabaseError("db down"));

    const response = await getV3Survey({
      surveyId: "survey_1",
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(500);
  });
});

describe("deleteV3Survey", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({ survey, authResult, response: null } as any);
    vi.mocked(deleteSurvey).mockResolvedValue(survey as any);
  });

  test("deletes an authorized survey and enriches the audit log", async () => {
    const auditLog = {} as any;

    const response = await deleteV3Survey({
      surveyId: "survey_1",
      authentication,
      requestId,
      instance,
      auditLog,
    });

    expect(response.status).toBe(204);
    expect(vi.mocked(deleteSurvey)).toHaveBeenCalledWith("survey_1");
    expect(auditLog).toMatchObject({
      organizationId: "org_1",
      targetId: "survey_1",
      oldObject: survey,
    });
  });

  test("returns authorization responses from survey access", async () => {
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: null,
      authResult: null,
      response: problemForbidden(requestId, "nope", instance),
    } as any);

    const response = await deleteV3Survey({
      surveyId: "survey_1",
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(403);
    expect(vi.mocked(deleteSurvey)).not.toHaveBeenCalled();
  });

  test("maps missing resource and database delete failures", async () => {
    vi.mocked(deleteSurvey).mockRejectedValueOnce(new ResourceNotFoundError("Survey", "survey_1"));
    expect(
      (
        await deleteV3Survey({
          surveyId: "survey_1",
          authentication,
          requestId,
          instance,
        })
      ).status
    ).toBe(403);

    vi.mocked(deleteSurvey).mockRejectedValueOnce(new DatabaseError("db down"));
    expect(
      (
        await deleteV3Survey({
          surveyId: "survey_1",
          authentication,
          requestId,
          instance,
        })
      ).status
    ).toBe(500);
  });
});

describe("patchV3SurveyResponse", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Not archived by default (survey fixture has no archivedAt) so the read-only guard lets patches through.
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({ survey, authResult, response: null } as any);
    vi.mocked(patchV3Survey).mockResolvedValue(updatedSurvey as any);
    vi.mocked(serializeV3SurveyResource).mockImplementation((input) => {
      return (input as any).name === "Updated Survey"
        ? (serializedUpdatedSurvey as any)
        : (serializedSurvey as any);
    });
  });

  test("reports a stored survey that fails the v3 contract as a state error, not a client error", async () => {
    // ENG-3070: the caller sent { name }, so invalid_params naming blocks.* is about the stored
    // survey. A distinct code says so rather than looking like a malformed request.
    vi.mocked(patchV3Survey).mockRejectedValue(
      new V3SurveyStoredDocumentError([
        { name: "blocks.0.elements.0.headline", reason: "missing translation" },
      ])
    );

    const response = await patchV3SurveyResponse({
      surveyId: "survey_1",
      body: { name: "Renamed" },
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("stored_survey_invalid");
    expect(body.detail).toMatch(/not evaluated/);
    expect(body.invalid_params).toEqual([
      expect.objectContaining({ name: "blocks.0.elements.0.headline" }),
    ]);
  });

  test("patches an authorized survey, serializes it, and enriches the audit log", async () => {
    const auditLog = {} as any;
    const patchBody = { name: "Updated Survey" };

    const response = await patchV3SurveyResponse({
      surveyId: "survey_1",
      body: patchBody,
      authentication,
      requestId,
      instance,
      auditLog,
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(getAuthorizedV3Survey)).toHaveBeenCalledWith({
      surveyId: "survey_1",
      authentication,
      access: "readWrite",
      requestId,
      instance,
    });
    expect(vi.mocked(patchV3Survey)).toHaveBeenCalledWith(
      survey,
      patchBody,
      requestId,
      "org_1",
      undefined
    );
    expect(auditLog).toMatchObject({
      organizationId: "org_1",
      targetId: "survey_1",
      oldObject: serializedSurvey,
      newObject: serializedUpdatedSurvey,
    });
    expect(await readJson(response)).toEqual({ data: serializedUpdatedSurvey });
  });

  test("returns authorization responses from survey access", async () => {
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: null,
      authResult: null,
      response: problemForbidden(requestId, "nope", instance),
    } as any);

    const response = await patchV3SurveyResponse({
      surveyId: "survey_1",
      body: { name: "Updated Survey" },
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(403);
    expect(vi.mocked(patchV3Survey)).not.toHaveBeenCalled();
  });

  test("rejects patches to an archived survey with 422 and does not patch", async () => {
    // archivedAt is read from the survey already loaded by getAuthorizedV3Survey — no extra query.
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: { ...survey, archivedAt: new Date() },
      authResult,
      response: null,
    } as any);

    const response = await patchV3SurveyResponse({
      surveyId: "survey_1",
      body: { status: "inProgress" },
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(422);
    expect(vi.mocked(patchV3Survey)).not.toHaveBeenCalled();
  });

  test("maps validation, shape, permission, missing resource, and database errors", async () => {
    vi.mocked(patchV3Survey).mockRejectedValueOnce(
      new V3SurveyReferenceValidationError([{ name: "blocks.0", reason: "Unknown element" }])
    );
    expect(
      (
        await patchV3SurveyResponse({
          surveyId: "survey_1",
          body: { blocks: [] },
          authentication,
          requestId,
          instance,
        })
      ).status
    ).toBe(422);

    vi.mocked(patchV3Survey).mockRejectedValueOnce(new V3SurveyUnsupportedShapeError("Unsupported"));
    expect(
      (
        await patchV3SurveyResponse({
          surveyId: "survey_1",
          body: { blocks: [] },
          authentication,
          requestId,
          instance,
        })
      ).status
    ).toBe(400);

    vi.mocked(patchV3Survey).mockRejectedValueOnce(new V3SurveyWritePermissionError("No external URLs"));
    expect(
      (
        await patchV3SurveyResponse({
          surveyId: "survey_1",
          body: { blocks: [] },
          authentication,
          requestId,
          instance,
        })
      ).status
    ).toBe(403);

    vi.mocked(patchV3Survey).mockRejectedValueOnce(new ResourceNotFoundError("Survey", "survey_1"));
    expect(
      (
        await patchV3SurveyResponse({
          surveyId: "survey_1",
          body: { blocks: [] },
          authentication,
          requestId,
          instance,
        })
      ).status
    ).toBe(403);

    vi.mocked(patchV3Survey).mockRejectedValueOnce(new DatabaseError("db down"));
    expect(
      (
        await patchV3SurveyResponse({
          surveyId: "survey_1",
          body: { blocks: [] },
          authentication,
          requestId,
          instance,
        })
      ).status
    ).toBe(500);
  });
});

describe("archiveV3Survey", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({ survey, authResult, response: null } as any);
    vi.mocked(archiveSurvey).mockResolvedValue({
      id: "survey_1",
      status: "paused",
      archivedAt: new Date(),
    } as any);
  });

  test("archives an authorized survey and enriches the audit log", async () => {
    const auditLog = {} as any;

    const response = await archiveV3Survey({
      surveyId: "survey_1",
      authentication,
      requestId,
      instance,
      auditLog,
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(getAuthorizedV3Survey)).toHaveBeenCalledWith({
      surveyId: "survey_1",
      authentication,
      access: "readWrite",
      requestId,
      instance,
    });
    expect(vi.mocked(archiveSurvey)).toHaveBeenCalledWith("survey_1");
    expect(auditLog).toMatchObject({ organizationId: "org_1", targetId: "survey_1", oldObject: survey });
  });

  test("returns authorization responses from survey access", async () => {
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: null,
      authResult: null,
      response: problemForbidden(requestId, "nope", instance),
    } as any);

    const response = await archiveV3Survey({ surveyId: "survey_1", authentication, requestId, instance });

    expect(response.status).toBe(403);
    expect(vi.mocked(archiveSurvey)).not.toHaveBeenCalled();
  });

  test("maps missing resource and database failures", async () => {
    vi.mocked(archiveSurvey).mockRejectedValueOnce(new ResourceNotFoundError("Survey", "survey_1"));
    expect(
      (await archiveV3Survey({ surveyId: "survey_1", authentication, requestId, instance })).status
    ).toBe(403);

    vi.mocked(archiveSurvey).mockRejectedValueOnce(new DatabaseError("db down"));
    expect(
      (await archiveV3Survey({ surveyId: "survey_1", authentication, requestId, instance })).status
    ).toBe(500);
  });
});

describe("restoreV3Survey", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({ survey, authResult, response: null } as any);
    vi.mocked(restoreSurvey).mockResolvedValue({
      id: "survey_1",
      status: "paused",
      archivedAt: null,
    } as any);
  });

  test("restores an authorized survey and enriches the audit log", async () => {
    const auditLog = {} as any;

    const response = await restoreV3Survey({
      surveyId: "survey_1",
      authentication,
      requestId,
      instance,
      auditLog,
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(restoreSurvey)).toHaveBeenCalledWith("survey_1");
    expect(auditLog).toMatchObject({ organizationId: "org_1", targetId: "survey_1", oldObject: survey });
  });

  test("maps missing resource and database failures", async () => {
    vi.mocked(restoreSurvey).mockRejectedValueOnce(new ResourceNotFoundError("Survey", "survey_1"));
    expect(
      (await restoreV3Survey({ surveyId: "survey_1", authentication, requestId, instance })).status
    ).toBe(403);

    vi.mocked(restoreSurvey).mockRejectedValueOnce(new DatabaseError("db down"));
    expect(
      (await restoreV3Survey({ surveyId: "survey_1", authentication, requestId, instance })).status
    ).toBe(500);
  });
});

describe("validateV3Survey", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(authResult);
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({ survey, authResult, response: null } as any);
    vi.mocked(prepareV3SurveyCreateInput).mockReturnValue({
      ok: true,
      languageRequests: [{ code: "en-US", default: true, enabled: true }],
    } as any);
    vi.mocked(prepareV3SurveyPatchInput).mockReturnValue({
      ok: false,
      validation: { invalidParams: [{ name: "name", reason: "Required" }] },
    } as any);
  });

  test("validates create input and checks workspace access when workspaceId is present", async () => {
    const response = await validateV3Survey({
      body: { operation: "create", data: createBody },
      authentication,
      requestId,
      instance,
    } as any);

    expect(response.status).toBe(200);
    // "read", not "readWrite": validation writes nothing, and the MCP validate_survey tool is
    // registered surveys:read. Raising this back to readWrite re-breaks that tool (ENG-2179).
    expect(vi.mocked(requireV3WorkspaceAccess)).toHaveBeenCalledWith(
      authentication,
      workspaceId,
      "read",
      requestId,
      instance
    );
    expect(await readJson(response)).toEqual({
      data: {
        valid: true,
        operation: "create",
        invalid_params: [],
        languages: [{ code: "en-US", default: true, enabled: true, writeBehavior: "connect_or_create" }],
      },
    });
  });

  test("returns authorization responses while validating create input", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden(requestId, "nope", instance));

    const response = await validateV3Survey({
      body: { operation: "create", data: createBody },
      authentication,
      requestId,
      instance,
    } as any);

    expect(response.status).toBe(403);
    expect(vi.mocked(prepareV3SurveyCreateInput)).not.toHaveBeenCalled();
  });

  test("validates patch input against the authorized survey", async () => {
    const response = await validateV3Survey({
      body: { operation: "patch", surveyId: validSurveyId, data: { name: "" } },
      authentication,
      requestId,
      instance,
    } as any);

    expect(response.status).toBe(200);
    // See the create-branch note above: the patch dry run is gated at "read" too.
    expect(vi.mocked(getAuthorizedV3Survey)).toHaveBeenCalledWith({
      surveyId: validSurveyId,
      authentication,
      access: "read",
      requestId,
      instance,
    });
    expect(vi.mocked(prepareV3SurveyPatchInput)).toHaveBeenCalledWith(survey, { name: "" });
    expect(await readJson(response)).toEqual({
      data: {
        valid: false,
        operation: "patch",
        invalid_params: [{ name: "name", reason: "Required" }],
      },
    });
  });

  test("returns authorization responses while validating patch input", async () => {
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: null,
      authResult: null,
      response: problemForbidden(requestId, "nope", instance),
    } as any);

    const response = await validateV3Survey({
      body: { operation: "patch", surveyId: validSurveyId, data: {} },
      authentication,
      requestId,
      instance,
    } as any);

    expect(response.status).toBe(403);
    expect(vi.mocked(prepareV3SurveyPatchInput)).not.toHaveBeenCalled();
  });

  test("returns bad requests for invalid validation input", async () => {
    const response = await validateV3SurveyFromRawInput({
      body: { operation: "patch", data: {} },
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(400);
    expect(vi.mocked(getAuthorizedV3Survey)).not.toHaveBeenCalled();
    expect(vi.mocked(prepareV3SurveyPatchInput)).not.toHaveBeenCalled();
    expect(await readJson(response)).toMatchObject({
      invalid_params: [
        expect.objectContaining({
          name: "surveyId",
        }),
      ],
    });
  });

  test("maps database errors during validation", async () => {
    vi.mocked(getAuthorizedV3Survey).mockRejectedValue(new DatabaseError("db down"));

    const response = await validateV3Survey({
      body: { operation: "patch", surveyId: validSurveyId, data: {} },
      authentication,
      requestId,
      instance,
    } as any);

    expect(response.status).toBe(500);
  });
});

describe("editV3SurveyBlocksResponse", () => {
  const blockA = { id: "blk_a", name: "A", elements: [] };
  const blockB = { id: "blk_b", name: "B", elements: [] };
  const serializedWithBlocks = { id: "survey_1", name: "Customer Survey", blocks: [blockA, blockB] };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({ survey, authResult, response: null } as any);
    vi.mocked(patchV3Survey).mockResolvedValue(updatedSurvey as any);
    vi.mocked(serializeV3SurveyResource).mockImplementation((input) =>
      (input as any).name === "Updated Survey"
        ? (serializedUpdatedSurvey as any)
        : (serializedWithBlocks as any)
    );
  });

  const call = (body: unknown, auditLog?: any): Promise<Response> =>
    editV3SurveyBlocksResponse({
      surveyId: "survey_1",
      body,
      authentication,
      requestId,
      instance,
      auditLog,
    });

  test("splices the ops into the stored blocks and writes the whole array once", async () => {
    const auditLog = {} as any;
    const replacement = { id: "blk_a", name: "A renamed", elements: [] };

    const response = await call({ ops: [{ op: "update", id: "blk_a", block: replacement }] }, auditLog);

    expect(response.status).toBe(200);
    expect(vi.mocked(patchV3Survey)).toHaveBeenCalledWith(
      survey,
      { blocks: [replacement, blockB] },
      requestId,
      "org_1",
      undefined
    );
    expect(auditLog).toMatchObject({
      organizationId: "org_1",
      targetId: "survey_1",
      oldObject: serializedWithBlocks,
      newObject: serializedUpdatedSurvey,
    });
  });

  test("forwards expectedUpdatedAt as a write precondition", async () => {
    await call({
      ops: [{ op: "remove", id: "blk_b" }],
      expectedUpdatedAt: "2026-04-21T10:00:00.000Z",
    });

    expect(vi.mocked(patchV3Survey)).toHaveBeenCalledWith(survey, { blocks: [blockA] }, requestId, "org_1", {
      expectedUpdatedAt: new Date("2026-04-21T10:00:00.000Z"),
    });
  });

  test("returns 400 for a malformed envelope without touching the survey", async () => {
    const response = await call({ ops: [] });

    expect(response.status).toBe(400);
    expect(vi.mocked(getAuthorizedV3Survey)).not.toHaveBeenCalled();
    expect(vi.mocked(patchV3Survey)).not.toHaveBeenCalled();
  });

  test("returns 422 for an op that cannot apply, and does not write", async () => {
    const response = await call({ ops: [{ op: "remove", id: "blk_zz" }] });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.invalid_params).toEqual([
      expect.objectContaining({ name: "ops.0.id", code: "dangling_reference" }),
    ]);
    expect(vi.mocked(patchV3Survey)).not.toHaveBeenCalled();
  });

  test("passes an authorization response straight through", async () => {
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: null,
      authResult: null,
      response: new Response(null, { status: 403 }),
    } as any);

    const response = await call({ ops: [{ op: "remove", id: "blk_a" }] });

    expect(response.status).toBe(403);
    expect(vi.mocked(patchV3Survey)).not.toHaveBeenCalled();
  });

  test("refuses an archived survey", async () => {
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({
      survey: { ...survey, archivedAt: new Date() },
      authResult,
      response: null,
    } as any);

    const response = await call({ ops: [{ op: "remove", id: "blk_a" }] });

    expect(response.status).toBe(422);
    expect(vi.mocked(patchV3Survey)).not.toHaveBeenCalled();
  });

  test("remaps a downstream blocks.<i> path onto the op that produced it", async () => {
    // Otherwise the caller gets "blocks.1.elements.0.headline" for an array it never sent.
    vi.mocked(patchV3Survey).mockRejectedValue(
      new V3SurveyReferenceValidationError([
        { name: "blocks.1.elements.0.headline", reason: "bad", code: "missing_translation" },
        { name: "blocks.0.logic.0", reason: "untouched block keeps its path" },
      ])
    );

    const response = await call({
      ops: [{ op: "insert", block: { id: "blk_new" }, position: { type: "after", blockId: "blk_a" } }],
    });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.invalid_params).toEqual([
      expect.objectContaining({ name: "ops.0.block.elements.0.headline" }),
      expect.objectContaining({ name: "blocks.0.logic.0" }),
    ]);
  });

  test("maps a stale precondition to 409 with both timestamps", async () => {
    vi.mocked(patchV3Survey).mockRejectedValue(
      new V3SurveyStaleError(
        new Date("2026-04-21T10:00:00.000Z"),
        new Date("2026-04-21T11:30:00.000Z"),
        "write"
      )
    );

    const response = await call({
      ops: [{ op: "remove", id: "blk_b" }],
      expectedUpdatedAt: "2026-04-21T10:00:00.000Z",
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("conflict");
    expect(body.details).toEqual({
      expectedUpdatedAt: "2026-04-21T10:00:00.000Z",
      currentUpdatedAt: "2026-04-21T11:30:00.000Z",
    });
  });
});

describe("setV3SurveyBlockOrderResponse", () => {
  const blockA = { id: "blk_a", name: "A", elements: [] };
  const blockB = { id: "blk_b", name: "B", elements: [] };
  const serializedWithBlocks = { id: "survey_1", name: "Customer Survey", blocks: [blockA, blockB] };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({ survey, authResult, response: null } as any);
    vi.mocked(patchV3Survey).mockResolvedValue(updatedSurvey as any);
    vi.mocked(serializeV3SurveyResource).mockImplementation((input) =>
      (input as any).name === "Updated Survey"
        ? (serializedUpdatedSurvey as any)
        : (serializedWithBlocks as any)
    );
  });

  const call = (body: unknown, auditLog?: any): Promise<Response> =>
    setV3SurveyBlockOrderResponse({
      surveyId: "survey_1",
      body,
      authentication,
      requestId,
      instance,
      auditLog,
    });

  test("applies a permutation", async () => {
    const response = await call({ order: ["blk_b", "blk_a"] });

    expect(response.status).toBe(200);
    expect(vi.mocked(patchV3Survey)).toHaveBeenCalledWith(
      survey,
      { blocks: [blockB, blockA] },
      requestId,
      "org_1",
      undefined
    );
  });

  test("skips the write when the order already matches, so updatedAt does not move", async () => {
    // A no-op write would bump updatedAt and invalidate every other caller's precondition, which
    // would make this endpoint's advertised idempotence false.
    const auditLog = {} as any;

    const response = await call({ order: ["blk_a", "blk_b"] }, auditLog);

    expect(response.status).toBe(200);
    expect(vi.mocked(patchV3Survey)).not.toHaveBeenCalled();
    expect(auditLog).toMatchObject({ oldObject: serializedWithBlocks, newObject: serializedWithBlocks });
  });

  test("rejects an order that is not a permutation", async () => {
    const response = await call({ order: ["blk_a"] });

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.invalid_params).toEqual([
      expect.objectContaining({ name: "order", code: "missing_required_field", missingId: "blk_b" }),
    ]);
    expect(vi.mocked(patchV3Survey)).not.toHaveBeenCalled();
  });

  test("returns 400 when the body is malformed", async () => {
    const response = await call({ order: "not-an-array" });

    expect(response.status).toBe(400);
    expect(vi.mocked(getAuthorizedV3Survey)).not.toHaveBeenCalled();
  });
});
