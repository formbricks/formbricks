import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DELETE, GET, PATCH } from "./route";

const { mockGet, mockUpdate, mockDelete, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/app/api/v3/teams/lib/operations", () => ({
  getV3Team: mockGet,
  updateV3Team: mockUpdate,
  deleteV3Team: mockDelete,
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

const TEAM_ID = "clteam1111111111111111111";
const url = (query = "", id = TEAM_ID) => `http://localhost/api/v3/teams/${id}${query}`;
const props = (id = TEAM_ID) => ({ params: Promise.resolve({ teamId: id }) });
const request = (method: string, query = "", body?: unknown, id = TEAM_ID) =>
  new NextRequest(url(query, id), {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe("/api/v3/teams/{teamId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const mock of [mockGet, mockUpdate, mockDelete]) {
      mock.mockResolvedValue(Response.json({ data: {} }, { status: 200 }));
    }
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("PATCH hands the raw body, `confirm` included, to the operation, audited as a team update", async () => {
    const body = { members: [], confirm: true };

    const response = await PATCH(request("PATCH", "", body), props());

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: TEAM_ID,
        body,
        authentication: { user: { id: "user_1" } },
        auditLog: expect.objectContaining({ action: "updated", targetType: "team" }),
      })
    );
  });

  test("DELETE takes `confirm` from the query as a boolean; absent stays undefined", async () => {
    await DELETE(request("DELETE", "?confirm=true"), props());
    await DELETE(request("DELETE"), props());

    expect(mockDelete).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ teamId: TEAM_ID, confirm: true })
    );
    expect(mockDelete).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        confirm: undefined,
        auditLog: expect.objectContaining({ action: "deleted", targetType: "team" }),
      })
    );
  });

  test("DELETE rejects a confirm that is not true or false, and unknown parameters, before the operation", async () => {
    expect((await DELETE(request("DELETE", "?confirm=yes"), props())).status).toBe(400);
    expect((await DELETE(request("DELETE", "?force=true"), props())).status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test("a malformed team id is a 400", async () => {
    expect((await GET(request("GET", "", undefined, "not an id"), props("not an id"))).status).toBe(400);
    expect(mockGet).not.toHaveBeenCalled();
  });

  test("every method is session only: a key alone is a 401 and is never consulted", async () => {
    mockGetSession.mockResolvedValue(null);
    const headers = { "x-api-key": "fbk_test" };
    const withKey = (method: string) =>
      new NextRequest(url(), { method, headers: { ...headers, "content-type": "application/json" } });

    for (const [handler, method] of [
      [GET, "GET"],
      [PATCH, "PATCH"],
      [DELETE, "DELETE"],
    ] as const) {
      expect((await handler(withKey(method), props())).status, method).toBe(401);
    }
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
