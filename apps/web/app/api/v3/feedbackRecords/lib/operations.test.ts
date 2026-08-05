import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  countFeedbackRecords,
  createFeedbackRecord,
  createFeedbackRecordsBatch,
  deleteFeedbackRecord,
  findSimilarFeedbackRecords,
  listFeedbackRecords,
  retrieveFeedbackRecord,
  semanticSearchFeedbackRecords,
  updateFeedbackRecord,
} from "@/modules/hub/service";
import type { FeedbackRecordData } from "@/modules/hub/types";
import {
  countV3FeedbackRecords,
  createV3FeedbackRecord,
  createV3FeedbackRecords,
  deleteV3FeedbackRecord,
  findSimilarV3FeedbackRecords,
  getV3FeedbackRecord,
  listV3FeedbackDatasets,
  listV3FeedbackRecords,
  searchV3FeedbackRecords,
  updateV3FeedbackRecord,
} from "./operations";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() })) },
}));

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsFeedbackDirectoriesEnabled: vi.fn() }));
vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: vi.fn(),
}));
vi.mock("@/modules/hub/service", () => ({
  listFeedbackRecords: vi.fn(),
  countFeedbackRecords: vi.fn(),
  createFeedbackRecordsBatch: vi.fn(),
  retrieveFeedbackRecord: vi.fn(),
  createFeedbackRecord: vi.fn(),
  deleteFeedbackRecord: vi.fn(),
  semanticSearchFeedbackRecords: vi.fn(),
  findSimilarFeedbackRecords: vi.fn(),
  updateFeedbackRecord: vi.fn(),
}));

const workspaceId = "clxx1234567890123456789012";
const directoryId = "clfd1234567890123456789012";
const otherDirectoryId = "clfd9999999999999999999999";
const context: V3WorkspaceContext = { workspaceId, organizationId: "org_1" };
const instance = "/api/mcp";
const requestId = "req_1";
const base = { authentication: null, workspaceId, requestId, instance };

const record: FeedbackRecordData = {
  id: "019fa338-f494-7384-b34e-01739783d280",
  collected_at: "2026-07-01T00:00:00.000Z",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
  field_id: "q1",
  field_type: "text",
  source_type: "survey",
  submission_id: "sub-1",
  tenant_id: directoryId,
  value_text: "Love it",
};

// A person-shaped principal, as an OAuth/MCP token produces. The shared `base` passes `authentication:
// null`, which the mutation-role gate skips, so these are used where the caller's role is the subject.
const sessionAuth = { user: { id: "user_1" } } as TV3Authentication;
const apiKeyAuth = { apiKeyId: "key_1" } as unknown as TV3Authentication;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(context);
  vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
  vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([{ id: directoryId, name: "Support" }]);
  vi.mocked(checkAuthorizationUpdated).mockResolvedValue(true);
});

describe("shared authorization + tenant resolution", () => {
  test("returns the auth Response and skips downstream work when access is denied", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(denied);

    const response = await listV3FeedbackRecords(base);

    expect(response).toBe(denied);
    expect(getIsFeedbackDirectoriesEnabled).not.toHaveBeenCalled();
    expect(listFeedbackRecords).not.toHaveBeenCalled();
  });

  test("returns 403 when the feedbackDirectories feature is not licensed", async () => {
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(false);

    const response = await listV3FeedbackRecords(base);

    expect(response.status).toBe(403);
    expect(listFeedbackRecords).not.toHaveBeenCalled();
  });

  // An agent can only help the user if the dead-end says who does what, and where — so the detail has
  // to name the role and the settings location, not just the problem.
  test("returns an actionable 422 when no dataset is assigned to the workspace", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([]);

    const response = await listV3FeedbackRecords(base);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.detail).toContain("organization owner or manager");
    expect(body.detail).toContain("Settings → Organization → Feedback Datasets");
    expect(listFeedbackRecords).not.toHaveBeenCalled();
  });

  test("returns 400 when multiple datasets exist and none is specified", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([
      { id: directoryId, name: "A" },
      { id: otherDirectoryId, name: "B" },
    ]);

    const response = await listV3FeedbackRecords(base);

    expect(response.status).toBe(400);
  });

  // The resolver normalises the id it hands back as `dataset_id`, so a caller echoing that value on its
  // next request must still match. Comparing the raw id would 403 a legitimate round trip.
  test("accepts the normalised datasetId it would have echoed back", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([
      { id: ` ${directoryId} `, name: "Support" },
    ]);
    vi.mocked(listFeedbackRecords).mockResolvedValue({
      data: { data: [], limit: 50, next_cursor: undefined },
      error: null,
    });

    const response = await listV3FeedbackRecords({ ...base, datasetId: directoryId });

    expect(response.status).toBe(200);
    expect(vi.mocked(listFeedbackRecords).mock.calls[0][0].tenant_id).toBe(directoryId);
  });

  test("returns 403 when an explicit datasetId is not assigned to the workspace", async () => {
    const response = await listV3FeedbackRecords({ ...base, datasetId: otherDirectoryId });

    expect(response.status).toBe(403);
    expect(listFeedbackRecords).not.toHaveBeenCalled();
  });
});

describe("listV3FeedbackDatasets", () => {
  test("returns the workspace's active datasets", async () => {
    const response = await listV3FeedbackDatasets(base);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ id: directoryId, name: "Support" }],
      meta: { nextCursor: null, totalCount: 1 },
    });
  });

  // This operation stops at the shared access+entitlement gate rather than the tenant resolver, so its
  // own denial branches need pinning too.
  test("returns the auth Response when workspace access is denied", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(denied);

    const response = await listV3FeedbackDatasets(base);

    expect(response).toBe(denied);
    expect(getFeedbackDirectoriesByWorkspaceId).not.toHaveBeenCalled();
  });

  test("returns 403 when the feedbackDirectories feature is not licensed", async () => {
    vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(false);

    const response = await listV3FeedbackDatasets(base);

    expect(response.status).toBe(403);
    expect(getFeedbackDirectoriesByWorkspaceId).not.toHaveBeenCalled();
  });

  test("returns an empty list when the workspace has no dataset", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([]);

    const response = await listV3FeedbackDatasets(base);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [], meta: { nextCursor: null, totalCount: 0 } });
  });
});

