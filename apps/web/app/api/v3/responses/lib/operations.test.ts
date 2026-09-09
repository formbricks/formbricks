import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { batchDeleteV3Responses, deleteV3Response } from "./operations";

vi.mock("server-only", () => ({}));

const { mockRequireAccess, mockGetWorkspaceId, mockDelete, mockBatchDelete } = vi.hoisted(() => ({
  mockRequireAccess: vi.fn(),
  mockGetWorkspaceId: vi.fn(),
  mockDelete: vi.fn(),
  mockBatchDelete: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: mockRequireAccess }));
vi.mock("./service", () => ({
  getResponseWorkspaceId: mockGetWorkspaceId,
  deleteScopedResponse: mockDelete,
  deleteScopedResponses: mockBatchDelete,
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
