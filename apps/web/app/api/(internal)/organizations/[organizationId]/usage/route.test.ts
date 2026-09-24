import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const { mockCan, mockGetSession, mockGetOrganization, mockGetOrganizationUsage, constants } = vi.hoisted(
  () => ({
    mockCan: vi.fn(),
    mockGetSession: vi.fn(),
    mockGetOrganization: vi.fn(),
    mockGetOrganizationUsage: vi.fn(),
    constants: { IS_FORMBRICKS_CLOUD: false },
  })
);

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get IS_FORMBRICKS_CLOUD() {
    return constants.IS_FORMBRICKS_CLOUD;
  },
}));
vi.mock("@/lib/authorization", () => ({ can: mockCan }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mockGetOrganization }));
vi.mock("@/modules/organization/usage/lib/usage", () => ({ getOrganizationUsage: mockGetOrganizationUsage }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({ action, targetType })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "user_1";

const get = (query: string, organizationId = ORG_ID) =>
  GET(new NextRequest(`http://localhost/api/organizations/${organizationId}/usage${query}`), {
    params: Promise.resolve({ organizationId }),
  } as never);

describe("GET /api/organizations/[organizationId]/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    constants.IS_FORMBRICKS_CLOUD = false;
    mockGetSession.mockResolvedValue({ user: { id: USER_ID } });
    mockCan.mockResolvedValue(true);
    mockGetOrganization.mockResolvedValue({ id: ORG_ID, displayTimeZone: "Europe/Berlin" });
    mockGetOrganizationUsage.mockResolvedValue({ workspaces: [], timeZone: "Europe/Berlin" });
  });

  test("returns the usage for an owner or manager, scoped to the organization in the path", async () => {
    const response = await get("?preset=all_time");

    expect(response.status).toBe(200);
    expect(mockCan).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mockGetOrganizationUsage).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      range: {},
      timeZone: "Europe/Berlin",
    });
  });

  test("cuts a custom range in the organization's time zone, not UTC", async () => {
    await get("?from=2026-01-01&to=2026-01-31");

    const { range } = mockGetOrganizationUsage.mock.calls[0][0];
    // Midnight in Berlin (UTC+1 in January) is 23:00 UTC the day before.
    expect(range.from.toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-01-31T22:59:59.999Z");
  });

  test("refuses members and billing users with 403 before reading any usage", async () => {
    mockCan.mockResolvedValue(false);

    const response = await get("?preset=this_year");

    expect(response.status).toBe(403);
    expect(mockGetOrganizationUsage).not.toHaveBeenCalled();
  });

  test("refuses every caller on Formbricks Cloud", async () => {
    constants.IS_FORMBRICKS_CLOUD = true;

    const response = await get("?preset=this_year");

    expect(response.status).toBe(403);
    expect(mockCan).not.toHaveBeenCalled();
    expect(mockGetOrganizationUsage).not.toHaveBeenCalled();
  });

  test("rejects an unauthenticated request", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await get("?preset=this_year");

    expect(response.status).toBe(401);
    expect(mockGetOrganizationUsage).not.toHaveBeenCalled();
  });

  test.each([
    ["an inverted range", "?from=2026-02-01&to=2026-01-01"],
    ["a date that does not exist", "?from=2026-02-30&to=2026-03-01"],
    ["a half-open custom range", "?from=2026-01-01"],
    ["a preset and a range together", "?preset=this_year&from=2026-01-01&to=2026-01-31"],
    ["an unknown preset", "?preset=forever"],
    ["no range at all", ""],
  ])("rejects %s with 400", async (_label, query) => {
    const response = await get(query);

    expect(response.status).toBe(400);
    expect(mockGetOrganizationUsage).not.toHaveBeenCalled();
  });
});