describe("listV3FeedbackRecords", () => {
  test("auto-resolves the single dataset as the Hub tenant and returns serialized records", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue({
      data: { data: [record], limit: 50, next_cursor: "next" },
      error: null,
    });

    const response = await listV3FeedbackRecords({ ...base, source_type: "survey", field_type: "text" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listFeedbackRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: directoryId,
        limit: 50,
        source_type: "survey",
        field_type: "text",
      })
    );
    expect(body.meta).toEqual({
      limit: 50,
      nextCursor: "next",
      datasetId: directoryId,
      datasetName: "Support",
    });
    expect(body.data[0].id).toBe(record.id);
    expect(body.data[0].value_text).toBe("Love it");
  });

  // An empty list used to be ambiguous — a caller could not tell "this dataset has no matching records"
  // from "I don't know which dataset was searched", and had to make a second call to find out. The
  // response now names the dataset it resolved, empty or not.
  test("names the resolved dataset even when no records match", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue({
      data: { data: [], limit: 50, next_cursor: undefined },
      error: null,
    });

    const body = await (await listV3FeedbackRecords(base)).json();

    expect(body.data).toEqual([]);
    expect(body.meta.datasetId).toBe(directoryId);
    expect(body.meta.datasetName).toBe("Support");
  });

  test("names the dataset the caller asked for when one is given explicitly", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([
      { id: directoryId, name: "Support" },
      { id: otherDirectoryId, name: "Sales" },
    ]);
    vi.mocked(listFeedbackRecords).mockResolvedValue({
      data: { data: [], limit: 50, next_cursor: undefined },
      error: null,
    });

    const body = await (await listV3FeedbackRecords({ ...base, datasetId: otherDirectoryId })).json();

    expect(body.meta.datasetId).toBe(otherDirectoryId);
    expect(body.meta.datasetName).toBe("Sales");
  });

  // The Hub's `tenant_id` is Hub-internal vocabulary; the outward-facing name is `dataset_id`. Same
  // value, and `tenant_id` must not appear in a response at all.
  test("emits the tenant as dataset_id and never as tenant_id", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue({
      data: { data: [record], limit: 50, next_cursor: undefined },
      error: null,
    });

    const body = await (await listV3FeedbackRecords(base)).json();

    expect(body.data[0].dataset_id).toBe(directoryId);
    expect(body.data[0]).not.toHaveProperty("tenant_id");
    expect(JSON.stringify(body)).not.toContain("tenant_id");
  });

  test("maps a Hub rate-limit error to 429", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue({
      data: null,
      error: { status: 429, message: "slow down", detail: "slow down" },
    });

    const response = await listV3FeedbackRecords(base);

    expect(response.status).toBe(429);
  });

  test("maps a Hub server/unreachable error to 502 without leaking the detail", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue({
      data: null,
      error: { status: 0, message: "ECONNREFUSED at 10.0.0.1", detail: "ECONNREFUSED at 10.0.0.1" },
    });

    const response = await listV3FeedbackRecords(base);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });
});

describe("getV3FeedbackRecord", () => {
  const getBase = { ...base, feedbackRecordId: record.id };

  test("returns the record when its tenant belongs to the workspace", async () => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({ data: record, error: null });

    const response = await getV3FeedbackRecord(getBase);

    expect(response.status).toBe(200);
    expect((await response.json()).data.id).toBe(record.id);
  });

  test("returns 403 (no existence oracle) when the record belongs to another tenant", async () => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: { ...record, tenant_id: otherDirectoryId },
      error: null,
    });

    const response = await getV3FeedbackRecord(getBase);

    expect(response.status).toBe(403);
  });

  test("returns 403 when the Hub reports 404 (indistinguishable from cross-tenant)", async () => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: null,
      error: { status: 404, message: "not found", detail: "not found" },
    });

    const response = await getV3FeedbackRecord(getBase);

    expect(response.status).toBe(403);
  });

  // The no-existence-oracle guarantee: cross-tenant and not-found must be byte-identical, not merely
  // both 403 — a one-sided message tweak would otherwise silently reopen the oracle.
  test("returns an identical body for cross-tenant and not-found", async () => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: { ...record, tenant_id: otherDirectoryId },
      error: null,
    });
    const crossTenant = await getV3FeedbackRecord(getBase).then((r) => r.json());

    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: null,
      error: { status: 404, message: "not found", detail: "not found" },
    });
    const notFound = await getV3FeedbackRecord(getBase).then((r) => r.json());

    expect(crossTenant).toEqual(notFound);
  });

  // A Hub failure that isn't a 404 is an upstream problem, not an authorization one — collapsing it into
  // the 403 would tell the caller its permissions are wrong when the service is simply down.
  test("maps a non-404 Hub failure on retrieval to 502, not 403", async () => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: null,
      error: { status: 500, message: "boom", detail: "boom" },
    });

    const response = await getV3FeedbackRecord(getBase);

    expect(response.status).toBe(502);
  });

  test("rejects a record from another directory the workspace owns when a directory is named", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([
      { id: directoryId, name: "A" },
      { id: otherDirectoryId, name: "B" },
    ]);
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: { ...record, tenant_id: otherDirectoryId },
      error: null,
    });

    const response = await getV3FeedbackRecord({ ...getBase, datasetId: directoryId });

    expect(response.status).toBe(403);
  });
});

