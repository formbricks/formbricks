import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { problemForbidden } from "@/app/api/v3/lib/response";
import {
  batchDeleteV3Responses,
  countV3ResponsesOperation,
  deleteV3Response,
  getV3Response,
  listV3Responses,
} from "./operations";

vi.mock("server-only", () => ({}));

/**
 * The list operation fingerprints its filters, and `vitestSetup.ts` mocks `createHash` globally to
 * return the literal "fake-hash" — calling `.update()` on which throws, so every list call would
 * answer 500 from the catch block rather than exercising anything. Restored for the same reason
 * `keyset-cursor.test.ts` restores it.
 */
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

const {
  mockRequireAccess,
  mockGetWorkspaceId,
  mockDelete,
  mockBatchDelete,
  mockKeysetPage,
  mockHydrate,
  mockCount,
  mockGetScoped,
  mockGetSurveys,
} = vi.hoisted(() => ({
  mockRequireAccess: vi.fn(),
  mockGetWorkspaceId: vi.fn(),
  mockDelete: vi.fn(),
  mockBatchDelete: vi.fn(),
  mockKeysetPage: vi.fn(),
  mockHydrate: vi.fn(),
  mockCount: vi.fn(),
  mockGetScoped: vi.fn(),
  mockGetSurveys: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: mockRequireAccess }));
vi.mock("./service", () => ({
  getResponseWorkspaceId: mockGetWorkspaceId,
  deleteScopedResponse: mockDelete,
  deleteScopedResponses: mockBatchDelete,
  listV3ResponseKeysetPage: mockKeysetPage,
  hydrateV3Responses: mockHydrate,
  countV3Responses: mockCount,
  getScopedV3Response: mockGetScoped,
  getV3ResponseSurveys: mockGetSurveys,
}));
/**
 * The write half is mocked out wholesale here: this file covers the read and delete operations, and
 * loading `write-service` for real pulls in the BullMQ producer through `@/app/lib/pipelines`, which
 * does not load under the unit harness. The writes have their own suite.
 */
vi.mock("./write-service", () => ({
  getSurveyForV3Write: vi.fn(),
  createScopedResponse: vi.fn(),
  updateScopedResponse: vi.fn(),
  readbackV3Response: vi.fn(),
  dispatchV3ResponsePipeline: vi.fn(),
  normalizeV3Ttc: vi.fn(() => ({})),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }) },
}));

const params = {
  responseId: "clrsaaaaaaaaaaaaaaaaaaaa",
  authentication: { apiKeyId: "key_1", workspacePermissions: [] } as never,
  requestId: "req_1",
  instance: "/api/v3/responses/clrsaaaaaaaaaaaaaaaaaaaa",
};

const wire = async (res: Response) => ({
  status: res.status,
  headers: Object.fromEntries([...res.headers.entries()].sort()),
  body: res.status === 204 ? null : await res.json(),
});

const DELETED_ROW = {
  id: "clrsaaaaaaaaaaaaaaaaaaaa",
  finished: true,
  surveyId: "svy_1",
  data: { q1: "answer" },
} as never;

