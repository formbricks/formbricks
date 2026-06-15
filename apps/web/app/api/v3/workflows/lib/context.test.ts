import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { buildWorkflowApiContext } from "./context";

vi.mock("@formbricks/database", () => ({ prisma: { workflow: {} } }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));

const sessionAuth = {
  user: { id: "cm9zr52kh000508l8e3q7bw9j" },
  expires: "2026-12-01",
} as unknown as TV3Authentication;
const apiKeyAuth = {
  type: "apiKey",
  apiKeyId: "key_1",
  organizationId: "org_1",
  organizationAccess: { accessControl: { read: true, write: true } },
  workspacePermissions: [],
} as unknown as TAuthenticationApiKey;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildWorkflowApiContext", () => {
  test("derives userId from a session", () => {
    const ctx = buildWorkflowApiContext(sessionAuth, "req_1", "https://app.formbricks.com");
    expect(ctx.userId).toBe("cm9zr52kh000508l8e3q7bw9j");
  });

  test("leaves userId null for API-key authentication", () => {
    expect(buildWorkflowApiContext(apiKeyAuth, "req_1", "inst").userId).toBeNull();
  });

  test("leaves userId null for unauthenticated requests", () => {
    expect(buildWorkflowApiContext(null, "req_1", "inst").userId).toBeNull();
  });

  test("authorize delegates to requireV3WorkspaceAccess and returns its result", async () => {
    const resolved = { workspaceId: "ws_1", organizationId: "org_1" };
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(resolved);

    const ctx = buildWorkflowApiContext(apiKeyAuth, "req_1", "https://app.formbricks.com");
    const result = await ctx.authorize("ws_1", "readWrite");

    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      apiKeyAuth,
      "ws_1",
      "readWrite",
      "req_1",
      "https://app.formbricks.com"
    );
    expect(result).toEqual(resolved);
  });
});