describe("createV3FeedbackRecord", () => {
  const createdRecord: FeedbackRecordData = { ...record, source_type: "call_notes", value_text: "hi" };

  beforeEach(() => {
    vi.mocked(createFeedbackRecord).mockResolvedValue({ data: createdRecord, error: null });
  });

  test("requires readWrite access", async () => {
    await createV3FeedbackRecord({
      ...base,
      body: { source_type: "call_notes", field_id: "note", field_type: "text", value_text: "hi" },
    });

    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      null,
      workspaceId,
      "readWrite",
      requestId,
      instance
    );
  });

  test("injects the resolved tenant_id and ignores any tenant_id in the body", async () => {
    await createV3FeedbackRecord({
      ...base,
      body: {
        source_type: "call_notes",
        field_id: "note",
        field_type: "text",
        value_text: "hi",
        tenant_id: "attacker-tenant",
      },
    });

    const callArg = vi.mocked(createFeedbackRecord).mock.calls[0][0];
    expect(callArg.tenant_id).toBe(directoryId);
    expect(callArg.tenant_id).not.toBe("attacker-tenant");
  });

  test("generates a submission_id when omitted", async () => {
    await createV3FeedbackRecord({
      ...base,
      body: { source_type: "call_notes", field_id: "note", field_type: "text", value_text: "hi" },
    });

    const callArg = vi.mocked(createFeedbackRecord).mock.calls[0][0];
    expect(typeof callArg.submission_id).toBe("string");
    expect(callArg.submission_id.length).toBeGreaterThan(0);
  });

  test("returns 201 and stamps the audit log on success", async () => {
    const auditLog = { status: "attempted" } as unknown as TV3AuditLog;

    const response = await createV3FeedbackRecord({
      ...base,
      auditLog,
      body: { source_type: "call_notes", field_id: "note", field_type: "text", value_text: "hi" },
    });

    expect(response.status).toBe(201);
    expect(auditLog.organizationId).toBe("org_1");
    expect(auditLog.targetId).toBe(createdRecord.id);
    expect(auditLog.newObject).toBeDefined();
  });

  test("returns 422 for an invalid body (bad field_type) before calling the Hub", async () => {
    const response = await createV3FeedbackRecord({
      ...base,
      body: { source_type: "call_notes", field_id: "note", field_type: "not-a-type", value_text: "hi" },
    });

    expect(response.status).toBe(422);
    expect(createFeedbackRecord).not.toHaveBeenCalled();
  });

  // The Hub still owns content rules we don't duplicate (NUL bytes, its own limits) and reports them as
  // 400 — its field-level detail must reach the caller, or an agent can't correct its own request.
  // (Verified against a real Hub: a NUL byte in value_text produces exactly this shape.)
  test("relays the Hub's validation detail and invalid_params on a 400", async () => {
    vi.mocked(createFeedbackRecord).mockResolvedValue({
      data: null,
      error: {
        status: 400,
        message: "400 Bad Request",
        detail: "400 Bad Request",
        code: "validation",
        problemDetail: "One or more request parameters are invalid",
        invalidParams: [{ name: "value_text", reason: "must not contain NULL bytes" }],
      },
    });

    const response = await createV3FeedbackRecord({
      ...base,
      body: { source_type: "call_notes", field_id: "note", field_type: "text", value_text: "hi" },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.detail).toBe("One or more request parameters are invalid");
    expect(body.invalid_params).toEqual([{ name: "value_text", reason: "must not contain NULL bytes" }]);
  });

  // The Hub accepts a record with no value at all, and MCP strips unknown keys before we see them, so a
  // mistyped field name would otherwise store an empty record and report success.
  test("rejects a body whose field_type has no matching value, naming the expected field", async () => {
    const response = await createV3FeedbackRecord({
      ...base,
      // `valueText` is what an agent typo looks like after MCP has stripped it: no value at all.
      body: { source_type: "call_notes", field_id: "note", field_type: "text" },
    });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.invalid_params).toEqual([
      expect.objectContaining({ name: "value_text", reason: expect.stringContaining("field_type") }),
    ]);
    expect(createFeedbackRecord).not.toHaveBeenCalled();
  });

  test.each([
    ["nps", "value_number"],
    ["boolean", "value_boolean"],
    ["date", "value_date"],
  ])("requires %s to carry %s", async (fieldType, expectedField) => {
    const response = await createV3FeedbackRecord({
      ...base,
      body: { source_type: "survey", field_id: "q", field_type: fieldType },
    });

    expect(response.status).toBe(422);
    expect((await response.json()).invalid_params[0].name).toBe(expectedField);
  });

  test("accepts a categorical record identified only by value_id", async () => {
    const response = await createV3FeedbackRecord({
      ...base,
      body: { source_type: "survey", field_id: "q", field_type: "categorical", value_id: "opt_1" },
    });

    expect(response.status).toBe(201);
  });

  test("maps a Hub duplicate/purge conflict to 409 rather than a misleading 502", async () => {
    vi.mocked(createFeedbackRecord).mockResolvedValue({
      data: null,
      error: {
        status: 409,
        message: "409 Conflict",
        detail: "409 Conflict",
        problemDetail: "duplicate record for (tenant_id, submission_id, field_id)",
      },
    });

    const response = await createV3FeedbackRecord({
      ...base,
      body: { source_type: "call_notes", field_id: "note", field_type: "text", value_text: "hi" },
    });

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toContain("duplicate record");
  });

  test("relays the Hub's own size-limit detail on a 413", async () => {
    vi.mocked(createFeedbackRecord).mockResolvedValue({
      data: null,
      error: {
        status: 413,
        message: "413",
        detail: "413",
        problemDetail: "request body exceeds 512 KiB",
      },
    });

    const relayed = await createV3FeedbackRecord({
      ...base,
      body: { source_type: "call_notes", field_id: "note", field_type: "text", value_text: "hi" },
    });

    expect(relayed.status).toBe(413);
    expect((await relayed.json()).detail).toContain("512 KiB");
  });

  test("maps a Hub 413 to payload-too-large rather than a misleading 502", async () => {
    vi.mocked(createFeedbackRecord).mockResolvedValue({
      data: null,
      error: { status: 413, message: "too big", detail: "too big" },
    });

    const response = await createV3FeedbackRecord({
      ...base,
      body: { source_type: "call_notes", field_id: "note", field_type: "text", value_text: "hi" },
    });

    expect(response.status).toBe(413);
  });

  // The cap is a byte budget, so it must not be fooled by multi-byte characters: 20k CJK characters is
  // ~60 KB of UTF-8 but only 20k UTF-16 code units.
  test("measures the metadata cap in bytes, not string length", async () => {
    const response = await createV3FeedbackRecord({
      ...base,
      body: {
        source_type: "call_notes",
        field_id: "note",
        field_type: "text",
        value_text: "hi",
        metadata: { blob: "字".repeat(20_000) },
      },
    });

    expect(response.status).toBe(422);
    expect(createFeedbackRecord).not.toHaveBeenCalled();
  });

  test("rejects oversized metadata locally instead of letting the Hub reject the request", async () => {
    const response = await createV3FeedbackRecord({
      ...base,
      body: {
        source_type: "call_notes",
        field_id: "note",
        field_type: "text",
        value_text: "hi",
        metadata: { blob: "x".repeat(40_000) },
      },
    });

    expect(response.status).toBe(422);
    expect(createFeedbackRecord).not.toHaveBeenCalled();
  });

  test("does not relay upstream detail on a Hub 5xx", async () => {
    vi.mocked(createFeedbackRecord).mockResolvedValue({
      data: null,
      error: {
        status: 500,
        message: "boom",
        detail: "boom",
        problemDetail: "panic: runtime error at 10.0.0.1",
      },
    });

    const response = await createV3FeedbackRecord({
      ...base,
      body: { source_type: "call_notes", field_id: "note", field_type: "text", value_text: "hi" },
    });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain("panic");
  });
});

describe("deleteV3FeedbackRecord", () => {
  // A session principal, not `base`'s null: these operations now require an identifiable caller, and
  // a null principal is refused upstream in production anyway.
  const deleteBase = { ...base, authentication: sessionAuth, feedbackRecordId: record.id };

  beforeEach(() => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({ data: record, error: null });
    vi.mocked(deleteFeedbackRecord).mockResolvedValue({ data: { deleted: true }, error: null });
  });

  test("requires readWrite access", async () => {
    await deleteV3FeedbackRecord(deleteBase);

    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      sessionAuth,
      workspaceId,
      "readWrite",
      requestId,
      instance
    );
  });

  test("returns 204 and deletes the record when it belongs to the workspace", async () => {
    const response = await deleteV3FeedbackRecord(deleteBase);

    expect(response.status).toBe(204);
    expect(deleteFeedbackRecord).toHaveBeenCalledWith(record.id);
  });

  // The whole point of the ownership guard: the Hub's delete derives the tenant from the record, so a
  // foreign id must be refused *before* the delete call — not merely reported as failed afterwards.
  test("refuses a cross-tenant record with 403 and never calls the Hub delete", async () => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: { ...record, tenant_id: otherDirectoryId },
      error: null,
    });

    const response = await deleteV3FeedbackRecord(deleteBase);

    expect(response.status).toBe(403);
    expect(deleteFeedbackRecord).not.toHaveBeenCalled();
  });

  test("refuses an unknown record with the same 403 body as a cross-tenant one", async () => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: { ...record, tenant_id: otherDirectoryId },
      error: null,
    });
    const crossTenant = await deleteV3FeedbackRecord(deleteBase).then((r) => r.json());

    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: null,
      error: { status: 404, message: "not found", detail: "not found" },
    });
    const notFoundResponse = await deleteV3FeedbackRecord(deleteBase);

    expect(notFoundResponse.status).toBe(403);
    expect(await notFoundResponse.json()).toEqual(crossTenant);
    expect(deleteFeedbackRecord).not.toHaveBeenCalled();
  });

  // The record is gone afterwards, so the audit entry is the only remaining trace of what was deleted.
  test("stamps the audit log with the target and the pre-delete record", async () => {
    const auditLog = { status: "failure" } as unknown as TV3AuditLog;

    await deleteV3FeedbackRecord({ ...deleteBase, auditLog });

    expect(auditLog.organizationId).toBe("org_1");
    expect(auditLog.targetId).toBe(record.id);
    expect(auditLog.oldObject).toEqual(expect.objectContaining({ id: record.id, value_text: "Love it" }));
    // Even in the audit log the outward name is used, so an exported log matches the API vocabulary.
    expect(auditLog.oldObject).not.toHaveProperty("tenant_id");
  });

  // Deleted concurrently between our ownership check and the delete call: the caller's intended end state
  // holds, and a 502 here would read as an outage and invite a retry loop against a record already gone.
  test("treats a concurrent delete (Hub 404) as success rather than a 502", async () => {
    vi.mocked(deleteFeedbackRecord).mockResolvedValue({
      data: null,
      error: { status: 404, message: "not found", detail: "not found" },
    });

    const response = await deleteV3FeedbackRecord(deleteBase);

    expect(response.status).toBe(204);
  });

  test("maps an in-progress tenant purge to a retryable 409", async () => {
    vi.mocked(deleteFeedbackRecord).mockResolvedValue({
      data: null,
      error: {
        status: 409,
        message: "409 Conflict",
        detail: "409 Conflict",
        problemDetail: "tenant data deletion in progress",
      },
    });

    const response = await deleteV3FeedbackRecord(deleteBase);

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toContain("tenant data deletion in progress");
  });
});

