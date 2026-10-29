import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DELETE, PATCH } from "./route";

const { mockUpdate, mockRemove, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockRemove: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../../../lib/members", () => ({
  updateV3OrganizationMemberRole: mockUpdate,
  removeV3OrganizationMember: mockRemove,
}));
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
const USER_ID = "cluser1111111111111111111";
const URL_FOR = (organizationId: string, userId: string) =>
  `http://localhost/api/v3/organizations/${organizationId}/members/${userId}`;

const patch = (body: unknown, orgId = ORGANIZATION_ID, userId = USER_ID) =>
  PATCH(
    new NextRequest(URL_FOR(orgId, userId), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ organizationId: orgId, userId }) }
  );

const remove = (query = "", orgId = ORGANIZATION_ID, userId = USER_ID) =>
  DELETE(new NextRequest(`${URL_FOR(orgId, userId)}${query}`, { method: "DELETE" }), {
    params: Promise.resolve({ organizationId: orgId, userId }),
  });

describe("/api/v3/organizations/{organizationId}/members/{userId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue(Response.json({ data: { status: "preview" } }, { status: 200 }));
    mockRemove.mockResolvedValue(Response.json({ data: { status: "preview" } }, { status: 200 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("PATCH hands the body, confirm included, to the operation, audited as a membership update", async () => {
    const body = { role: "manager", confirm: true };

    const response = await patch(body);

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        userId: USER_ID,
        body,
        auditLog: expect.objectContaining({ action: "updated", targetType: "membership" }),
      })
    );
  });

  test("DELETE reads confirm from the query: only the string true confirms", async () => {
    await remove("?confirm=true");
    await remove("");
    await remove("?confirm=false");

    expect(mockRemove.mock.calls.map(([params]) => params.confirm)).toEqual([true, false, false]);
    expect(mockRemove).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        userId: USER_ID,
        auditLog: expect.objectContaining({ action: "deleted", targetType: "membership" }),
      })
    );
  });

  test("rejects malformed ids and an unknown query key before the operations run", async () => {
    expect((await patch({ role: "member" }, "not an id")).status).toBe(400);
    expect((await remove("", ORGANIZATION_ID, "not an id")).status).toBe(400);
    expect((await remove("?confirm=yes")).status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  test("refuses a caller with no session, and never consults an API key", async () => {
    mockGetSession.mockResolvedValue(null);

    expect((await patch({ role: "member" })).status).toBe(401);
    expect((await remove("?confirm=true")).status).toBe(401);
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
