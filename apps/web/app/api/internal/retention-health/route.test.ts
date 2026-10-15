import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  isEnabled: vi.fn(),
  getFacts: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDataRetentionEnabled: mocks.isEnabled }));
vi.mock("@/modules/ee/data-retention/lib/health-service", () => ({
  getRetentionHealthFacts: mocks.getFacts,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";

const get = (query = `organizationId=${ORG_ID}`) =>
  GET(new NextRequest(`http://localhost/api/internal/retention-health?${query}`), {} as never);

describe("GET /api/internal/retention-health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.can.mockResolvedValue(true);
    mocks.isEnabled.mockResolvedValue(true);
    mocks.getFacts.mockResolvedValue({
      jobsConfigured: false,
      smtpConfigured: false,
      enabledPolicies: [{ enabledAt: new Date("2020-01-01T00:00:00.000Z") }],
      lastRunAt: null,
      oldestCleanupAt: null,
    });
  });

  test("returns the issues and the SMTP flag to owners and managers", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      issues: [{ code: "jobsNotConfigured" }, { code: "smtpNotConfigured" }],
      smtpConfigured: false,
    });
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.getFacts).toHaveBeenCalledWith(ORG_ID);
  });

  test("returns 401 without a session, 403 without manage access or entitlement, 400 on an unknown parameter", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    expect((await get()).status).toBe(401);

    mocks.can.mockResolvedValueOnce(false);
    expect((await get()).status).toBe(403);

    mocks.isEnabled.mockResolvedValueOnce(false);
    expect((await get()).status).toBe(403);

    expect((await get(`organizationId=${ORG_ID}&x=1`)).status).toBe(400);
    expect(mocks.getFacts).not.toHaveBeenCalled();
  });
});