describe("searchV3FeedbackRecords", () => {
  const searchBase = { ...base, query: "checkout is confusing" };
  const match = {
    feedback_record_id: record.id,
    score: 0.82,
    field_label: "What can we improve?",
    value_text: "I couldn't figure out how to pay",
  };

  beforeEach(() => {
    vi.mocked(semanticSearchFeedbackRecords).mockResolvedValue({
      data: { data: [match], limit: 10, next_cursor: undefined },
      error: null,
    });
  });

  test("injects the resolved tenant and applies our defaults", async () => {
    const response = await searchV3FeedbackRecords(searchBase);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(semanticSearchFeedbackRecords).toHaveBeenCalledWith({
      tenant_id: directoryId,
      query: "checkout is confusing",
      limit: 10,
      min_score: 0.5,
    });
    expect(body.data).toEqual([match]);
    expect(body.meta).toEqual({
      limit: 10,
      nextCursor: null,
      minScore: 0.5,
      datasetId: directoryId,
      datasetName: "Support",
    });
  });

  // The Hub uses `tenant_id` verbatim in the vector query (no trimming of its own), so an untrimmed value
  // would match nothing and look like "no results" rather than a failure.
  test("trims the tenant before sending it to the Hub", async () => {
    vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([
      { id: ` ${directoryId} `, name: "Support" },
    ]);

    await searchV3FeedbackRecords({ ...searchBase, datasetId: ` ${directoryId} ` });

    expect(vi.mocked(semanticSearchFeedbackRecords).mock.calls[0][0].tenant_id).toBe(directoryId);
  });

  test("passes an explicit limit, cursor and minScore through", async () => {
    await searchV3FeedbackRecords({ ...searchBase, limit: 25, cursor: "abc", minScore: 0.9 });

    expect(semanticSearchFeedbackRecords).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25, cursor: "abc", min_score: 0.9 })
    );
  });

  // The Hub silently coerces out-of-range limit/min_score to its own defaults, so a caller would get
  // results that quietly don't match what it asked for. Rejected locally instead.
  test.each([
    ["limit", { limit: 999 }],
    ["limit", { limit: 0 }],
    ["minScore", { minScore: 1.1 }],
    ["minScore", { minScore: -1 }],
    ["query", { query: "" }],
  ])("rejects an out-of-range %s locally without calling the Hub", async (_field, override) => {
    const response = await searchV3FeedbackRecords({ ...searchBase, ...override });

    expect(response.status).toBe(422);
    expect((await response.json()).invalid_params.length).toBeGreaterThan(0);
    expect(semanticSearchFeedbackRecords).not.toHaveBeenCalled();
  });

  // Embeddings are optional in the Hub, so most self-hosted installs land here. A bare "unavailable"
  // leaves the caller with nothing to act on.
  test("turns the Hub's 503 into an actionable configuration message", async () => {
    vi.mocked(semanticSearchFeedbackRecords).mockResolvedValue({
      data: null,
      error: { status: 503, message: "unavailable", detail: "unavailable" },
    });

    const response = await searchV3FeedbackRecords(searchBase);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.detail).toContain("EMBEDDING_PROVIDER");
    expect(body.detail).toContain("EMBEDDING_MODEL");
  });

  test("reports an empty result against the named dataset rather than an error", async () => {
    vi.mocked(semanticSearchFeedbackRecords).mockResolvedValue({
      data: { data: [], limit: 10, next_cursor: undefined },
      error: null,
    });

    const body = await (await searchV3FeedbackRecords(searchBase)).json();

    expect(body.data).toEqual([]);
    expect(body.meta.datasetId).toBe(directoryId);
    expect(body.meta.minScore).toBe(0.5);
  });
});

describe("findSimilarV3FeedbackRecords", () => {
  const similarBase = { ...base, feedbackRecordId: record.id };
  const neighbour = {
    feedback_record_id: "019fa338-f494-7384-b34e-01739783d999",
    score: 0.77,
    field_label: "What can we improve?",
    value_text: "payment step was unclear",
  };

  beforeEach(() => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({ data: record, error: null });
    vi.mocked(findSimilarFeedbackRecords).mockResolvedValue({
      data: { data: [neighbour], limit: 10, next_cursor: undefined },
      error: null,
    });
  });

  test("returns the neighbours of an owned record", async () => {
    const response = await findSimilarV3FeedbackRecords(similarBase);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(findSimilarFeedbackRecords).toHaveBeenCalledWith(record.id, { limit: 10, min_score: 0.5 });
    expect(body.data).toEqual([neighbour]);
    expect(body.meta.datasetId).toBe(directoryId);
  });

  // Without the ownership guard this endpoint reads another tenant's records: the Hub scopes the
  // neighbour search to whatever tenant the anchor belongs to, with no authorization of its own.
  test("refuses a cross-tenant anchor with 403 and returns no neighbours", async () => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: { ...record, tenant_id: otherDirectoryId },
      error: null,
    });

    const response = await findSimilarV3FeedbackRecords(similarBase);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(findSimilarFeedbackRecords).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain(neighbour.feedback_record_id);
  });

  test("refuses an unknown anchor with the same 403 body as a cross-tenant one", async () => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: { ...record, tenant_id: otherDirectoryId },
      error: null,
    });
    const crossTenant = await findSimilarV3FeedbackRecords(similarBase).then((r) => r.json());

    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: null,
      error: { status: 404, message: "not found", detail: "not found" },
    });
    const notFound = await findSimilarV3FeedbackRecords(similarBase);

    expect(notFound.status).toBe(403);
    expect(await notFound.json()).toEqual(crossTenant);
  });

  // Once ownership is proven the Hub's 404 can only mean "no embedding for this record" — reporting it as
  // the generic 403 would be actively misleading, since the caller does own the record.
  test("reports a post-ownership 404 as a retryable embedding-pending conflict, not a 403", async () => {
    vi.mocked(findSimilarFeedbackRecords).mockResolvedValue({
      data: null,
      error: { status: 404, message: "not found", detail: "embedding not found" },
    });

    const response = await findSimilarV3FeedbackRecords(similarBase);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.detail).toContain("no embedding");
    expect(body.detail).toContain("background");
    // An update can *clear* a record's text, which removes its embedding for good — so the message must
    // not tell the caller to keep retrying something that will never succeed.
    expect(body.detail).toContain("retrying will not help");
  });

  test("turns the Hub's 503 into an actionable configuration message", async () => {
    vi.mocked(findSimilarFeedbackRecords).mockResolvedValue({
      data: null,
      error: { status: 503, message: "unavailable", detail: "unavailable" },
    });

    const response = await findSimilarV3FeedbackRecords(similarBase);

    expect(response.status).toBe(503);
    expect((await response.json()).detail).toContain("EMBEDDING_PROVIDER");
  });

  test("rejects an out-of-range minScore locally, before retrieving the record", async () => {
    const response = await findSimilarV3FeedbackRecords({ ...similarBase, minScore: 1.1 });

    expect(response.status).toBe(422);
    expect(retrieveFeedbackRecord).not.toHaveBeenCalled();
    expect(findSimilarFeedbackRecords).not.toHaveBeenCalled();
  });
});

