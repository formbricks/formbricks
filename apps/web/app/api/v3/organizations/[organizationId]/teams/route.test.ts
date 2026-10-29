import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET, POST } from "./route";

const { mockList, mockCreate, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/app/api/v3/teams/lib/operations", () => ({ listV3Teams: mockList, createV3Team: mockCreate }));
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
const request = (
  method: string,
  body?: unknown,
  id = ORGANIZATION_ID,
  headers: Record<string, string> = {}
) =>
  new NextRequest(`http://localhost/api/v3/organizations/${id}/teams`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const props = (id = ORGANIZATION_ID) => ({ params: Promise.resolve({ organizationId: id }) });

describe("/api/v3/organizations/{organizationId}/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue(Response.json({ data: [] }, { status: 200 }));
    mockCreate.mockResolvedValue(Response.json({ data: {} }, { status: 201 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("GET lists for the signed-in person; the licence and role are the operation's call", async () => {
    const response = await GET(request("GET"), props());

    expect(response.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORGANIZATION_ID, authentication: { user: { id: "user_1" } } })
    );
  });

  test("POST hands the raw body to the operation, audited as a team create", async () => {
    const body = { name: "Support" };

    const response = await POST(request("POST", body), props());

    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        body,
        auditLog: expect.objectContaining({ action: "created", targetType: "team" }),
      })
    );
  });

  test("a malformed organization id is a 400", async () => {
    expect((await GET(request("GET", undefined, "not an id"), props("not an id"))).status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });

  test("a key alone is a 401 on both methods and is never consulted", async () => {
    mockGetSession.mockResolvedValue(null);

    expect(
      (await GET(request("GET", undefined, ORGANIZATION_ID, { "x-api-key": "k" }), props())).status
    ).toBe(401);
    expect(
      (await POST(request("POST", { name: "Support" }, ORGANIZATION_ID, { "x-api-key": "k" }), props()))
        .status
    ).toBe(401);
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
    expect(mockList).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