describe("deleteV3Response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAccess.mockResolvedValue({ workspaceId: "ws_1", organizationId: "org_1" });
    mockDelete.mockResolvedValue(DELETED_ROW);
  });

  test("deletes and answers 204 with no body", async () => {
    mockGetWorkspaceId.mockResolvedValue("ws_1");

    const response = await deleteV3Response(params);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(mockDelete).toHaveBeenCalledWith(params.responseId, { workspaceId: "ws_1" });
  });

  test("requires `manage`, not `readWrite`", async () => {
    mockGetWorkspaceId.mockResolvedValue("ws_1");

    await deleteV3Response(params);

    expect(mockRequireAccess).toHaveBeenCalledWith(
      params.authentication,
      "ws_1",
      "manage",
      params.requestId,
      params.instance
    );
  });

  /**
   * The anti-enumeration property, and the reason it is asserted as body equality rather than matching
   * status codes: two 403s differing by one word in `detail` still tell a caller which ids exist.
   *
   * Three routes have to converge on the identical body — a response that does not exist, one in another
   * workspace (the authorization refusal), and one deleted between the scope lookup and the delete
   * (P2025, which the service turns into `ResourceNotFoundError`).
   */
  test("a missing, a forbidden and a raced response are byte-identical", async () => {
    mockGetWorkspaceId.mockResolvedValue(null);
    const missing = await wire(await deleteV3Response(params));

    mockGetWorkspaceId.mockResolvedValue("ws_1");
    mockRequireAccess.mockResolvedValue(problemForbidden(params.requestId, undefined, params.instance));
    const forbidden = await wire(await deleteV3Response(params));

    mockRequireAccess.mockResolvedValue({ workspaceId: "ws_1", organizationId: "org_1" });
    mockDelete.mockRejectedValue(new ResourceNotFoundError("Response", null));
    const raced = await wire(await deleteV3Response(params));

    expect(missing.status).toBe(403);
    expect(missing).toStrictEqual(forbidden);
    expect(raced).toStrictEqual(forbidden);
  });

  /**
   * `instance` is the request URI, so it echoes the id the caller already sent — that is RFC 9457 and no
   * disclosure. What must not happen is the id appearing in `detail`, where it would differ between a
   * missing and a forbidden response and become the oracle the 403 exists to prevent.
   */
  test("never names the response outside the request URI it was given", async () => {
    mockGetWorkspaceId.mockResolvedValue(null);

    const body = await (await deleteV3Response(params)).json();

    expect(body.detail).not.toContain(params.responseId);
    expect(body.title).not.toContain(params.responseId);
    expect(body.instance).toBe(params.instance);
  });

  test("returns a problem response rather than throwing, since MCP calls this without a wrapper", async () => {
    mockGetWorkspaceId.mockResolvedValue("ws_1");
    mockDelete.mockRejectedValue(new Error("something unexpected"));

    const response = await deleteV3Response(params);

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("something unexpected");
  });

  test("records the target on the audit log", async () => {
    mockGetWorkspaceId.mockResolvedValue("ws_1");
    const auditLog = {} as never;

    await deleteV3Response({ ...params, auditLog });

    expect(auditLog).toMatchObject({ targetId: params.responseId, organizationId: "org_1" });
  });

  /**
   * The row is gone after this, so the audit event is the only remaining record of what was destroyed.
   * v1, v2 and `deleteV3FeedbackRecord` all record `oldObject`; a delete that omits it leaves an entry
   * saying something was deleted and nothing about what.
   */
  test("records the deleted response as the audit event's oldObject", async () => {
    mockGetWorkspaceId.mockResolvedValue("ws_1");
    const auditLog = {} as never;

    await deleteV3Response({ ...params, auditLog });

    expect(auditLog).toHaveProperty("oldObject", DELETED_ROW);
  });

  test("records no oldObject when the delete never happened", async () => {
    mockGetWorkspaceId.mockResolvedValue(null);
    const auditLog = {} as never;

    await deleteV3Response({ ...params, auditLog });

    expect(auditLog).not.toHaveProperty("oldObject");
  });
});

describe("batchDeleteV3Responses", () => {
  const batchParams = {
    workspaceId: "clsww11111111111111111111",
    ids: ["clrsaaaaaaaaaaaaaaaaaaaa", "clrsbbbbbbbbbbbbbbbbbbbb"],
    authentication: { apiKeyId: "key_1", workspacePermissions: [] } as never,
    requestId: "req_1",
    instance: "/api/v3/responses/batch-delete",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAccess.mockResolvedValue({ organizationId: "org_1", workspaceId: batchParams.workspaceId });
    mockBatchDelete.mockResolvedValue({ deleted: 2, deletedIds: batchParams.ids });
  });

  /**
   * `manage`, not `write` — the same permission the single delete takes, and the reason a read-write
   * key cannot erase a hundred responses in one call.
   */
  test("requires manage on the supplied workspace", async () => {
    await batchDeleteV3Responses(batchParams);

    expect(mockRequireAccess).toHaveBeenCalledWith(
      batchParams.authentication,
      batchParams.workspaceId,
      "manage",
      batchParams.requestId,
      batchParams.instance
    );
  });

  /**
   * The scope is authorized and then handed to the service unchanged. If these two could differ, a
   * caller could pass a workspace it holds and ids it does not — which is the cross-tenant delete the
   * single-response path avoids by deriving the scope instead.
   */
  test("filters by exactly the workspace it authorized against", async () => {
    await batchDeleteV3Responses(batchParams);

    expect(mockBatchDelete).toHaveBeenCalledWith(batchParams.ids, { workspaceId: batchParams.workspaceId });
  });

  test("refuses without touching the data when access is denied", async () => {
    mockRequireAccess.mockResolvedValue(problemForbidden("req_1", undefined, batchParams.instance));

    const response = await batchDeleteV3Responses(batchParams);

    expect(response.status).toBe(403);
    expect(mockBatchDelete).not.toHaveBeenCalled();
  });

  test("returns the count the service reported", async () => {
    const { status, body } = await wire(await batchDeleteV3Responses(batchParams));

    expect(status).toBe(200);
    expect(body).toStrictEqual({ data: { deleted: 2 } });
  });

  /**
   * A shortfall is the documented outcome of scope-filtering, not a failure: ids already gone or
   * belonging to another workspace are simply not counted. Zero is a 200 like any other.
   */
  test("reports a shortfall as success, including zero", async () => {
    mockBatchDelete.mockResolvedValue({ deleted: 0, deletedIds: [] });

    const { status, body } = await wire(await batchDeleteV3Responses(batchParams));

    expect(status).toBe(200);
    expect(body).toStrictEqual({ data: { deleted: 0 } });
  });

  test("records the ids it destroyed on the audit log, with both counts", async () => {
    const auditLog = {} as never;

    await batchDeleteV3Responses({ ...batchParams, auditLog });

    expect(auditLog).toMatchObject({
      organizationId: "org_1",
      oldObject: {
        workspaceId: batchParams.workspaceId,
        requested: 2,
        deleted: 2,
        responseIds: batchParams.ids,
      },
    });
  });

  test("returns a problem response rather than throwing, since MCP calls this without a wrapper", async () => {
    mockBatchDelete.mockRejectedValue(new Error("something unexpected"));

    const response = await batchDeleteV3Responses(batchParams);

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("something unexpected");
  });
});