describe("countV3FeedbackRecords", () => {
  beforeEach(() => {
    vi.mocked(countFeedbackRecords).mockResolvedValue({ data: { count: 42 }, error: null });
  });

  test("returns the count and names the dataset it came from", async () => {
    const response = await countV3FeedbackRecords(base);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { count: 42, dataset_id: directoryId, dataset_name: "Support" },
    });
    expect(countFeedbackRecords).toHaveBeenCalledWith({ tenant_id: directoryId });
  });

  // A count answers "how many" without any record content crossing the boundary — that is the whole point
  // of having it rather than making the caller page through records.
  test("returns no record content at all", async () => {
    const body = JSON.stringify(await (await countV3FeedbackRecords(base)).json());

    expect(body).not.toContain("value_text");
    expect(body).not.toContain("Love it");
  });

  test("passes every filter through under the Hub's parameter names", async () => {
    await countV3FeedbackRecords({
      ...base,
      source_type: "survey",
      source_id: "svy_1",
      field_type: "text",
      field_id: "q1",
      field_group_id: "grp_1",
      submission_id: "sub-1",
      user_id: "user-1",
      value_id: "opt_1",
      since: "2026-01-01T00:00:00Z",
      until: "2026-12-31T00:00:00Z",
    });

    expect(countFeedbackRecords).toHaveBeenCalledWith({
      tenant_id: directoryId,
      source_type: "survey",
      source_id: "svy_1",
      field_type: "text",
      field_id: "q1",
      field_group_id: "grp_1",
      submission_id: "sub-1",
      user_id: "user-1",
      value_id: "opt_1",
      since: "2026-01-01T00:00:00Z",
      until: "2026-12-31T00:00:00Z",
    });
  });

  test("cannot be pointed at another workspace's dataset", async () => {
    const response = await countV3FeedbackRecords({ ...base, datasetId: otherDirectoryId });

    expect(response.status).toBe(403);
    expect(countFeedbackRecords).not.toHaveBeenCalled();
  });

  test("maps a Hub failure through the shared error mapping", async () => {
    vi.mocked(countFeedbackRecords).mockResolvedValue({
      data: null,
      error: { status: 500, message: "boom", detail: "boom", problemDetail: "panic at 10.0.0.1" },
    });

    const response = await countV3FeedbackRecords(base);

    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("10.0.0.1");
  });
});

describe("list/count validate their own input", () => {
  // These operations are the transport-independent face of this surface, so they can't assume an MCP
  // schema screened the input first — and the Hub silently coerces an out-of-range limit to its default.
  test.each([
    ["limit", { limit: 5000 }],
    ["limit", { limit: 0 }],
    ["source_type", { source_type: "x".repeat(256) }],
  ])("listV3FeedbackRecords rejects an out-of-range %s without calling the Hub", async (_f, override) => {
    const response = await listV3FeedbackRecords({ ...base, ...override });

    expect(response.status).toBe(422);
    expect((await response.json()).invalid_params.length).toBeGreaterThan(0);
    expect(listFeedbackRecords).not.toHaveBeenCalled();
  });

  /**
   * A filter this surface does not have used to be dropped silently, which on a filter fails in the wrong
   * direction: the query runs unfiltered and the caller is told it succeeded. `userId` is the realistic
   * mistake — the old spelling of `user_id` — and it must now be a 422 naming the offending key.
   */
  test.each([
    ["the old camelCase spelling", { userId: "user-1" }],
    ["an outright unknown key", { nonsense: "x" }],
  ])("listV3FeedbackRecords rejects %s instead of ignoring it", async (_f, override) => {
    const response = await listV3FeedbackRecords({ ...base, ...(override as object) });

    expect(response.status).toBe(422);
    expect(listFeedbackRecords).not.toHaveBeenCalled();
  });

  test("countV3FeedbackRecords rejects an out-of-range filter without calling the Hub", async () => {
    const response = await countV3FeedbackRecords({ ...base, user_id: "u".repeat(256) });

    expect(response.status).toBe(422);
    expect(countFeedbackRecords).not.toHaveBeenCalled();
  });
});

describe("listV3FeedbackRecords", () => {
  /**
   * Listing does not touch the vector index, so a Hub 503 here is an outage or some *other* unconfigured
   * subsystem. It used to answer with the embeddings message for every operation, which sent an operator
   * after a setting that has nothing to do with listing records.
   */
  test("does not blame embeddings for a 503 on a path that needs none", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue({
      data: null,
      error: { status: 503, message: "unavailable", detail: "unavailable" },
    });

    const response = await listV3FeedbackRecords({ ...base });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.detail).not.toMatch(/embedding/i);
    expect(body.detail).toContain("not configured");
  });
});

describe("listV3FeedbackRecords filters", () => {
  // The Hub's count endpoint takes the same parameters as list, and both go through one mapper — so this
  // pins that list really does send the full filter set, not a subset of it.
  test("sends every filter to the Hub alongside pagination", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue({
      data: { data: [], limit: 10, next_cursor: undefined },
      error: null,
    });

    await listV3FeedbackRecords({
      ...base,
      limit: 10,
      cursor: "abc",
      source_type: "survey",
      source_id: "svy_1",
      field_type: "text",
      field_id: "q1",
      field_group_id: "grp_1",
      submission_id: "sub-1",
      user_id: "user-1",
      value_id: "opt_1",
      since: "2026-01-01T00:00:00Z",
      until: "2026-12-31T00:00:00Z",
    });

    expect(listFeedbackRecords).toHaveBeenCalledWith({
      tenant_id: directoryId,
      limit: 10,
      cursor: "abc",
      source_type: "survey",
      source_id: "svy_1",
      field_type: "text",
      field_id: "q1",
      field_group_id: "grp_1",
      submission_id: "sub-1",
      user_id: "user-1",
      value_id: "opt_1",
      since: "2026-01-01T00:00:00Z",
      until: "2026-12-31T00:00:00Z",
    });
  });
});

