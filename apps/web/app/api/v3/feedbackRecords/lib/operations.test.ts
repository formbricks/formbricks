import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import { createFeedbackRecord, listFeedbackRecords, retrieveFeedbackRecord } from "@/modules/hub/service";
import type { FeedbackRecordData } from "@/modules/hub/types";
import {
  createV3FeedbackRecord,
  getV3FeedbackRecord,
  listV3FeedbackDatasets,
  listV3FeedbackRecords,
} from "./operations";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })) },
}));

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsFeedbackDirectoriesEnabled: vi.fn() }));
vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: vi.fn(),
}));
vi.mock("@/modules/hub/service", () => ({
  listFeedbackRecords: vi.fn(),
  retrieveFeedbackRecord: vi.fn(),
  createFeedbackRecord: vi.fn(),
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

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(context);
  vi.mocked(getIsFeedbackDirectoriesEnabled).mockResolvedValue(true);
  vi.mocked(getFeedbackDirectoriesByWorkspaceId).mockResolvedValue([{ id: directoryId, name: "Support" }]);
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

    const response = await listV3FeedbackRecords({ ...base, sourceType: "survey", fieldType: "text" });
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
    expect(body.meta).toEqual({ limit: 50, nextCursor: "next" });
    expect(body.data[0].id).toBe(record.id);
    expect(body.data[0].value_text).toBe("Love it");
  });

  // The Hub's `tenant_id` is Hub-internal vocabulary; the outward-facing name is `dataset_id`. Same
  // value, and `tenant_id` must not appear in a response at all.
  test("emits the tenant as dataset_id and never as tenant_id", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue({
      data: { data: [record], limit: 50, next_cursor: null },
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
