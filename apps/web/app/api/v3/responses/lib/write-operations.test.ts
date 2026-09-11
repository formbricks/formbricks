import { beforeEach, describe, expect, test, vi } from "vitest";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { createV3Response, updateV3Response } from "./operations";

vi.mock("server-only", () => ({}));
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

const {
  mockRequireAccess,
  mockGetSurveyForWrite,
  mockCreate,
  mockUpdate,
  mockReadback,
  mockDispatch,
  mockGetWorkspaceId,
  mockGetScoped,
  mockValidateResponseData,
  mockToResource,
} = vi.hoisted(() => ({
  mockRequireAccess: vi.fn(),
  mockGetSurveyForWrite: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockReadback: vi.fn(),
  mockDispatch: vi.fn(),
  mockGetWorkspaceId: vi.fn(),
  mockGetScoped: vi.fn(),
  mockValidateResponseData: vi.fn(),
  mockToResource: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: mockRequireAccess }));
vi.mock("@/modules/api/lib/validation", () => ({ validateResponseData: mockValidateResponseData }));
vi.mock("./serializers", () => ({
  createV3ResponseSerializer: () => ({ toResource: mockToResource, toListItem: vi.fn() }),
}));
vi.mock("./service", () => ({
  getResponseWorkspaceId: mockGetWorkspaceId,
  getScopedV3Response: mockGetScoped,
  deleteScopedResponse: vi.fn(),
  deleteScopedResponses: vi.fn(),
  listV3ResponseKeysetPage: vi.fn(),
  hydrateV3Responses: vi.fn(),
  countV3Responses: vi.fn(),
  getV3ResponseSurveys: vi.fn(),
}));
vi.mock("./write-service", () => ({
  getSurveyForV3Write: mockGetSurveyForWrite,
  createScopedResponse: mockCreate,
  updateScopedResponse: mockUpdate,
  readbackV3Response: mockReadback,
  dispatchV3ResponsePipeline: mockDispatch,
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }) },
}));

const WORKSPACE_ID = "clws000000000000000000001";
const SURVEY_ID = "clsv000000000000000000001";
const RESPONSE_ID = "clrs000000000000000000001";

const survey = (over: Record<string, unknown> = {}) => ({
  id: SURVEY_ID,
  name: "NPS",
  workspaceId: WORKSPACE_ID,
  updatedAt: new Date("2026-09-01T10:00:00.000Z"),
  blocks: [
    { id: "blk", name: "Block", elements: [{ id: "q1", type: "openText", headline: { default: "Q1" } }] },
  ],
  questions: [],
  endings: [{ id: "cmp1" }],
  languages: [{ default: true, enabled: true, language: { code: "en" } }],
  embeddedDataLinks: [],
  embeddedFields: [],
  isAnonymizeResponsesEnabled: false,
  ...over,
});

const row = (over: Record<string, unknown> = {}) => ({
  id: RESPONSE_ID,
  surveyId: SURVEY_ID,
  finished: false,
  data: {},
  variables: {},
  language: null,
  ...over,
});

const params = { authentication: { apiKeyId: "key", workspacePermissions: [] } as never, requestId: "req-1" };

const bodyOf = async (response: Response) => JSON.parse(await response.text());

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAccess.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: "org-1" });
  mockGetSurveyForWrite.mockResolvedValue(survey());
  mockValidateResponseData.mockReturnValue(null);
  mockToResource.mockReturnValue({ id: RESPONSE_ID });
  mockCreate.mockResolvedValue({ ok: true, responseId: RESPONSE_ID });
  mockUpdate.mockResolvedValue({ ok: true, responseId: RESPONSE_ID });
  mockReadback.mockResolvedValue(row());
  mockGetWorkspaceId.mockResolvedValue(WORKSPACE_ID);
  mockGetScoped.mockResolvedValue(row());
});