describe("createV3FeedbackRecords", () => {
  const record = (i: number) => ({
    source_type: "call_notes",
    field_id: "note",
    field_type: "text",
    value_text: `note ${i}`,
  });
  const hubRecord = (i: number) =>
    ({
      id: `019fa338-f494-7384-b34e-0173978300${i}0`,
      tenant_id: directoryId,
      value_text: `note ${i}`,
    }) as FeedbackRecordData;

  test("requires readWrite access", async () => {
    vi.mocked(createFeedbackRecordsBatch).mockResolvedValue({
      results: [{ data: hubRecord(1), error: null }],
    });

    await createV3FeedbackRecords({ ...base, body: { records: [record(1)] } });

    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      null,
      workspaceId,
      "readWrite",
      requestId,
      instance
    );
  });

  test("creates every record with the resolved tenant injected", async () => {
    vi.mocked(createFeedbackRecordsBatch).mockResolvedValue({
      results: [
        { data: hubRecord(1), error: null },
        { data: hubRecord(2), error: null },
      ],
    });

    const response = await createV3FeedbackRecords({
      ...base,
      body: { records: [record(1), record(2)] },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.meta).toMatchObject({ requested: 2, created: 2, failed: 0, failures: [] });
    for (const params of vi.mocked(createFeedbackRecordsBatch).mock.calls[0][0]) {
      expect(params.tenant_id).toBe(directoryId);
    }
  });

  // Validation is all-or-nothing on purpose: a half-written batch is far worse to recover from than a
  // rejected one, and the caller can fix and resend.
  test("rejects the whole batch when one record is invalid, before writing anything", async () => {
    const response = await createV3FeedbackRecords({
      ...base,
      body: { records: [record(1), { ...record(2), value_text: undefined }] },
    });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.invalid_params[0].name).toBe("records.1.value_text");
    expect(createFeedbackRecordsBatch).not.toHaveBeenCalled();
  });

  test("rejects a batch over the cap and an empty batch", async () => {
    const tooMany = await createV3FeedbackRecords({
      ...base,
      body: { records: Array.from({ length: 51 }, (_, i) => record(i)) },
    });
    const empty = await createV3FeedbackRecords({ ...base, body: { records: [] } });

    expect(tooMany.status).toBe(422);
    expect(empty.status).toBe(422);
    expect(createFeedbackRecordsBatch).not.toHaveBeenCalled();
  });

  // A batch is not a submission. Grouping is the caller's job, and getting it wrong stores data nothing
  // downstream can distinguish from the intended shape — so both halves are pinned.
  test("gives each record its own submission_id when omitted, and preserves a shared one", async () => {
    vi.mocked(createFeedbackRecordsBatch).mockResolvedValue({
      results: [
        { data: hubRecord(1), error: null },
        { data: hubRecord(2), error: null },
      ],
    });

    await createV3FeedbackRecords({ ...base, body: { records: [record(1), record(2)] } });
    const generated = vi.mocked(createFeedbackRecordsBatch).mock.calls[0][0];
    expect(generated[0].submission_id).not.toBe(generated[1].submission_id);

    vi.mocked(createFeedbackRecordsBatch).mockClear();
    await createV3FeedbackRecords({
      ...base,
      body: {
        records: [
          { ...record(1), submission_id: "sub-shared" },
          { ...record(2), submission_id: "sub-shared" },
        ],
      },
    });
    const shared = vi.mocked(createFeedbackRecordsBatch).mock.calls[0][0];
    expect(shared.map((p) => p.submission_id)).toEqual(["sub-shared", "sub-shared"]);
  });

  test("ignores a tenant_id smuggled into a record", async () => {
    vi.mocked(createFeedbackRecordsBatch).mockResolvedValue({
      results: [{ data: hubRecord(1), error: null }],
    });

    await createV3FeedbackRecords({
      ...base,
      body: { records: [{ ...record(1), tenant_id: "attacker-tenant" }] },
    });

    expect(vi.mocked(createFeedbackRecordsBatch).mock.calls[0][0][0].tenant_id).toBe(directoryId);
  });

  // Partial success has to be visible: the caller needs to know which records to retry, by index.
  test("reports partial failure per index while returning what was created", async () => {
    vi.mocked(createFeedbackRecordsBatch).mockResolvedValue({
      results: [
        { data: hubRecord(1), error: null },
        {
          data: null,
          error: {
            status: 409,
            message: "409",
            detail: "409",
            problemDetail: "duplicate record for (tenant_id, submission_id, field_id)",
          },
        },
      ],
    });

    const body = await (
      await createV3FeedbackRecords({ ...base, body: { records: [record(1), record(2)] } })
    ).json();

    expect(body.data).toHaveLength(1);
    expect(body.meta).toMatchObject({ requested: 2, created: 1, failed: 1 });
    expect(body.meta.failures).toEqual([{ index: 1, detail: expect.stringContaining("duplicate record") }]);
  });

  // A 5xx can carry upstream internals, so a per-record failure must be as tight-lipped as a whole-request
  // one — the batch path must not become the leak the single path isn't.
  test("does not relay upstream internals in a per-record failure", async () => {
    vi.mocked(createFeedbackRecordsBatch).mockResolvedValue({
      results: [
        { data: hubRecord(1), error: null },
        {
          data: null,
          error: { status: 500, message: "boom", detail: "boom", problemDetail: "panic at 10.0.0.1" },
        },
      ],
    });

    const body = await (
      await createV3FeedbackRecords({ ...base, body: { records: [record(1), record(2)] } })
    ).json();

    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
    expect(body.meta.failures[0].detail).toBe("The feedback service rejected this record.");
  });

  // Per-record relay follows the same status allowlist as a whole request: a Hub 401 is about *our*
  // credentials, so its detail must not reach the caller even though 401 is a 4xx.
  test("does not relay a Hub auth failure detail in a per-record failure", async () => {
    vi.mocked(createFeedbackRecordsBatch).mockResolvedValue({
      results: [
        { data: hubRecord(1), error: null },
        {
          data: null,
          error: {
            status: 401,
            message: "401",
            detail: "401",
            problemDetail: "invalid api key for tenant-service",
          },
        },
      ],
    });

    const body = await (
      await createV3FeedbackRecords({ ...base, body: { records: [record(1), record(2)] } })
    ).json();

    expect(JSON.stringify(body)).not.toContain("invalid api key");
    expect(body.meta.failures[0].detail).toBe("The feedback service rejected this record.");
  });

  // An empty 200 would read as "there was nothing to do" rather than "the service refused everything".
  test("returns the upstream failure when nothing could be created", async () => {
    vi.mocked(createFeedbackRecordsBatch).mockResolvedValue({
      results: [
        { data: null, error: { status: 503, message: "unavailable", detail: "unavailable" } },
        { data: null, error: { status: 503, message: "unavailable", detail: "unavailable" } },
      ],
    });

    const response = await createV3FeedbackRecords({ ...base, body: { records: [record(1), record(2)] } });
    const body = await response.json();

    expect(response.status).toBe(503);
    // A batch create needs no embeddings, so the 503 must not tell an operator to go configure them.
    expect(body.detail).not.toMatch(/embedding/i);
  });

  test("stamps one audit log per created record and leaves failed ones unstamped", async () => {
    vi.mocked(createFeedbackRecordsBatch).mockResolvedValue({
      results: [
        { data: hubRecord(1), error: null },
        { data: null, error: { status: 409, message: "dupe", detail: "dupe" } },
      ],
    });
    const auditLogs = [{ status: "failure" }, { status: "failure" }] as unknown as TV3AuditLog[];

    await createV3FeedbackRecords({ ...base, body: { records: [record(1), record(2)] }, auditLogs });

    expect(auditLogs[0].targetId).toBe(hubRecord(1).id);
    expect(auditLogs[0].organizationId).toBe("org_1");
    expect(auditLogs[0].newObject).toBeDefined();
    expect(auditLogs[1].targetId).toBeUndefined();
  });
});

