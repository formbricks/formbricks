import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { getActionClasses } from "@/lib/actionClass/service";
import { listV3ActionClasses } from "./operations";

vi.mock("server-only", () => ({}));

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@/lib/actionClass/service", () => ({
  getActionClasses: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

const workspaceId = "clxx1234567890123456789012";

const actionClass = {
  id: "claa1234567890123456789012",
  name: "Checkout Complete",
  description: null,
  type: "code",
  key: "checkout_complete",
  noCodeConfig: null,
  workspaceId,
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
} as unknown as Awaited<ReturnType<typeof getActionClasses>>[number];

const params = {
  workspaceId,
  authentication: null,
  requestId: "req_1",
  instance: "/api/v3/action-classes",
};

describe("listV3ActionClasses", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("returns the public action-class shape for an authorized workspace", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      workspaceId,
    } as Awaited<ReturnType<typeof requireV3WorkspaceAccess>>);
    vi.mocked(getActionClasses).mockResolvedValue([actionClass]);

    const response = await listV3ActionClasses(params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        {
          id: "claa1234567890123456789012",
          name: "Checkout Complete",
          description: null,
          type: "code",
          key: "checkout_complete",
        },
      ],
    });
    expect(getActionClasses).toHaveBeenCalledWith(workspaceId);
  });

  test("returns the auth response and skips fetching when access is denied", async () => {
    const denied = new Response("forbidden", { status: 403 });
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(denied);

    const response = await listV3ActionClasses(params);

    expect(response).toBe(denied);
    expect(getActionClasses).not.toHaveBeenCalled();
  });

  test("returns 500 when fetching action classes fails", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      workspaceId,
    } as Awaited<ReturnType<typeof requireV3WorkspaceAccess>>);
    vi.mocked(getActionClasses).mockRejectedValue(new DatabaseError("boom"));

    const response = await listV3ActionClasses(params);

    expect(response.status).toBe(500);
  });
});