describe("createV3Response — authorization", () => {
  /**
   * The correction to the contract's own 422 list. `surveyId` is the scope anchor and is resolved
   * *before* authorization, so a distinct answer for "no such survey" is readable by anyone holding
   * any valid key — an existence oracle over every other tenant's ids.
   */
  test("a survey that does not exist and one in another workspace are byte-identical 403s", async () => {
    mockGetSurveyForWrite.mockResolvedValueOnce(null);
    const missing = await createV3Response({
      ...params,
      body: { surveyId: SURVEY_ID, finished: false, data: {} } as never,
    });

    // The foreign case must build its 403 through the real rejection path, not through the same
    // object the missing branch constructs — otherwise this asserts the mock rather than the code.
    mockGetSurveyForWrite.mockResolvedValueOnce(survey({ workspaceId: "clws000000000000000000002" }));
    mockRequireAccess.mockImplementationOnce(async (_auth, _ws, _perm, requestId, instance) =>
      problemForbidden(requestId, "You are not authorized to access this resource", instance)
    );
    const foreign = await createV3Response({
      ...params,
      body: { surveyId: SURVEY_ID, finished: false, data: {} } as never,
    });

    expect(missing.status).toBe(403);
    expect(foreign.status).toBe(403);
    expect(await missing.text()).toBe(await foreign.text());
  });

  test("creating requires readWrite, not read", async () => {
    await createV3Response({ ...params, body: { surveyId: SURVEY_ID, finished: false, data: {} } as never });

    expect(mockRequireAccess).toHaveBeenCalledWith(
      expect.anything(),
      WORKSPACE_ID,
      "readWrite",
      "req-1",
      undefined
    );
  });

  test("a workspace the caller cannot write to is never queried for a survey write", async () => {
    mockRequireAccess.mockResolvedValueOnce(problemForbidden("req-1", undefined, undefined));

    await createV3Response({ ...params, body: { surveyId: SURVEY_ID, finished: false, data: {} } as never });

    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("createV3Response — the happy path and its side effects", () => {
  test("201 carries a Location header pointing at the new response", async () => {
    const response = await createV3Response({
      ...params,
      body: { surveyId: SURVEY_ID, finished: false, data: { q1: "hi" } } as never,
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/v3/responses/${RESPONSE_ID}`);
    expect(await bodyOf(response)).toEqual({ data: { id: RESPONSE_ID } });
  });

  /**
   * Quota evaluation can finish a response the caller submitted as partial, and that response has
   * genuinely finished. Reading `finished` off the request body instead would skip the finish side of
   * the pipeline for exactly the responses a quota just closed.
   */
  test("responseFinished follows the persisted row, not the request body", async () => {
    mockReadback.mockResolvedValueOnce(row({ finished: true }));

    await createV3Response({
      ...params,
      body: { surveyId: SURVEY_ID, finished: false, data: {} } as never,
    });

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ alsoFinished: true }));
  });

  test("a partial response fires no finish event", async () => {
    await createV3Response({ ...params, body: { surveyId: SURVEY_ID, finished: false, data: {} } as never });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "responseCreated", alsoFinished: false })
    );
  });

  test("the pipeline is dispatched after the write, never before", async () => {
    const order: string[] = [];
    mockCreate.mockImplementationOnce(async () => {
      order.push("write");
      return { ok: true, responseId: RESPONSE_ID };
    });
    mockDispatch.mockImplementationOnce(async () => {
      order.push("dispatch");
    });

    await createV3Response({ ...params, body: { surveyId: SURVEY_ID, finished: true, data: {} } as never });

    expect(order).toEqual(["write", "dispatch"]);
  });
});

describe("createV3Response — 422s", () => {
  test("a hidden-field key in data is a 422 naming the key", async () => {
    mockGetSurveyForWrite.mockResolvedValueOnce(
      survey({
        embeddedFields: [
          {
            field: { name: "plan", source: "ingested", dataType: "text", locked: false, defaultValue: null },
            link: { storageKey: "plan" },
          },
        ],
      })
    );

    const response = await createV3Response({
      ...params,
      body: { surveyId: SURVEY_ID, finished: false, data: { plan: "free" } } as never,
    });

    expect(response.status).toBe(422);
    expect((await bodyOf(response)).invalid_params).toEqual([
      expect.objectContaining({ name: "plan", code: "unsupported_field", referenceType: "hiddenField" }),
    ]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("an ending from another survey is a 422", async () => {
    const response = await createV3Response({
      ...params,
      body: { surveyId: SURVEY_ID, finished: true, data: {}, endingId: "cmp-other" } as never,
    });

    expect(response.status).toBe(422);
    expect((await bodyOf(response)).invalid_params[0]).toMatchObject({ name: "endingId" });
  });

  /** Reference failures are raised by the transaction, and they reach the caller the same way. */
  test("a reference conflict from the write is reported as a 422, not a 409", async () => {
    mockCreate.mockResolvedValueOnce({
      ok: false,
      issues: [{ name: "singleUseId", reason: "already used", code: "duplicate_identifier" }],
    });

    const response = await createV3Response({
      ...params,
      body: { surveyId: SURVEY_ID, finished: true, data: {}, singleUseId: "su-1" } as never,
    });

    expect(response.status).toBe(422);
    expect((await bodyOf(response)).invalid_params[0].name).toBe("singleUseId");
  });

  test("every failing rule is reported at once rather than one per round trip", async () => {
    mockValidateResponseData.mockReturnValueOnce({
      q1: [{ ruleId: "minLength", ruleType: "minLength", message: "Too short" }],
    });

    const response = await createV3Response({
      ...params,
      body: {
        surveyId: SURVEY_ID,
        finished: true,
        data: { q1: "x" },
        endingId: "nope",
        language: "es",
      } as never,
    });

    const names = (await bodyOf(response)).invalid_params.map((param: { name: string }) => param.name);
    expect(names).toEqual(expect.arrayContaining(["language", "endingId", "q1"]));
  });
});

describe("updateV3Response", () => {
  test("an unknown response id is the same 403 as a foreign one", async () => {
    mockGetWorkspaceId.mockResolvedValueOnce(null);

    const response = await updateV3Response({
      ...params,
      responseId: RESPONSE_ID,
      body: { finished: true } as never,
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe(await problemForbidden("req-1", undefined, undefined).text());
  });

  /**
   * The deliberate divergence from v1 and v2, which both re-emit on every patch. Re-running every
   * webhook, integration and follow-up email because someone fixed a typo in a finished response is
   * not what "finished" means.
   */
  test("patching an already-finished response does not re-fire responseFinished", async () => {
    mockGetScoped.mockResolvedValueOnce(row({ finished: true }));
    mockReadback.mockResolvedValueOnce(row({ finished: true }));

    await updateV3Response({
      ...params,
      responseId: RESPONSE_ID,
      body: { data: { q1: "typo fixed" } } as never,
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: "responseUpdated", alsoFinished: false })
    );
  });

  test("the transition to finished does fire it", async () => {
    mockGetScoped.mockResolvedValueOnce(row({ finished: false }));
    mockReadback.mockResolvedValueOnce(row({ finished: true }));

    await updateV3Response({ ...params, responseId: RESPONSE_ID, body: { finished: true } as never });

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ alsoFinished: true }));
  });

  /** An absent key must not reach Prisma as `undefined` — for a nullable column that is a null-out. */
  test("only the keys the payload carried are handed to the write", async () => {
    await updateV3Response({ ...params, responseId: RESPONSE_ID, body: { finished: true } as never });

    const { patch } = mockUpdate.mock.calls[0][0];
    expect(patch.finished).toBe(true);
    expect(patch.endingId).toBeUndefined();
    expect(patch.language).toBeUndefined();
    expect(patch.data).toBeUndefined();
    expect(patch.tagIds).toBeUndefined();
  });

  /**
   * A patch that changes language and answers together must be validated against the labels it is
   * about to have, not the ones it is leaving behind.
   */
  test("answers are validated against the language the patch is applying", async () => {
    mockGetScoped.mockResolvedValueOnce(row({ language: "en" }));
    mockGetSurveyForWrite.mockResolvedValueOnce(
      survey({
        languages: [
          { default: true, enabled: true, language: { code: "en" } },
          { default: false, enabled: true, language: { code: "de" } },
        ],
      })
    );

    await updateV3Response({
      ...params,
      responseId: RESPONSE_ID,
      body: { language: "de", data: { q1: "ja" } } as never,
    });

    expect(mockValidateResponseData).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "de",
      expect.anything()
    );
  });
});

describe("the read-back race", () => {
  /**
   * The row was committed and then removed before it could be read back. There is nothing truthful
   * left to return, and the two operations answer differently on purpose: a create has no resource
   * to name, while a patch falls back to the same 403 every other missing response gets.
   */
  test("a create whose row vanishes answers 500 rather than inventing a resource", async () => {
    mockReadback.mockResolvedValueOnce(null);

    const response = await createV3Response({
      ...params,
      body: { surveyId: SURVEY_ID, finished: false, data: {} } as never,
    });

    expect(response.status).toBe(500);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test("a patch whose row vanishes answers the same 403 as any missing response", async () => {
    mockReadback.mockResolvedValueOnce(null);

    const response = await updateV3Response({
      ...params,
      responseId: RESPONSE_ID,
      body: { finished: true } as never,
    });

    expect(response.status).toBe(403);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test("a survey deleted under an in-flight patch answers 403 rather than throwing", async () => {
    mockGetSurveyForWrite.mockResolvedValueOnce(null);

    const response = await updateV3Response({
      ...params,
      responseId: RESPONSE_ID,
      body: { finished: true } as never,
    });

    expect(response.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("what the operation hands to the write", () => {
  /** Nothing asserted the marshalling of the request body into the persist input. */
  test("every create field reaches createScopedResponse", async () => {
    await createV3Response({
      ...params,
      body: {
        surveyId: SURVEY_ID,
        finished: true,
        data: { q1: "hi" },
        ttc: { q1: 1200 },
        meta: { source: "zendesk" },
        tags: ["cltg000000000000000000001"],
        endingId: "cmp1",
        language: "en",
        contactId: "clct000000000000000000001",
        displayId: "cldp000000000000000000001",
        singleUseId: "su-1",
      } as never,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        finished: true,
        data: { q1: "hi" },
        ttc: { q1: 1200, _total: 1200 },
        meta: { source: "zendesk" },
        tagIds: ["cltg000000000000000000001"],
        endingId: "cmp1",
        language: "en",
        contactId: "clct000000000000000000001",
        displayId: "cldp000000000000000000001",
        singleUseId: "su-1",
      })
    );
  });

  /** An omitted ttc must not become {_total: 0} — see normalizeV3Ttc. */
  test("an omitted ttc reaches the write as an empty map", async () => {
    await createV3Response({
      ...params,
      body: { surveyId: SURVEY_ID, finished: true, data: {} } as never,
    });

    expect(mockCreate.mock.calls[0][0].ttc).toEqual({});
  });

  /**
   * `ttc` is create-only for a caller, but a patch that finishes the response must still derive
   * `_total`, which is what every other write path does.
   */
  test("a patch that finishes derives _total from the stored timings", async () => {
    mockGetScoped.mockResolvedValueOnce(row({ finished: false, ttc: { q1: 1000, nps: 500 } }));

    await updateV3Response({ ...params, responseId: RESPONSE_ID, body: { finished: true } as never });

    expect(mockUpdate.mock.calls[0][0].patch.ttc).toEqual({ q1: 1000, nps: 500, _total: 1500 });
  });

  test("a patch that does not finish leaves ttc alone", async () => {
    mockGetScoped.mockResolvedValueOnce(row({ finished: false, ttc: { q1: 1000 } }));

    await updateV3Response({ ...params, responseId: RESPONSE_ID, body: { data: { q1: "x" } } as never });

    expect(mockUpdate.mock.calls[0][0].patch.ttc).toBeUndefined();
  });

  test("patching an already-finished response does not re-total", async () => {
    mockGetScoped.mockResolvedValueOnce(row({ finished: true, ttc: { q1: 1000, _total: 1000 } }));

    await updateV3Response({ ...params, responseId: RESPONSE_ID, body: { finished: true } as never });

    expect(mockUpdate.mock.calls[0][0].patch.ttc).toBeUndefined();
  });

  /**
   * `embeddedData` merges while `data` replaces, and nothing exercised that fold through an
   * operation — only the planner underneath it.
   */
  test("embeddedData merges onto the stored map while data replaces it", async () => {
    mockGetSurveyForWrite.mockResolvedValue(
      survey({
        embeddedFields: [
          {
            field: { name: "Plan", source: "ingested", dataType: "text", locked: false, defaultValue: null },
            link: { storageKey: "plan" },
          },
        ],
      })
    );
    mockGetScoped.mockResolvedValueOnce(row({ data: { q1: "old", nps: 7, plan: "free" } }));

    await updateV3Response({
      ...params,
      responseId: RESPONSE_ID,
      body: { data: { q1: "new" }, embeddedData: { Plan: "enterprise" } } as never,
    });

    // q1 replaced, nps dropped by the wholesale replace, plan merged from embeddedData.
    expect(mockUpdate.mock.calls[0][0].patch.data).toEqual({ q1: "new", plan: "enterprise" });
  });

  test("null in embeddedData clears the stored key through the operation", async () => {
    mockGetSurveyForWrite.mockResolvedValue(
      survey({
        embeddedFields: [
          {
            field: { name: "Plan", source: "ingested", dataType: "text", locked: false, defaultValue: null },
            link: { storageKey: "plan" },
          },
        ],
      })
    );
    mockGetScoped.mockResolvedValueOnce(row({ data: { q1: "a", plan: "free" } }));

    await updateV3Response({
      ...params,
      responseId: RESPONSE_ID,
      body: { embeddedData: { Plan: null } } as never,
    });

    expect(mockUpdate.mock.calls[0][0].patch.data).toEqual({ q1: "a" });
  });
});