const WORKSPACE = "clwsaaaaaaaaaaaaaaaaaaaa";
const read = {
  authentication: { apiKeyId: "key_1", workspacePermissions: [] } as never,
  requestId: "req_1",
  instance: "/api/v3/responses",
};
const query = (q: string) => new URLSearchParams(q);

/** A survey and a row thin enough to serialize, so these assert the operation rather than the mapper. */
const SURVEY = {
  id: "clsvaaaaaaaaaaaaaaaaaaaa",
  name: "Survey",
  workspaceId: WORKSPACE,
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  blocks: [],
  languages: [],
  embeddedDataLinks: [],
  embeddedFields: [],
};
const ROW = {
  id: "clrsaaaaaaaaaaaaaaaaaaaa",
  surveyId: SURVEY.id,
  createdAt: new Date("2026-09-02T00:00:00.000Z"),
  updatedAt: new Date("2026-09-02T00:00:00.000Z"),
  finished: true,
  endingId: null,
  language: null,
  data: {},
  variables: {},
  ttc: {},
  meta: {},
  displayId: null,
  singleUseId: null,
  contact: null,
  tags: [],
};

describe("the read operations authorize before they read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSurveys.mockResolvedValue(new Map([[SURVEY.id, SURVEY]]));
  });

  test.each([
    ["list", () => listV3Responses({ ...read, searchParams: query(`workspaceId=${WORKSPACE}`) })],
    ["count", () => countV3ResponsesOperation({ ...read, searchParams: query(`workspaceId=${WORKSPACE}`) })],
  ])("%s returns the access Response and touches no service", async (_label, run) => {
    const denied = problemForbidden("req_1", undefined, "/api/v3/responses");
    mockRequireAccess.mockResolvedValue(denied);

    expect((await run()).status).toBe(403);
    expect(mockKeysetPage).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
  });

  /**
   * A bad query must not reach the auth call either — it is a 400 before anything is looked up.
   *
   * The offender is a malformed `limit` rather than a malformed `workspaceId`: `z.cuid2()`
   * constrains the charset but not the length, so a short lowercase string like `nope` parses fine
   * and is refused later, as a 403 against a workspace that does not exist.
   */
  test("an invalid query is refused before authorization", async () => {
    const res = await listV3Responses({
      ...read,
      searchParams: query(`workspaceId=${WORKSPACE}&limit=0`),
    });

    expect(res.status).toBe(400);
    expect(mockRequireAccess).not.toHaveBeenCalled();
  });
});

