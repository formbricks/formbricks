import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { RETENTION_POLICY_DEFAULTS } from "@/modules/ee/data-retention/lib/policy-rules";
import { GET, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  isEnabled: vi.fn(),
  getRows: vi.fn(),
  update: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDataRetentionEnabled: mocks.isEnabled }));
vi.mock("@/modules/ee/data-retention/lib/policies-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/data-retention/lib/policies-service")>();
  return {
    RetentionPolicyInvalidError: actual.RetentionPolicyInvalidError,
    resolveRetentionPolicySettings: actual.resolveRetentionPolicySettings,
    getRetentionPolicyRows: mocks.getRows,
    updateRetentionPolicy: mocks.update,
  };
});
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
const POLICY_ID = "clpol11111111111111111111";

const DEFAULT_DOCUMENT = {
  responses: { enabled: false, warnDays: 60, archiveDays: null, deleteDays: 1095 },
  surveys: {
    enabled: false,
    warnDays: 60,
    archiveDays: 1095,
    deleteDays: 30,
    conditions: ["noResponse", "noChange"],
  },
  members: { enabled: false, warnDays: 60, archiveDays: 365, deleteDays: null },
};

const get = (query = `organizationId=${ORG_ID}`) =>
  GET(new NextRequest(`http://localhost/api/internal/retention-policies?${query}`), {} as never);

const patch = (body: unknown, query = `organizationId=${ORG_ID}`) =>
  PATCH(
    new NextRequest(`http://localhost/api/internal/retention-policies?${query}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    {} as never
  );

describe("GET /api/internal/retention-policies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.can.mockResolvedValue(true);
    mocks.isEnabled.mockResolvedValue(true);
    mocks.getRows.mockResolvedValue([]);
  });

  test("returns the three policies to anyone who can read the organisation, defaults when never saved", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(DEFAULT_DOCUMENT);
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.read_access", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.getRows).toHaveBeenCalledWith(ORG_ID);
  });

  test("returns saved policies, without conditions on the ones that have none", async () => {
    mocks.getRows.mockResolvedValue([
      {
        ...RETENTION_POLICY_DEFAULTS.members,
        id: POLICY_ID,
        entity: "members",
        enabled: true,
        enabledAt: new Date(),
      },
    ]);

    const { data } = await (await get()).json();

    expect(data.members).toEqual({ enabled: true, warnDays: 60, archiveDays: 365, deleteDays: null });
    expect(data.responses).toEqual(DEFAULT_DOCUMENT.responses);
  });

  test("returns 401 without a session, 403 without access or entitlement, 400 on an unknown parameter", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    expect((await get()).status).toBe(401);

    mocks.can.mockResolvedValueOnce(false);
    expect((await get()).status).toBe(403);

    mocks.isEnabled.mockResolvedValueOnce(false);
    expect((await get()).status).toBe(403);

    expect((await get(`organizationId=${ORG_ID}&policy=surveys`)).status).toBe(400);
    expect(mocks.getRows).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/internal/retention-policies", () => {
  const previous = RETENTION_POLICY_DEFAULTS.surveys;
  const next = { ...previous, enabled: true, warnDays: 30 };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.can.mockResolvedValue(true);
    mocks.isEnabled.mockResolvedValue(true);
    mocks.getRows.mockResolvedValue([{ ...next, id: POLICY_ID, entity: "surveys", enabledAt: new Date() }]);
    mocks.update.mockResolvedValue({ id: POLICY_ID, previous, next, changed: true });
    mocks.queueAuditEvent.mockResolvedValue(undefined);
  });

  test("changes one policy as an owner or manager, returns the document and audits old and new", async () => {
    const response = await patch({ surveys: { enabled: true, warnDays: 30 } });

    expect(response.status).toBe(200);
    expect((await response.json()).data.surveys).toEqual(next);
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.update).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      policy: "surveys",
      patch: { enabled: true, warnDays: 30 },
      updatedById: USER_ID,
    });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "retentionPolicy",
        targetId: POLICY_ID,
        organizationId: ORG_ID,
        status: "success",
        oldObject: { policy: "surveys", ...previous },
        newObject: { policy: "surveys", ...next },
      })
    );
  });

  test("doesn't audit a change that leaves the policy as it was", async () => {
    mocks.update.mockResolvedValueOnce({ id: POLICY_ID, previous, next: previous, changed: false });

    expect((await patch({ surveys: { enabled: false } })).status).toBe(200);
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("returns 422 naming each field that breaks a rule, audited as a failure", async () => {
    const { RetentionPolicyInvalidError } = await import("@/modules/ee/data-retention/lib/policies-service");
    mocks.update.mockRejectedValueOnce(
      new RetentionPolicyInvalidError([
        { field: "warnDays", reason: "The notice must be between 30 and 90 days." },
        { field: "deleteDays", reason: "Surveys are deleted 30 days after they are archived." },
      ])
    );

    const response = await patch({ surveys: { warnDays: 10, deleteDays: 60 } });

    expect(response.status).toBe(422);
    expect((await response.json()).invalid_params).toEqual([
      { name: "surveys.warnDays", reason: expect.any(String) },
      { name: "surveys.deleteDays", reason: expect.any(String) },
    ]);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "updated", organizationId: ORG_ID, status: "failure" })
    );
  });

  test.each([
    ["no policy", {}],
    ["two policies", { surveys: { enabled: true }, members: { enabled: true } }],
    ["no field to change", { surveys: {} }],
    ["an unknown policy", { feedback: { enabled: true } }],
    ["an unknown field", { surveys: { enabled: true, archiveAfter: 30 } }],
    ["conditions on the responses policy", { responses: { conditions: ["noChange"] } }],
    ["an unknown condition", { surveys: { conditions: ["noLogin"] } }],
    ["a number as text", { members: { archiveDays: "365" } }],
    ["a fractional number of days", { members: { warnDays: 45.5 } }],
  ])("returns 400 on %s", async (_case, body) => {
    expect((await patch(body)).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  test("returns 403 to a member, and when the organization isn't entitled", async () => {
    mocks.can.mockResolvedValueOnce(false);
    expect((await patch({ surveys: { enabled: true } })).status).toBe(403);
    // The refused attempt still says what it tried to change, and where.
    expect(mocks.queueAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "updated",
        status: "failure",
        newObject: { organizationId: ORG_ID, policy: "surveys", enabled: true },
      })
    );

    mocks.isEnabled.mockResolvedValueOnce(false);
    expect((await patch({ surveys: { enabled: true } })).status).toBe(403);

    expect(mocks.update).not.toHaveBeenCalled();
  });
});
