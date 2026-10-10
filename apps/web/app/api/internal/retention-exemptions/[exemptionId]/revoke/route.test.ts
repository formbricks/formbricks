import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  isEnabled: vi.fn(),
  getOrganizationId: vi.fn(),
  revoke: vi.fn(),
  find: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
// The database clock, read where the app clock would be: fake timers pin both.
vi.mock("@/lib/utils/database-clock", () => ({
  readDatabaseClock: async () => new Date(),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDataRetentionEnabled: mocks.isEnabled }));
vi.mock("@/modules/ee/data-retention/lib/exemptions-service", () => ({
  getRetentionExemptionOrganizationId: mocks.getOrganizationId,
  revokeRetentionExemption: mocks.revoke,
  findRetentionExemption: mocks.find,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
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

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";
const EXEMPTION_ID = "clexmaaaaaaaaaaaaaaaaaaaa";
const NOW = new Date("2030-02-01T00:00:00.000Z");

const revoke = () =>
  POST(
    new NextRequest(`http://localhost/api/internal/retention-exemptions/${EXEMPTION_ID}/revoke`, {
      method: "POST",
      headers: { "x-request-id": "req_1" },
    }),
    { params: Promise.resolve({ exemptionId: EXEMPTION_ID }) } as never
  );

const snapshot = async (response: Response) => ({
  status: response.status,
  headers: Object.fromEntries([...response.headers.entries()].sort()),
  body: await response.text(),
});

describe("POST /api/internal/retention-exemptions/{exemptionId}/revoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.can.mockResolvedValue(true);
    mocks.isEnabled.mockResolvedValue(true);
    mocks.getOrganizationId.mockResolvedValue(ORG_ID);
    mocks.revoke.mockResolvedValue(true);
    mocks.queueAuditEvent.mockResolvedValue(undefined);
    mocks.find.mockResolvedValue({
      id: EXEMPTION_ID,
      entity: "surveys",
      until: new Date("2031-03-31T21:59:59.999Z"),
      reason: "Audit",
      createdAt: new Date("2030-01-02T00:00:00.000Z"),
      revokedAt: null,
      surveyId: "clsrv11111111111111111111",
      surveyName: "Site visit feedback",
      workspaceId: "clwsp11111111111111111111",
      createdById: USER_ID,
      createdByName: "Anna Keller",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("ends the exemption now, as an owner or manager, and audits who revoked it", async () => {
    const response = await revoke();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ id: EXEMPTION_ID, revokedAt: NOW.toISOString() });
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.revoke).toHaveBeenCalledWith({ id: EXEMPTION_ID, revokedById: USER_ID, now: NOW });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "revoked",
        targetType: "retentionExemption",
        targetId: EXEMPTION_ID,
        organizationId: ORG_ID,
        status: "success",
        oldObject: {
          surveyId: "clsrv11111111111111111111",
          policy: "surveys",
          until: "2031-03-31T21:59:59.999Z",
          reason: "Audit",
          revokedAt: null,
        },
        newObject: {
          surveyId: "clsrv11111111111111111111",
          policy: "surveys",
          until: "2031-03-31T21:59:59.999Z",
          reason: "Audit",
          revokedAt: NOW.toISOString(),
          revokedById: USER_ID,
        },
      })
    );
    // The snapshot is taken before the revoke, so the audit names what was un-exempted.
    expect(mocks.find.mock.invocationCallOrder[0]).toBeLessThan(mocks.revoke.mock.invocationCallOrder[0]);
  });

  test("answers a missing exemption exactly like one in an organisation the caller can't manage", async () => {
    mocks.getOrganizationId.mockResolvedValueOnce(null);
    const missing = await snapshot(await revoke());

    mocks.can.mockResolvedValueOnce(false);
    const foreign = await snapshot(await revoke());

    // Deleted with its survey between the lookup and the revoke.
    mocks.find.mockResolvedValueOnce(null);
    const vanished = await snapshot(await revoke());

    expect(missing.status).toBe(403);
    expect(foreign).toStrictEqual(missing);
    expect(vanished).toStrictEqual(missing);
    expect(mocks.revoke).not.toHaveBeenCalled();
  });

  test("returns 403 when the organization isn't entitled", async () => {
    mocks.isEnabled.mockResolvedValueOnce(false);

    expect((await revoke()).status).toBe(403);
    expect(mocks.revoke).not.toHaveBeenCalled();
  });

  test("returns 422 on an exemption that already ended or was revoked, audited as a failure", async () => {
    mocks.revoke.mockResolvedValueOnce(false);

    const response = await revoke();

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("retention_exemption_not_active");
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "revoked",
        targetId: EXEMPTION_ID,
        status: "failure",
        oldObject: expect.objectContaining({ surveyId: "clsrv11111111111111111111", policy: "surveys" }),
      })
    );
  });
});