describe("listV3Responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAccess.mockResolvedValue({ workspaceId: WORKSPACE, organizationId: "org_1" });
    mockGetSurveys.mockResolvedValue(new Map([[SURVEY.id, SURVEY]]));
    mockKeysetPage.mockResolvedValue([{ id: ROW.id, createdAt: ROW.createdAt, surveyId: ROW.surveyId }]);
    mockHydrate.mockResolvedValue([ROW]);
  });

  /**
   * All four meta keys are required by the contract, with `null` — not absence — when no total was
   * asked for, so a caller can branch on the value without first checking the key exists.
   */
  test("meta carries all four keys, with nulls when no total was requested", async () => {
    const body = await (
      await listV3Responses({ ...read, searchParams: query(`workspaceId=${WORKSPACE}`) })
    ).json();

    expect(Object.keys(body.meta).sort()).toEqual([
      "limit",
      "nextCursor",
      "totalCount",
      "totalCountRelation",
    ]);
    expect(body.meta.totalCount).toBeNull();
    expect(body.meta.totalCountRelation).toBeNull();
    expect(mockCount).not.toHaveBeenCalled();
  });

  test("the total is fetched only when asked for, and reported with its relation", async () => {
    mockCount.mockResolvedValue({ count: 10_000, relation: "gte" });

    const body = await (
      await listV3Responses({
        ...read,
        searchParams: query(`workspaceId=${WORKSPACE}&includeTotalCount=true`),
      })
    ).json();

    expect(body.meta.totalCount).toBe(10_000);
    expect(body.meta.totalCountRelation).toBe("gte");
  });

  /** A response whose survey vanished between the two queries cannot be serialized against one. */
  test("a row whose survey is missing is dropped rather than failing the page", async () => {
    mockGetSurveys.mockResolvedValue(new Map());

    const res = await listV3Responses({ ...read, searchParams: query(`workspaceId=${WORKSPACE}`) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  test("every 200 carries the request id and a private, no-store cache directive", async () => {
    const res = await listV3Responses({ ...read, searchParams: query(`workspaceId=${WORKSPACE}`) });

    expect(res.headers.get("x-request-id")).toBe("req_1");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("getV3Response", () => {
  const idParams = { ...read, responseId: ROW.id, instance: `/api/v3/responses/${ROW.id}` };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSurveys.mockResolvedValue(new Map([[SURVEY.id, SURVEY]]));
  });

  /**
   * The property the contract rests on: a response that does not exist, one in another workspace and
   * one deleted mid-request must be indistinguishable. Compared as bytes, because two 403s differing
   * by a word are still an oracle.
   */
  test("the three 403 exits are byte-identical", async () => {
    mockGetWorkspaceId.mockResolvedValueOnce(null);
    const missing = await (await getV3Response(idParams)).text();

    mockGetWorkspaceId.mockResolvedValueOnce(WORKSPACE);
    mockRequireAccess.mockResolvedValueOnce(problemForbidden("req_1", undefined, idParams.instance));
    const foreign = await (await getV3Response(idParams)).text();

    mockGetWorkspaceId.mockResolvedValueOnce(WORKSPACE);
    mockRequireAccess.mockResolvedValueOnce({ workspaceId: WORKSPACE, organizationId: "org_1" });
    mockGetScoped.mockResolvedValueOnce(null);
    const raced = await (await getV3Response(idParams)).text();

    expect(missing).toBe(foreign);
    expect(foreign).toBe(raced);
  });

  test("a readable response comes back as a bare data envelope", async () => {
    mockGetWorkspaceId.mockResolvedValue(WORKSPACE);
    mockRequireAccess.mockResolvedValue({ workspaceId: WORKSPACE, organizationId: "org_1" });
    mockGetScoped.mockResolvedValue(ROW);

    const res = await getV3Response(idParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Object.keys(body)).toEqual(["data"]);
    expect(body.data.id).toBe(ROW.id);
  });
});

describe("countV3ResponsesOperation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAccess.mockResolvedValue({ workspaceId: WORKSPACE, organizationId: "org_1" });
  });

  test("returns count and relation in a bare data envelope, with no meta", async () => {
    mockCount.mockResolvedValue({ count: 42, relation: "eq" });

    const body = await (
      await countV3ResponsesOperation({ ...read, searchParams: query(`workspaceId=${WORKSPACE}`) })
    ).json();

    expect(Object.keys(body)).toEqual(["data"]);
    expect(body.data).toEqual({ count: 42, relation: "eq" });
  });

  test("passes the requested precision through", async () => {
    mockCount.mockResolvedValue({ count: 1, relation: "eq" });

    await countV3ResponsesOperation({
      ...read,
      searchParams: query(`workspaceId=${WORKSPACE}&precision=exact`),
    });

    expect(mockCount).toHaveBeenCalledWith(expect.objectContaining({ precision: "exact" }));
  });
});