describe("updateV3FeedbackRecord", () => {
  const updateBase = { ...base, authentication: sessionAuth, feedbackRecordId: record.id };
  const updated = { ...record, value_text: "Actually, love it a lot" } as FeedbackRecordData;

  beforeEach(() => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({ data: record, error: null });
    vi.mocked(updateFeedbackRecord).mockResolvedValue({ data: updated, error: null });
  });

  test("requires readWrite access", async () => {
    await updateV3FeedbackRecord({ ...updateBase, body: { value_text: "x" } });

    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      sessionAuth,
      workspaceId,
      "readWrite",
      requestId,
      instance
    );
  });

  test("sends only the fields the caller provided", async () => {
    const response = await updateV3FeedbackRecord({
      ...updateBase,
      body: { value_text: "Actually, love it a lot" },
    });

    expect(response.status).toBe(200);
    expect(updateFeedbackRecord).toHaveBeenCalledWith(record.id, {
      value_text: "Actually, love it a lot",
    });
    expect((await response.json()).data.value_text).toBe("Actually, love it a lot");
  });

  /**
   * The Hub does not check the populated `value_*` against `field_type`, and `field_type` is immutable so it
   * is not in the patch — without reading the record first, a patch could assemble what create rejects. This
   * was reproduced against a live Hub: `{value_number, value_id}` on a `text` record returned 200 with text,
   * number and id all set, leaving no way to tell which value the record means.
   */
  test("rejects a value_* field the stored field_type does not accept", async () => {
    const response = await updateV3FeedbackRecord({
      ...updateBase,
      body: { value_number: 99, value_id: "opt-bogus" },
    });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.invalid_params).toEqual([
      { name: "value_number", reason: 'is not valid for a "text" record (expected one of: value_text)' },
      { name: "value_id", reason: 'is not valid for a "text" record (expected one of: value_text)' },
    ]);
    expect(updateFeedbackRecord).not.toHaveBeenCalled();
  });

  /**
   * `field_type` comes from a remote service and the record DTO treats it as optional, so the cross-check
   * must not turn its absence into a failed update — it used to throw here, which surfaced as a generic 500
   * on an otherwise valid patch.
   */
  test("lets the patch through when the Hub returned no field_type to check against", async () => {
    const { field_type: _dropped, ...typeless } = record;
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: typeless as FeedbackRecordData,
      error: null,
    });

    const response = await updateV3FeedbackRecord({ ...updateBase, body: { value_number: 99 } });

    expect(response.status).toBe(200);
    expect(updateFeedbackRecord).toHaveBeenCalledWith(record.id, { value_number: 99 });
  });

  test("allows the value_* field the stored field_type does accept", async () => {
    const response = await updateV3FeedbackRecord({ ...updateBase, body: { value_text: "corrected" } });

    expect(response.status).toBe(200);
    expect(updateFeedbackRecord).toHaveBeenCalledWith(record.id, { value_text: "corrected" });
  });

  // `value_id` is a legitimate value for a categorical record — the option's stable id — so the check has to
  // be per-type rather than a blanket ban, or correcting a mis-mapped choice id becomes impossible.
  test("allows value_id on a categorical record", async () => {
    const categorical = { ...record, field_type: "categorical", value_id: "opt-1" } as FeedbackRecordData;
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({ data: categorical, error: null });
    vi.mocked(updateFeedbackRecord).mockResolvedValue({ data: categorical, error: null });

    const response = await updateV3FeedbackRecord({ ...updateBase, body: { value_id: "opt-2" } });

    expect(response.status).toBe(200);
    expect(updateFeedbackRecord).toHaveBeenCalledWith(record.id, { value_id: "opt-2" });
  });

  // Non-value fields carry no type contract, so they must not be caught by the cross-check.
  test("allows non-value fields regardless of field_type", async () => {
    const response = await updateV3FeedbackRecord({
      ...updateBase,
      body: { user_id: "u2", language: "de", metadata: { a: 1 } },
    });

    expect(response.status).toBe(200);
  });

  // Provenance is immutable in the Hub, and the allowlist is what enforces it: these have nowhere to go.
  test("drops immutable provenance fields instead of forwarding them", async () => {
    await updateV3FeedbackRecord({
      ...updateBase,
      body: {
        value_text: "x",
        source_type: "hacked",
        source_id: "hacked",
        field_id: "hacked",
        field_type: "nps",
        submission_id: "hacked",
        collected_at: "1999-01-01T00:00:00Z",
        tenant_id: "attacker-tenant",
      },
    });

    expect(updateFeedbackRecord).toHaveBeenCalledWith(record.id, { value_text: "x" });
  });

  // The derived enrichment fields are the Hub's to compute; a caller must not be able to assert them.
  test("drops derived enrichment fields", async () => {
    await updateV3FeedbackRecord({
      ...updateBase,
      body: {
        value_text: "x",
        sentiment: "positive",
        sentiment_score: 1,
        emotions: ["joy"],
        value_text_translated: "fake",
        translation_lang_key: "de-DE",
      },
    });

    expect(updateFeedbackRecord).toHaveBeenCalledWith(record.id, { value_text: "x" });
  });

  test("rejects an empty patch rather than making a pointless round trip", async () => {
    const response = await updateV3FeedbackRecord({ ...updateBase, body: {} });

    expect(response.status).toBe(422);
    expect((await response.json()).invalid_params[0].reason).toContain("at least one field");
    expect(updateFeedbackRecord).not.toHaveBeenCalled();
  });

  // The whole reason the update schema is `.pick()`ed from the create fields is that field-level
  // refinements come with it. If that ever stopped holding, update would silently lose create's bounds.
  test.each([
    ["30k text cap", { value_text: "x".repeat(30_001) }],
    ["32KB metadata byte cap", { metadata: { blob: "x".repeat(40_000) } }],
    ["metadata measured in bytes, not code units", { metadata: { blob: "字".repeat(20_000) } }],
  ])("inherits create's %s", async (_name, body) => {
    const response = await updateV3FeedbackRecord({ ...updateBase, body });

    expect(response.status).toBe(422);
    expect(updateFeedbackRecord).not.toHaveBeenCalled();
  });

  // The body is validated before the ownership check, so this confirms that ordering can't be used to
  // distinguish a record you own from one you don't.
  test("gives the same 422 for an invalid body whether or not the record is yours", async () => {
    const own = await updateV3FeedbackRecord({
      ...updateBase,
      body: { value_text: "x".repeat(30_001) },
    }).then((r) => r.json());

    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: { ...record, tenant_id: otherDirectoryId },
      error: null,
    });
    const foreign = await updateV3FeedbackRecord({
      ...updateBase,
      body: { value_text: "x".repeat(30_001) },
    }).then((r) => r.json());

    expect(foreign).toEqual(own);
  });

  // PATCH is IDOR-shaped upstream exactly like get and delete: the Hub derives the tenant from the record.
  test("refuses a cross-tenant record with 403 and never calls the Hub update", async () => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: { ...record, tenant_id: otherDirectoryId },
      error: null,
    });

    const response = await updateV3FeedbackRecord({ ...updateBase, body: { value_text: "x" } });

    expect(response.status).toBe(403);
    expect(updateFeedbackRecord).not.toHaveBeenCalled();
  });

  test("refuses an unknown record with the same 403 body as a cross-tenant one", async () => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: { ...record, tenant_id: otherDirectoryId },
      error: null,
    });
    const crossTenant = await updateV3FeedbackRecord({ ...updateBase, body: { value_text: "x" } }).then((r) =>
      r.json()
    );

    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({
      data: null,
      error: { status: 404, message: "not found", detail: "not found" },
    });
    const notFound = await updateV3FeedbackRecord({ ...updateBase, body: { value_text: "x" } });

    expect(notFound.status).toBe(403);
    expect(await notFound.json()).toEqual(crossTenant);
  });

  // An edit is only reviewable if both sides are recorded.
  test("audits both the previous and the new state", async () => {
    const auditLog = { status: "failure" } as unknown as TV3AuditLog;

    await updateV3FeedbackRecord({ ...updateBase, body: { value_text: "new" }, auditLog });

    expect(auditLog.organizationId).toBe("org_1");
    expect(auditLog.targetId).toBe(record.id);
    expect(auditLog.oldObject).toMatchObject({ value_text: "Love it" });
    expect(auditLog.newObject).toMatchObject({ value_text: "Actually, love it a lot" });
  });

  // The guard read the record a moment earlier, so a 404 from the write means it was deleted in between:
  // nothing happened, the service is healthy, and the answer must stay indistinguishable from no-access.
  test("answers a concurrent delete with the guard's 403, not a misleading 502", async () => {
    vi.mocked(updateFeedbackRecord).mockResolvedValue({
      data: null,
      error: { status: 404, message: "not found", detail: "not found" },
    });

    const response = await updateV3FeedbackRecord({ ...updateBase, body: { value_text: "x" } });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this feedback record");
  });

  test("relays the Hub's field-level rejection", async () => {
    vi.mocked(updateFeedbackRecord).mockResolvedValue({
      data: null,
      error: {
        status: 400,
        message: "400",
        detail: "400",
        problemDetail: "One or more request parameters are invalid",
        invalidParams: [{ name: "value_text", reason: "must not contain NULL bytes" }],
      },
    });

    const response = await updateV3FeedbackRecord({ ...updateBase, body: { value_text: "x" } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.invalid_params).toEqual([{ name: "value_text", reason: "must not contain NULL bytes" }]);
  });
});

