import { mockValidateFileUploads } from "./__mocks__/storage-utils";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { validateV3Response, validateV3ResponseFromRawInput } from "./validate-operations";

vi.mock("server-only", () => ({}));
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

const {
  mockRequireAccess,
  mockGetSurveyForWrite,
  mockGetWorkspaceId,
  mockGetScoped,
  mockCollectReferenceIssues,
  mockCreate,
  mockUpdate,
  mockDispatch,
  mockScreenQuotas,
  mockGroupBy,
  mockGetOrganization,
  mockIsCloud,
  mockValidateResponseData,
} = vi.hoisted(() => ({
  mockRequireAccess: vi.fn(),
  mockGetSurveyForWrite: vi.fn(),
  mockGetWorkspaceId: vi.fn(),
  mockGetScoped: vi.fn(),
  mockCollectReferenceIssues: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDispatch: vi.fn(),
  mockScreenQuotas: vi.fn(),
  mockGroupBy: vi.fn(),
  mockGetOrganization: vi.fn(),
  mockIsCloud: vi.fn(),
  mockValidateResponseData: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: mockRequireAccess }));
vi.mock("@/modules/api/lib/validation", () => ({ validateResponseData: mockValidateResponseData }));
vi.mock("@/lib/workspace/service", () => ({ getWorkspaceLegacyStoragePrefixes: async () => [] }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mockGetOrganization }));
// Metering is Cloud-only, so the constant has to be controllable or only the false branch is ever
// reachable — a regression that stopped metering a real Cloud organization would pass unnoticed.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get IS_FORMBRICKS_CLOUD() {
    return mockIsCloud();
  },
}));
vi.mock("@/modules/ee/quotas/lib/evaluation-service", () => ({ screenResponseQuotas: mockScreenQuotas }));
vi.mock("@formbricks/database", () => ({
  prisma: { responseQuotaLink: { groupBy: mockGroupBy } },
}));
vi.mock("./serializers", () => ({
  createV3ResponseSerializer: () => ({ toResource: vi.fn(), toListItem: vi.fn() }),
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
  collectReferenceIssues: mockCollectReferenceIssues,
  createScopedResponse: mockCreate,
  updateScopedResponse: mockUpdate,
  readbackV3Response: vi.fn(),
  dispatchV3ResponsePipeline: mockDispatch,
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    withContext: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
  },
}));

const WORKSPACE_ID = "clws000000000000000000001";
const ORGANIZATION_ID = "clog000000000000000000001";
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
  languages: [],
  embeddedDataLinks: [],
  embeddedFields: [],
  isAnonymizeResponsesEnabled: false,
  ...over,
});

const storedResponse = (over: Record<string, unknown> = {}) => ({
  id: RESPONSE_ID,
  surveyId: SURVEY_ID,
  createdAt: new Date("2026-09-10T10:00:00.000Z"),
  updatedAt: new Date("2026-09-10T10:00:00.000Z"),
  finished: false,
  endingId: null,
  language: null,
  data: { q1: "hi" },
  variables: {},
  ttc: {},
  meta: {},
  displayId: null,
  singleUseId: null,
  contact: null,
  tags: [],
  ...over,
});

const authentication = { type: "apiKey" } as never;

const validate = async (body: unknown) =>
  await validateV3Response({
    body: body as never,
    authentication,
    requestId: "req-1",
    instance: "/api/v3/responses/validate",
  });

const bodyOf = async (response: Response) => (await response.json()).data;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAccess.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: ORGANIZATION_ID });
  mockGetSurveyForWrite.mockResolvedValue(survey());
  mockGetWorkspaceId.mockResolvedValue(WORKSPACE_ID);
  mockGetScoped.mockResolvedValue(storedResponse());
  mockCollectReferenceIssues.mockResolvedValue({ issues: [], contactAttributes: undefined });
  mockValidateResponseData.mockReturnValue(null);
  mockValidateFileUploads.mockReturnValue(true);
  mockScreenQuotas.mockResolvedValue(null);
  mockGroupBy.mockResolvedValue([]);
  mockGetOrganization.mockResolvedValue({ billing: { stripeCustomerId: null } });
  mockIsCloud.mockReturnValue(false);
});

