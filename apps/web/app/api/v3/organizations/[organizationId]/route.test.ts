import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PATCH } from "./route";

const { mockUpdate, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../lib/operations", () => ({ updateV3Organization: mockUpdate }));
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

const patch = (body: unknown, id = ORGANIZATION_ID) =>
  PATCH(
    new NextRequest(`http://localhost/api/v3/organizations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ organizationId: id }) }
  );

describe("PATCH /api/v3/organizations/{organizationId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue(Response.json({ data: { id: ORGANIZATION_ID } }, { status: 200 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("hands the organization id, raw body and signed-in person to the operation, audited as an update", async () => {
    const response = await patch({ name: "Acme" });

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        body: { name: "Acme" },
        authentication: { user: { id: "user_1" } },
        auditLog: expect.objectContaining({ action: "updated", targetType: "organization" }),
      })
    );
  });

  test("rejects a malformed organization id with 400 before the operation runs", async () => {
    const response = await patch({ name: "Acme" }, "not an id");

    expect(response.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("refuses a caller with no session, and never consults an API key", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await patch({ name: "Acme" });

    expect(response.status).toBe(401);
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