// ENG-1770: a dataset is shared by every workspace it is assigned to, and its records carry no workspace
// of their own. Resolving the tenant and asserting ownership prove a record sits in one of the caller's
// datasets — not that it is their workspace's record — so changing one is organization-level.
describe("feedback record mutation role (ENG-1770)", () => {
  const updateArgs = {
    ...base,
    authentication: sessionAuth,
    feedbackRecordId: record.id,
    body: { value_text: "x" },
  };
  const deleteArgs = { ...base, authentication: sessionAuth, feedbackRecordId: record.id };

  beforeEach(() => {
    vi.mocked(retrieveFeedbackRecord).mockResolvedValue({ data: record, error: null });
    vi.mocked(updateFeedbackRecord).mockResolvedValue({ data: record, error: null });
    vi.mocked(deleteFeedbackRecord).mockResolvedValue({ data: { deleted: true }, error: null });
  });

  test("asks for an organization owner or manager, with no workspace-team fallback", async () => {
    await updateV3FeedbackRecord(updateArgs);

    expect(checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user_1",
      organizationId: context.organizationId,
      access: [{ type: "organization", roles: ["owner", "manager"] }],
    });
  });

  test("refuses an update from a workspace member who is not an owner or manager", async () => {
    vi.mocked(checkAuthorizationUpdated).mockRejectedValue(new AuthorizationError("Not authorized"));

    const response = await updateV3FeedbackRecord(updateArgs);

    expect(response.status).toBe(403);
    // Runs before the record is fetched, so a refusal cannot double as an existence oracle.
    expect(retrieveFeedbackRecord).not.toHaveBeenCalled();
    expect(updateFeedbackRecord).not.toHaveBeenCalled();
  });

  test("refuses a delete from a workspace member who is not an owner or manager", async () => {
    vi.mocked(checkAuthorizationUpdated).mockRejectedValue(new AuthorizationError("Not authorized"));

    const response = await deleteV3FeedbackRecord(deleteArgs);

    expect(response.status).toBe(403);
    expect(retrieveFeedbackRecord).not.toHaveBeenCalled();
    expect(deleteFeedbackRecord).not.toHaveBeenCalled();
  });

  test("lets an organization owner or manager update and delete", async () => {
    const updated = await updateV3FeedbackRecord(updateArgs);
    const deleted = await deleteV3FeedbackRecord(deleteArgs);

    expect(updated.status).toBe(200);
    expect(deleted.status).toBe(204);
  });

  // Deliberate carve-out: an API key authorizes on its per-workspace permissions, and what a key should
  // need in order to mutate a record is being settled in #8682.
  test("leaves API-key callers to their workspace permissions", async () => {
    const deleted = await deleteV3FeedbackRecord({ ...deleteArgs, authentication: apiKeyAuth });

    expect(deleted.status).toBe(204);
    expect(checkAuthorizationUpdated).not.toHaveBeenCalled();
  });

  // The API key above is the only shape that skips the role check. Anything that resolves to no user is
  // refused rather than admitted by the absence of a field — the pass-through has to stay an allowlist.
  test.each([
    ["no principal", null],
    ["a session with no user id", { user: {} } as TV3Authentication],
    ["an unknown principal shape", { serviceId: "svc_1" } as unknown as TV3Authentication],
  ])("refuses %s", async (_name, authentication) => {
    const response = await deleteV3FeedbackRecord({ ...deleteArgs, authentication });

    expect(response.status).toBe(403);
    expect(deleteFeedbackRecord).not.toHaveBeenCalled();
  });
});
