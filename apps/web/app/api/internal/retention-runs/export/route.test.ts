import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { RETENTION_EXPORT_MAX_ROWS } from "./lib/operations";
import { GET } from "./route";

const {
  mockCan,
  mockGetSession,
  mockIsEnabled,
  mockCount,
  mockIterate,
  mockQueueAuditEvent,
  mockQueueAuditEventWithoutRequest,
  mockGetClientIp,
} = vi.hoisted(() => ({
  mockCan: vi.fn(),
  mockGetSession: vi.fn(),
  mockIsEnabled: vi.fn(),
  mockCount: vi.fn(),
  mockIterate: vi.fn(),
  mockQueueAuditEvent: vi.fn(),
  mockQueueAuditEventWithoutRequest: vi.fn(),
  mockGetClientIp: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mockCan }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDataRetentionEnabled: mockIsEnabled }));
vi.mock("@/modules/ee/data-retention/lib/runs-service", () => ({
  countRetentionExportRows: mockCount,
  iterateRetentionExportRows: mockIterate,
}));
vi.mock("@/lib/utils/client-ip", () => ({ getClientIpFromHeaders: mockGetClientIp }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: mockQueueAuditEvent,
  queueAuditEventWithoutRequest: mockQueueAuditEventWithoutRequest,
}));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    userId: "unknown",
    targetId: "unknown",
    organizationId: "unknown",
    status: "failure",
    userType: "api",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));

const ORG_ID = "clorg11111111111111111111";
const run = {
  id: "clrunaaaaaaaaaaaaaaaaaaaa",
  entity: "surveys",
  startedAt: new Date("2030-01-01T02:00:00Z"),
  finishedAt: null,
  notifiedCount: 0,
  archivedCount: 0,
  deletedCount: 0,
  skippedCount: 0,
  hasChanges: false,
};

const get = (query: string) =>
  GET(new NextRequest(`http://localhost/api/internal/retention-runs/export?${query}`), {} as never);

describe("GET /api/internal/retention-runs/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
    mockCan.mockResolvedValue(true);
    mockIsEnabled.mockResolvedValue(true);
    mockCount.mockResolvedValue(1);
    mockIterate.mockImplementation(async function* () {
      yield { run, item: null };
    });
    mockQueueAuditEvent.mockResolvedValue(undefined);
    mockQueueAuditEventWithoutRequest.mockResolvedValue(undefined);
    mockGetClientIp.mockResolvedValue("203.0.113.7");
  });

  test("streams the CSV as a download and audits the export once it has finished", async () => {
    const response = await get(`organizationId=${ORG_ID}&from=2030-01-01T00:00:00Z`);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toMatch(
      new RegExp(`^attachment; filename="retention-history-${ORG_ID}-\\d{4}-\\d{2}-\\d{2}\\.csv"$`)
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    // Nothing is audited when the response object is returned: the stream hasn't run yet.
    expect(mockQueueAuditEvent).not.toHaveBeenCalled();
    expect(mockQueueAuditEventWithoutRequest).not.toHaveBeenCalled();

    const body = await response.text();
    expect(body.split("\r\n")).toHaveLength(3); // header, one row, trailing newline

    expect(mockQueueAuditEventWithoutRequest).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        action: "exported",
        targetType: "retentionRun",
        userId: "user_1",
        userType: "user",
        organizationId: ORG_ID,
        targetId: ORG_ID,
        status: "success",
        ipAddress: "203.0.113.7",
        newObject: { rows: 1, from: "2030-01-01T00:00:00.000Z", to: null },
      })
    );
    expect(mockQueueAuditEvent).not.toHaveBeenCalled();
    expect(mockCount).toHaveBeenCalledWith(
      { organizationId: ORG_ID, from: new Date("2030-01-01T00:00:00Z"), to: null },
      RETENTION_EXPORT_MAX_ROWS
    );
  });

  test("refuses an export past the row cap with a 422, before any stream opens", async () => {
    mockCount.mockResolvedValue(RETENTION_EXPORT_MAX_ROWS + 1);

    const response = await get(`organizationId=${ORG_ID}`);

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("retention_export_too_large");
    expect(mockIterate).not.toHaveBeenCalled();
    expect(mockQueueAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
  });

  test("allows an export of exactly the row cap", async () => {
    mockCount.mockResolvedValue(RETENTION_EXPORT_MAX_ROWS);

    expect((await get(`organizationId=${ORG_ID}`)).status).toBe(200);
  });

  test("returns 403 to a member and audits the refusal", async () => {
    mockCan.mockResolvedValue(false);

    const response = await get(`organizationId=${ORG_ID}`);

    expect(response.status).toBe(403);
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockQueueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "exported", status: "failure", organizationId: ORG_ID })
    );
  });

  test("returns 400 when from isn't before to", async () => {
    const response = await get(`organizationId=${ORG_ID}&from=2030-02-01T00:00:00Z&to=2030-01-01T00:00:00Z`);

    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params).toEqual([expect.objectContaining({ name: "to" })]);
  });

  test("returns 401 without a session", async () => {
    mockGetSession.mockResolvedValue(null);

    expect((await get(`organizationId=${ORG_ID}`)).status).toBe(401);
  });
});
