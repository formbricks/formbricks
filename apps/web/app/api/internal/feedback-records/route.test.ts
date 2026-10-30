import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { NO_CONFIG_ERROR } from "@/modules/hub/utils";
import { DELETE, GET as RETRIEVE } from "./[recordId]/route";
import { POST as LOOKUP_CONTACTS } from "./contact-lookups/route";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getSession: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  isEnabled: vi.fn(),
  getDatasets: vi.fn(),
  retrieveFeedbackRecord: vi.fn(),
  deleteFeedbackRecord: vi.fn(),
  getContactIdsByUserIds: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsFeedbackDirectoriesEnabled: mocks.isEnabled }));
vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoriesByWorkspaceId: mocks.getDatasets,
}));
vi.mock("@/modules/hub/service", () => ({
  retrieveFeedbackRecord: mocks.retrieveFeedbackRecord,
  deleteFeedbackRecord: mocks.deleteFeedbackRecord,
}));
vi.mock("@/modules/ee/unify-feedback/lib/contacts", () => ({
  getContactIdsByUserIds: mocks.getContactIdsByUserIds,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const DATASET_ID = "cldata1111111111111111111";
const OTHER_DATASET_ID = "cldata2222222222222222222";
const RECORD_ID = "0b6d1b8a-4f3e-4c1a-9c7e-2d5f8a9b1c3d";

const actor = { type: "user", id: USER_ID };
const record = (overrides: Record<string, unknown> = {}) => ({
  id: RECORD_ID,
  tenant_id: DATASET_ID,
  submission_id: "sub-1",
  source_type: "formbricks",
  source_id: "src-1",
  field_id: "q1",
  field_type: "text",
  value_text: "The checkout keeps timing out",
  collected_at: "2026-10-01T10:00:00.000Z",
  taxonomy: { status: "unclassified", run_id: "run-1", path: [] },
  ...overrides,
});
const NOT_CONFIGURED = { ...NO_CONFIG_ERROR };

type TOptions = { headers?: Record<string, string> };
const send = (method: string, url: string, body?: unknown, { headers }: TOptions = {}) =>
  new NextRequest(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(headers ?? SAME_ORIGIN_HEADERS),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const base = "http://localhost/api/internal/feedback-records";
const noParams = { params: Promise.resolve({}) } as never;
const recordProps = { params: Promise.resolve({ recordId: RECORD_ID }) } as never;

const retrieve = () => RETRIEVE(send("GET", `${base}/${RECORD_ID}?workspaceId=${WORKSPACE_ID}`), recordProps);
const remove = (options?: TOptions) =>
  DELETE(send("DELETE", `${base}/${RECORD_ID}?workspaceId=${WORKSPACE_ID}`, undefined, options), recordProps);
const lookupContacts = (userIds: string[]) =>
  LOOKUP_CONTACTS(send("POST", `${base}/contact-lookups?workspaceId=${WORKSPACE_ID}`, { userIds }), noParams);

const refuse = (refused: string) =>
  mocks.assertCan.mockImplementation(async (_actor: unknown, action: string) => {
    if (action === refused) throw new AuthorizationError("Not authorized");
  });
const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];
const withoutRequestId = async (response: Response) => {
  const { requestId: _requestId, ...rest } = await response.json();
  return rest;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(ORG_ID);
  mocks.isEnabled.mockResolvedValue(true);
  mocks.getDatasets.mockResolvedValue([{ id: DATASET_ID, name: "Support" }]);
  mocks.retrieveFeedbackRecord.mockResolvedValue({ data: record(), error: null });
  mocks.deleteFeedbackRecord.mockResolvedValue({ data: { id: RECORD_ID }, error: null });
  mocks.getContactIdsByUserIds.mockResolvedValue({ "user-a": "clcont1111111111111111111" });
  mocks.applyRateLimit.mockResolvedValue(undefined);
});

describe("GET /api/internal/feedback-records/{recordId}", () => {
  test("returns the record and its taxonomy placement after workspace and dataset authorization", async () => {
    const response = await retrieve();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ record: record(), taxonomy: record().taxonomy });
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.read", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "feedbackDirectoryAssignment.read", {
      type: "feedbackDirectoryAssignment",
      feedbackDirectoryId: DATASET_ID,
      workspaceId: WORKSPACE_ID,
    });
  });

  test("treats a missing taxonomy from an older Hub as unavailable, not as a failure", async () => {
    mocks.retrieveFeedbackRecord.mockResolvedValue({ data: record({ taxonomy: undefined }), error: null });
    const response = await retrieve();

    expect(response.status).toBe(200);
    expect((await response.json()).data.taxonomy).toBeNull();
  });

  test("answers a record in another workspace's dataset with the same 403 as one that does not exist", async () => {
    mocks.retrieveFeedbackRecord.mockResolvedValue({
      data: record({ tenant_id: OTHER_DATASET_ID }),
      error: null,
    });
    const foreign = await retrieve();
    mocks.retrieveFeedbackRecord.mockResolvedValue({
      data: null,
      error: { status: 404, message: "not found" },
    });
    const missing = await retrieve();

    expect(foreign.status).toBe(403);
    expect(await withoutRequestId(foreign)).toEqual(await withoutRequestId(missing));
  });

  test("answers 502 or 503 when the Hub can't answer, rather than a 403 that blames the record", async () => {
    mocks.retrieveFeedbackRecord.mockResolvedValue({ data: null, error: { status: 500, message: "boom" } });
    const failed = await retrieve();
    mocks.retrieveFeedbackRecord.mockResolvedValue({ data: null, error: NOT_CONFIGURED });
    const unconfigured = await retrieve();

    expect(failed.status).toBe(502);
    expect((await failed.json()).detail).toBe("The feedback records could not be loaded.");
    expect(unconfigured.status).toBe(503);
  });

  test("refuses a caller without access to the record's dataset in this workspace", async () => {
    refuse("feedbackDirectoryAssignment.read");
    expect((await retrieve()).status).toBe(403);
  });

  test("refuses an organization without the feedback directories entitlement", async () => {
    mocks.isEnabled.mockResolvedValue(false);
    expect((await retrieve()).status).toBe(403);
    expect(mocks.retrieveFeedbackRecord).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/feedback-records/{recordId}", () => {
  test("deletes on its own budget and audits the record's identity, never its feedback text", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      rateLimitConfigs.actions.feedbackRecordDeletion,
      USER_ID
    );
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.deleteFeedbackRecord).toHaveBeenCalledWith(RECORD_ID);
    const audit = lastAudit();
    expect(audit).toMatchObject({
      action: "deleted",
      targetType: "feedbackRecord",
      status: "success",
      organizationId: ORG_ID,
      targetId: RECORD_ID,
      oldObject: { id: RECORD_ID, tenant_id: DATASET_ID, field_type: "text" },
    });
    expect(JSON.stringify(audit)).not.toContain("checkout keeps timing out");
  });

  test("refuses a workspace member who isn't an organization owner or manager (ENG-1770)", async () => {
    refuse("organization.manage");
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteFeedbackRecord).not.toHaveBeenCalled();
    expect(lastAudit()).toMatchObject({ status: "failure", targetId: RECORD_ID });
  });

  test("refuses a record outside the workspace's datasets", async () => {
    mocks.retrieveFeedbackRecord.mockResolvedValue({
      data: record({ tenant_id: OTHER_DATASET_ID }),
      error: null,
    });
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteFeedbackRecord).not.toHaveBeenCalled();
  });

  test("answers 502 when the Hub refuses the delete, saying it was the delete that failed", async () => {
    mocks.deleteFeedbackRecord.mockResolvedValue({ data: null, error: { status: 500, message: "boom" } });
    const response = await remove();

    expect(response.status).toBe(502);
    expect((await response.json()).detail).toBe("The feedback records could not be deleted.");
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await remove({ headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.deleteFeedbackRecord).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/feedback-records/contact-lookups", () => {
  test("resolves user ids to the workspace's contacts for a reader of the workspace", async () => {
    const response = await lookupContacts(["user-a", "user-b"]);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ "user-a": "clcont1111111111111111111" });
    expect(mocks.getContactIdsByUserIds).toHaveBeenCalledWith(WORKSPACE_ID, ["user-a", "user-b"]);
  });

  test("refuses a caller who can't read the workspace", async () => {
    refuse("workspace.read");
    expect((await lookupContacts(["user-a"])).status).toBe(403);
    expect(mocks.getContactIdsByUserIds).not.toHaveBeenCalled();
  });

  test("answers 400 for more than 1000 ids", async () => {
    expect((await lookupContacts(Array.from({ length: 1001 }, (_, i) => `user-${i}`))).status).toBe(400);
  });
});
