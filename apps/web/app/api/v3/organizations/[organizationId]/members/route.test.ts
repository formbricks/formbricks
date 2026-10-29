import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const { mockList, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../../lib/members", () => ({ listV3OrganizationMembers: mockList }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mockAuthenticateRequest }));
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

const ORGANIZATION_ID = "clorg11111111111111111111";

const get = (query = "", id = ORGANIZATION_ID) =>
  GET(new NextRequest(`http://localhost/api/v3/organizations/${id}/members${query}`), {
    params: Promise.resolve({ organizationId: id }),
  });

describe("GET /api/v3/organizations/{organizationId}/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue(Response.json({ data: [], meta: {} }, { status: 200 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("hands the organization and the parsed query, with the default page size, to the operation", async () => {
    const response = await get("?kind=invite");

    expect(response.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        query: { kind: "invite", limit: 50 },
        authentication: { user: { id: "user_1" } },
      })
    );
  });

  test.each([["?limit=0"], ["?limit=251"], ["?kind=owner"], ["?teamId=x"]])(
    "rejects %s with 400 before the operation runs",
    async (query) => {
      expect((await get(query)).status).toBe(400);
      expect(mockList).not.toHaveBeenCalled();
    }
  );

  test("rejects a malformed organization id", async () => {
    expect((await get("", "not an id")).status).toBe(400);
  });

  test("refuses a caller with no session, and never consults an API key", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(401);
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
    expect(mockList).not.toHaveBeenCalled();
  });
});