/**
 * The promise the endpoint is named for. Asserted against the three functions that would leave a
 * trace — the row, the patch and the pipeline dispatch — rather than against a comment.
 */
describe("nothing is written", () => {
  test("a valid create validation writes no row and dispatches nothing", async () => {
    await validate({ operation: "create", data: { surveyId: SURVEY_ID, finished: true, data: {} } });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  test("a valid patch validation writes nothing either", async () => {
    await validate({ operation: "patch", responseId: RESPONSE_ID, data: { finished: true } });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe("authorization", () => {
  /** A cheaper existence probe than the write it describes is the one thing a dry run must not be. */
  test("a missing survey and a foreign survey give byte-identical 403s", async () => {
    mockGetSurveyForWrite.mockResolvedValueOnce(null);
    const missing = await validate({
      operation: "create",
      data: { surveyId: SURVEY_ID, finished: true, data: {} },
    });

    mockGetSurveyForWrite.mockResolvedValueOnce(null);
    const foreign = await validate({
      operation: "create",
      data: { surveyId: "clsvffffffffffffffffffff2", finished: true, data: {} },
    });

    expect(missing.status).toBe(403);
    expect(foreign.status).toBe(403);
    expect(await missing.text()).toBe(await foreign.text());
  });

  test("a missing response and a foreign response give byte-identical 403s", async () => {
    mockGetWorkspaceId.mockResolvedValueOnce(null);
    const missing = await validate({ operation: "patch", responseId: RESPONSE_ID, data: { finished: true } });

    mockGetScoped.mockResolvedValueOnce(null);
    const foreign = await validate({ operation: "patch", responseId: RESPONSE_ID, data: { finished: true } });

    expect(missing.status).toBe(403);
    expect(await missing.text()).toBe(await foreign.text());
  });

  /** The operation's own permission, not `read` — validating is as privileged as writing. */
  test("both branches ask for readWrite", async () => {
    await validate({ operation: "create", data: { surveyId: SURVEY_ID, finished: true, data: {} } });
    await validate({ operation: "patch", responseId: RESPONSE_ID, data: { finished: true } });

    for (const call of mockRequireAccess.mock.calls) {
      expect(call[2]).toBe("readWrite");
    }
  });

  test("a refusal from the access check is returned untouched", async () => {
    const refusal = new Response("nope", { status: 403 });
    mockRequireAccess.mockResolvedValueOnce(refusal);

    expect(
      await validate({ operation: "create", data: { surveyId: SURVEY_ID, finished: true, data: {} } })
    ).toBe(refusal);
  });
});

describe("the verdict", () => {
  test("a document the write would reject comes back 200 with valid false", async () => {
    const response = await validate({
      operation: "create",
      data: { surveyId: SURVEY_ID, finished: true, data: {}, endingId: "nope" },
    });

    expect(response.status).toBe(200);
    const data = await bodyOf(response);
    expect(data.valid).toBe(false);
    expect(data.operation).toBe("create");
    expect(data.invalid_params.map((param: { name: string }) => param.name)).toContain("endingId");
    expect(data.effects).toBeUndefined();
  });

  test("a schema failure inside the document is reported, not raised", async () => {
    const response = await validate({
      operation: "create",
      data: { surveyId: SURVEY_ID, finished: "yes", data: {} },
    });

    expect(response.status).toBe(200);
    const data = await bodyOf(response);
    expect(data.valid).toBe(false);
    expect(data.invalid_params.map((param: { name: string }) => param.name)).toContain("finished");
  });

  /**
   * No `surveyId` means no scope to authorize against and none to disclose, so the caller is told
   * what is wrong rather than refused — and nothing was looked up.
   */
  test("a document with no surveyId is answered without touching the database", async () => {
    const response = await validate({ operation: "create", data: { finished: true, data: {} } });

    expect(response.status).toBe(200);
    expect((await bodyOf(response)).invalid_params[0].name).toBe("surveyId");
    expect(mockGetSurveyForWrite).not.toHaveBeenCalled();
    expect(mockRequireAccess).not.toHaveBeenCalled();
  });

  test("a reference the write would refuse is reported as invalid", async () => {
    mockCollectReferenceIssues.mockResolvedValueOnce({
      issues: [{ name: "tags", reason: "No tag with this id exists.", code: "invalid_reference" }],
      contactAttributes: undefined,
    });

    const data = await bodyOf(
      await validate({ operation: "create", data: { surveyId: SURVEY_ID, finished: true, data: {} } })
    );

    expect(data.valid).toBe(false);
    expect(data.invalid_params[0].code).toBe("invalid_reference");
  });
});

describe("effects", () => {
  /** ENG-2838: the field this endpoint exists for. */
  test("a survey with no translations reports the response would carry no language", async () => {
    const data = await bodyOf(
      await validate({ operation: "create", data: { surveyId: SURVEY_ID, finished: true, data: {} } })
    );

    expect(data.valid).toBe(true);
    expect(data.effects.language).toBeNull();
  });

  test("a translated survey reports the code that would be stamped", async () => {
    mockGetSurveyForWrite.mockResolvedValueOnce(
      survey({
        languages: [
          { default: true, enabled: true, language: { code: "en" } },
          { default: false, enabled: true, language: { code: "de" } },
        ],
      })
    );

    const data = await bodyOf(
      await validate({
        operation: "create",
        data: { surveyId: SURVEY_ID, finished: true, data: {}, language: "de" },
      })
    );

    expect(data.effects.language).toBe("de");
  });

  /**
   * `firesPipeline` used to report the `responseFinished` transition, so a patch of an
   * already-finished response answered `false`. Every patch dispatches `responseUpdated`, and the job
   * fans any event to its webhooks — so a caller that dry-ran a correction, read `false`, and expected
   * silence watched its webhooks fire.
   */
  test("every create and every patch fires the pipeline, transition or not", async () => {
    const created = await bodyOf(
      await validate({ operation: "create", data: { surveyId: SURVEY_ID, finished: false, data: {} } })
    );
    expect(created.effects.firesPipeline).toBe(true);
    expect(created.effects.countsTowardMeteredResponses).toBe(false);

    const finishing = await bodyOf(
      await validate({ operation: "patch", responseId: RESPONSE_ID, data: { finished: true } })
    );
    expect(finishing.effects.firesPipeline).toBe(true);

    mockGetScoped.mockResolvedValueOnce(storedResponse({ finished: true }));
    const alreadyFinished = await bodyOf(
      await validate({ operation: "patch", responseId: RESPONSE_ID, data: { finished: true } })
    );
    // The patch that changes nothing about `finished` still emits `responseUpdated`.
    expect(alreadyFinished.effects.firesPipeline).toBe(true);
    expect(alreadyFinished.effects.countsTowardMeteredResponses).toBe(false);
  });

  /**
   * Both halves of the metering gate, because it is an AND and a one-sided test proves neither. The
   * write is metered only on Cloud AND only for an organization that has a Stripe customer.
   */
  test.each([
    ["cloud with a Stripe customer", true, "cus_123", true],
    ["cloud without one", true, null, false],
    ["self-hosted with a Stripe customer", false, "cus_123", false],
  ])("metering on a create: %s", async (_label, isCloud, stripeCustomerId, expected) => {
    mockIsCloud.mockReturnValue(isCloud);
    mockGetOrganization.mockResolvedValue({ billing: { stripeCustomerId } });

    const data = await bodyOf(
      await validate({ operation: "create", data: { surveyId: SURVEY_ID, finished: true, data: {} } })
    );

    expect(data.effects.countsTowardMeteredResponses).toBe(expected);
  });

  /** A patch is never a `responseCreated`, so it is never metered whatever the plan says. */
  test("a patch is never metered, even on cloud with a Stripe customer", async () => {
    mockIsCloud.mockReturnValue(true);
    mockGetOrganization.mockResolvedValue({ billing: { stripeCustomerId: "cus_123" } });

    const data = await bodyOf(
      await validate({ operation: "patch", responseId: RESPONSE_ID, data: { finished: true } })
    );

    expect(data.effects.countsTowardMeteredResponses).toBe(false);
  });

  /**
   * A quota the payload misses is listed too: an importer asking why nothing is being counted needs
   * to see the quota it missed, not an empty array.
   */
  test("every quota is reported, and a matched one says whether it would fill", async () => {
    mockScreenQuotas.mockResolvedValueOnce({
      quotas: [
        { id: "q-match", name: "Germans", limit: 2 },
        { id: "q-miss", name: "Finns", limit: 5 },
      ],
      passedQuotas: [{ id: "q-match", name: "Germans", limit: 2 }],
      failedQuotas: [{ id: "q-miss", name: "Finns", limit: 5 }],
    });
    mockGroupBy.mockResolvedValueOnce([{ quotaId: "q-match", _count: { responseId: 1 } }]);

    const data = await bodyOf(
      await validate({ operation: "create", data: { surveyId: SURVEY_ID, finished: true, data: {} } })
    );

    expect(data.effects.quotas).toEqual([
      { quotaId: "q-match", quotaName: "Germans", wouldCount: true, wouldFill: true },
      { quotaId: "q-miss", quotaName: "Finns", wouldCount: false },
    ]);
  });

  /** A secondary read failing must not turn a working validation into a 500. */
  test("a quota screening failure leaves the verdict intact", async () => {
    mockScreenQuotas.mockRejectedValueOnce(new Error("quota service down"));

    const response = await validate({
      operation: "create",
      data: { surveyId: SURVEY_ID, finished: true, data: {} },
    });

    expect(response.status).toBe(200);
    const data = await bodyOf(response);
    expect(data.valid).toBe(true);
    expect(data.effects.quotas).toEqual([]);
  });

  test("a patch reports the tag set that would end up applied", async () => {
    mockGetScoped.mockResolvedValueOnce(
      storedResponse({ tags: [{ tag: { id: "cltg000000000000000000001", name: "old" } }] })
    );

    const kept = await bodyOf(
      await validate({ operation: "patch", responseId: RESPONSE_ID, data: { finished: true } })
    );
    expect(kept.effects.tagsToApply).toEqual(["cltg000000000000000000001"]);

    const replaced = await bodyOf(
      await validate({
        operation: "patch",
        responseId: RESPONSE_ID,
        data: { tags: ["cltg000000000000000000002", "cltg000000000000000000002"] },
      })
    );
    expect(replaced.effects.tagsToApply).toEqual(["cltg000000000000000000002"]);
  });
});

describe("the raw-input entry point", () => {
  test("a malformed envelope is a 400, unlike a malformed document", async () => {
    const response = await validateV3ResponseFromRawInput({
      body: { operation: "create" },
      authentication,
      requestId: "req-1",
      instance: "/api/v3/responses/validate",
    });

    expect(response.status).toBe(400);
    const problem = await response.json();
    expect(problem.invalid_params.map((param: { name: string }) => param.name)).toContain("data");
  });

  test("a well-formed envelope reaches the same operation", async () => {
    const response = await validateV3ResponseFromRawInput({
      body: { operation: "create", data: { surveyId: SURVEY_ID, finished: true, data: {} } },
      authentication,
      requestId: "req-1",
      instance: "/api/v3/responses/validate",
    });

    expect(response.status).toBe(200);
    expect((await bodyOf(response)).valid).toBe(true);
  });
});
