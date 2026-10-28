import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./route";

const { mockGetSession, mockApplyRateLimit, mockGenerate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockApplyRateLimit: vi.fn(),
  mockGenerate: vi.fn(),
}));

vi.mock("../lib/operations", () => ({ generateInternalChart: mockGenerate }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mockApplyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const body = {
  workspaceId: "clws111111111111111111111",
  datasetId: "clds111111111111111111111",
  prompt: "responses by source",
};

const post = (payload: unknown = body) =>
  POST(
    new NextRequest("http://localhost/api/internal/charts/generate", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    }),
    {} as never
  );

describe("POST /api/internal/charts/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
    mockApplyRateLimit.mockResolvedValue(undefined);
    mockGenerate.mockResolvedValue(Response.json({ data: {} }));
  });

  test("spends one generation a minute per user, before the model is reached", async () => {
    mockApplyRateLimit.mockRejectedValueOnce(
      new TooManyRequestsError("Maximum number of requests reached", 42)
    );

    const response = await post();
    expect(response.status).toBe(429);
    expect(mockApplyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.internalChartGeneration, "user_1");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  test("is session-only and refuses an oversized prompt before generating", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    expect((await post()).status).toBe(401);

    expect((await post({ ...body, prompt: "x".repeat(2001) })).status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
