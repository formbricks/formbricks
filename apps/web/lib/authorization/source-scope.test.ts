import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  getApiKeyOrganizationId,
  getAuthorizationOrganizationId,
  getDashboardAuthorizationWorkspaceScope,
  getResponseAuthorizationWorkspaceScope,
  getSurveyAuthorizationWorkspaceScope,
  getTeamOrganizationId,
  getWorkspaceOrganizationId,
  isAuthorizationUserActive,
} from "./resolvers";
import { resolveAuthorizationScope } from "./source-scope";

vi.mock("./resolvers", () => ({
  getApiKeyOrganizationId: vi.fn(),
  getAuthorizationOrganizationId: vi.fn(),
  getDashboardAuthorizationWorkspaceScope: vi.fn(),
  getResponseAuthorizationWorkspaceScope: vi.fn(),
  getSurveyAuthorizationWorkspaceScope: vi.fn(),
  getTeamOrganizationId: vi.fn(),
  getWorkspaceOrganizationId: vi.fn(),
  isAuthorizationUserActive: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAuthorizationUserActive).mockResolvedValue(true);
});

describe("resolveAuthorizationScope", () => {
  test.each([
    ["organization", getAuthorizationOrganizationId],
    ["workspace", getWorkspaceOrganizationId],
    ["team", getTeamOrganizationId],
    ["apiKey", getApiKeyOrganizationId],
  ] as const)("resolves a %s resource organization", async (resourceType, resolver) => {
    vi.mocked(resolver).mockResolvedValue("org-1");

    await expect(
      resolveAuthorizationScope({ type: "user", id: "user-1" }, { type: resourceType, id: "resource-1" })
    ).resolves.toEqual({
      actorValid: true,
      organizationId: "org-1",
      permissionResource: { type: resourceType, id: "resource-1" },
    });
  });

  test("resolves survey, dashboard, and response parent chains", async () => {
    vi.mocked(getSurveyAuthorizationWorkspaceScope).mockResolvedValue({
      organizationId: "org-workspace-survey",
      workspaceId: "workspace-survey",
    });
    vi.mocked(getDashboardAuthorizationWorkspaceScope).mockResolvedValue({
      organizationId: "org-workspace-dashboard",
      workspaceId: "workspace-dashboard",
    });
    vi.mocked(getResponseAuthorizationWorkspaceScope).mockResolvedValue({
      organizationId: "org-workspace-response",
      workspaceId: "workspace-response",
    });

    await expect(
      resolveAuthorizationScope({ type: "user", id: "user-1" }, { type: "survey", id: "survey-1" })
    ).resolves.toEqual({
      actorValid: true,
      organizationId: "org-workspace-survey",
      permissionResource: { type: "workspace", id: "workspace-survey" },
    });
    await expect(
      resolveAuthorizationScope({ type: "user", id: "user-1" }, { type: "dashboard", id: "dashboard-1" })
    ).resolves.toEqual({
      actorValid: true,
      organizationId: "org-workspace-dashboard",
      permissionResource: { type: "workspace", id: "workspace-dashboard" },
    });
    await expect(
      resolveAuthorizationScope({ type: "user", id: "user-1" }, { type: "response", id: "response-1" })
    ).resolves.toEqual({
      actorValid: true,
      organizationId: "org-workspace-response",
      permissionResource: { type: "workspace", id: "workspace-response" },
    });
  });

  test("denies missing resources after resolving actor and resource in parallel", async () => {
    vi.mocked(getWorkspaceOrganizationId).mockResolvedValue(null);

    await expect(
      resolveAuthorizationScope({ type: "user", id: "user-1" }, { type: "workspace", id: "missing" })
    ).resolves.toBeNull();
    expect(isAuthorizationUserActive).toHaveBeenCalledWith("user-1");
  });

  test("starts actor validation without waiting for resource scope resolution", async () => {
    let resolveResource: ((organizationId: string) => void) | undefined;
    vi.mocked(getWorkspaceOrganizationId).mockReturnValue(
      new Promise((resolve) => {
        resolveResource = resolve;
      })
    );

    const result = resolveAuthorizationScope(
      { type: "user", id: "user-1" },
      { type: "workspace", id: "workspace-1" }
    );

    expect(isAuthorizationUserActive).toHaveBeenCalledWith("user-1");
    resolveResource?.("org-1");
    await expect(result).resolves.toMatchObject({ actorValid: true, organizationId: "org-1" });
  });

  test("marks a missing user as invalid", async () => {
    vi.mocked(getAuthorizationOrganizationId).mockResolvedValue("org-1");
    vi.mocked(isAuthorizationUserActive).mockResolvedValue(false);

    await expect(
      resolveAuthorizationScope({ type: "user", id: "missing" }, { type: "organization", id: "org-1" })
    ).resolves.toEqual({
      actorValid: false,
      organizationId: "org-1",
      permissionResource: { type: "organization", id: "org-1" },
    });
  });

  test("accepts only API keys belonging to the resource organization", async () => {
    vi.mocked(getWorkspaceOrganizationId).mockResolvedValue("org-1");
    vi.mocked(getApiKeyOrganizationId).mockResolvedValueOnce("org-1").mockResolvedValueOnce("org-2");

    await expect(
      resolveAuthorizationScope({ type: "apiKey", id: "key-1" }, { type: "workspace", id: "workspace-1" })
    ).resolves.toEqual({
      actorValid: true,
      organizationId: "org-1",
      permissionResource: { type: "workspace", id: "workspace-1" },
    });
    await expect(
      resolveAuthorizationScope({ type: "apiKey", id: "key-2" }, { type: "workspace", id: "workspace-1" })
    ).resolves.toEqual({
      actorValid: false,
      organizationId: "org-1",
      permissionResource: { type: "workspace", id: "workspace-1" },
    });
  });

  test("propagates resolver failures as operational errors", async () => {
    const failure = new Error("database unavailable");
    vi.mocked(getTeamOrganizationId).mockRejectedValue(failure);

    await expect(
      resolveAuthorizationScope({ type: "user", id: "user-1" }, { type: "team", id: "team-1" })
    ).rejects.toBe(failure);
  });
});
