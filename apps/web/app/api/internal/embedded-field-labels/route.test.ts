import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { PUT } from "./route";

const { mockGetSession, mockPut } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock("./lib/operations", () => ({ putInternalEmbeddedFieldLabel: mockPut }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const body = {
  workspaceId: "clws111111111111111111111",
  key: "plan",
  label: "Subscription plan",
  expectedLabel: null,
};

const put = (payload: unknown = body) =>
  PUT(
    new NextRequest("http://localhost/api/internal/embedded-field-labels", {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: { ...SAME_ORIGIN_HEADERS, "Content-Type": "application/json" },
    }),
    {}
  );

describe("PUT /api/internal/embedded-field-labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
    mockPut.mockResolvedValue(Response.json({ data: { key: "plan", label: "Subscription plan" } }));
  });

  test("is session-only", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    expect((await put()).status).toBe(401);
    expect(mockPut).not.toHaveBeenCalled();
  });

  test("passes a valid rename on", async () => {
    expect((await put()).status).toBe(200);
    expect(mockPut).toHaveBeenCalledWith(expect.objectContaining({ body }));
  });

  test("refuses a name over 100 characters, control characters, a bad key and unknown fields", async () => {
    expect((await put({ ...body, label: "x".repeat(101) })).status).toBe(400);
    expect((await put({ ...body, label: "Plan\u0000" })).status).toBe(400);
    expect((await put({ ...body, key: "x".repeat(129) })).status).toBe(400);
    expect((await put({ ...body, key: "   " })).status).toBe(400);
    expect((await put({ ...body, extra: true })).status).toBe(400);
    expect(mockPut).not.toHaveBeenCalled();
  });

  test("accepts a name of exactly 100 characters", async () => {
    expect((await put({ ...body, label: "x".repeat(100) })).status).toBe(200);
  });
});
