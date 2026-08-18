import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { can } from "@/lib/authorization";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import type { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";

const { mockAuthenticatedApiClient, mockHandleApiError, mockSuccessResponse } = vi.hoisted(() => ({
  mockAuthenticatedApiClient: vi.fn(),
  mockHandleApiError: vi.fn(),
  mockSuccessResponse: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: { workspace: { findMany: vi.fn() } },
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authorization/resource-list", () => ({ lookupAuthorizedWorkspaceIds: vi.fn() }));
vi.mock("@/modules/api/v2/auth/authenticated-api-client", () => ({
  authenticatedApiClient: mockAuthenticatedApiClient,
}));
vi.mock("@/modules/api/v2/lib/response", () => ({
  responses: { successResponse: mockSuccessResponse },
}));
vi.mock("@/modules/api/v2/lib/utils", () => ({ handleApiError: mockHandleApiError }));

const authentication = {
  apiKeyId: "api-key-1",
  organizationAccess: { accessControl: { read: true, write: false } },
  organizationId: "organization-1",
  type: "apiKey",
  workspacePermissions: [
    { permission: "read", workspaceId: "workspace-1", workspaceName: "One" },
    { permission: "manage", workspaceId: "workspace-2", workspaceName: "Two" },
    { permission: "read", workspaceId: "foreign-workspace", workspaceName: "Foreign" },
  ],
} as const;

const request = new Request("http://localhost/api/v2/me");

describe("GET /api/v2/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(can).mockResolvedValue(true);
    mockAuthenticatedApiClient.mockImplementation(
      async ({ handler }: Parameters<typeof authenticatedApiClient>[0]) =>
        handler({ authentication, request } as never)
    );
    mockSuccessResponse.mockImplementation((body: unknown) => Response.json(body));
    mockHandleApiError.mockImplementation((_request, error) => Response.json({ error }, { status: 403 }));
  });

  test("returns only workspace grants authorized by SpiceDB and scoped to the API-key organization", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue([
      "workspace-2",
      "workspace-1",
      "foreign-workspace",
    ]);
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      { id: "workspace-1", legacyEnvironmentId: "environment-1" },
      { id: "workspace-2", legacyEnvironmentId: null },
    ] as never);

    const { GET } = await import("./route");
    const response = await GET(request as never);
    const body = await response.json();

    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledExactlyOnceWith({
      id: "api-key-1",
      type: "apiKey",
    });
    expect(prisma.workspace.findMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: { in: ["workspace-1", "workspace-2", "foreign-workspace"] },
        organizationId: "organization-1",
      },
      select: { id: true, legacyEnvironmentId: true },
    });
    expect(body.data.workspacePermissions).toEqual([
      { permissions: "read", workspaceId: "workspace-1", workspaceName: "One" },
      { permissions: "manage", workspaceId: "workspace-2", workspaceName: "Two" },
    ]);
    expect(body.data.environmentPermissions).toEqual([
      {
        environmentId: "environment-1",
        environmentType: "production",
        permissions: "read",
        projectId: "workspace-1",
        projectName: "One",
      },
    ]);
    expect(body.data.workspacePermissions).not.toContainEqual(
      expect.objectContaining({ workspaceId: "foreign-workspace" })
    );
    expect(body.data.environmentPermissions).not.toContainEqual(
      expect.objectContaining({ projectId: "foreign-workspace" })
    );
  });

  test("fails closed when the authoritative workspace lookup fails", async () => {
    const unavailable = new Error("AuthZed unavailable");
    vi.mocked(lookupAuthorizedWorkspaceIds).mockRejectedValue(unavailable);

    const { GET } = await import("./route");
    await expect(GET(request as never)).rejects.toBe(unavailable);
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });
});
