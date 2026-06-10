import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { deleteSurvey } from "@/modules/survey/lib/surveys";
import { getSurveyCount } from "@/modules/survey/list/lib/survey";
import { getSurveyListPage } from "@/modules/survey/list/lib/survey-page";
import { getAuthorizedV3Survey } from "../authorization";
import { V3SurveyCreatePermissionError, createV3Survey } from "../create";
import { parseV3SurveysListQuery } from "../parse-v3-surveys-list-query";
import { patchV3Survey } from "../patch";
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
  createV3SurveyResponse,
  createV3SurveyResponseFromRawInput,
  deleteV3Survey,
  getV3Survey,
  listV3Surveys,
  patchV3SurveyResponse,
  validateV3Survey,
  validateV3SurveyFromRawInput,
} from "./operations";

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@/modules/survey/lib/surveys", () => ({
  deleteSurvey: vi.fn(),
}));

vi.mock("@/modules/survey/list/lib/survey", () => ({
  getSurveyCount: vi.fn(),
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
const authResult = { workspaceId, organizationId: "org_1" };
const survey = {
  id: "survey_1",
  workspaceId,
  name: "Customer Survey",
  status: "draft",
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
      meta: { limit: 20, nextCursor: "cursor_next", totalCount: 7 },
    });
  });

  test("skips total count when it is not requested", async () => {
    mockListQuery({ includeTotalCount: false });

    const response = await listV3Surveys({
      searchParams: new URLSearchParams({ workspaceId }),
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(200);
    expect(vi.mocked(getSurveyCount)).not.toHaveBeenCalled();
    expect((await readJson(response)).meta.totalCount).toBeNull();
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
      "org_1"
    );
    expect(auditLog).toMatchObject({
      organizationId: "org_1",
      targetId: "survey_1",
      newObject: serializedSurvey,
    });
    expect(await readJson(response)).toEqual({ data: serializedSurvey });
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
    ).toBe(400);

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
    vi.mocked(getAuthorizedV3Survey).mockResolvedValue({ survey, authResult, response: null } as any);
    vi.mocked(patchV3Survey).mockResolvedValue(updatedSurvey as any);
    vi.mocked(serializeV3SurveyResource).mockImplementation((input) => {
      return (input as any).name === "Updated Survey"
        ? (serializedUpdatedSurvey as any)
        : (serializedSurvey as any);
    });
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
    expect(vi.mocked(patchV3Survey)).toHaveBeenCalledWith(survey, patchBody, requestId, "org_1");
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
    ).toBe(400);

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
    expect(vi.mocked(requireV3WorkspaceAccess)).toHaveBeenCalledWith(
      authentication,
      workspaceId,
      "readWrite",
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
    expect(vi.mocked(getAuthorizedV3Survey)).toHaveBeenCalledWith({
      surveyId: validSurveyId,
      authentication,
      access: "readWrite",
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
