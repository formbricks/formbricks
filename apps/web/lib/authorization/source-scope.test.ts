import { beforeEach, describe, expect, test, vi } from "vitest";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import {
  getApiKeyOrganizationId,
  getAuthorizationOrganizationId,
  getDashboardAuthorizationWorkspaceScope,
  getFeedbackDirectoryAssignmentAuthorizationScope,
  getFeedbackDirectoryAuthorizationScope,
  getResponseAuthorizationWorkspaceScope,
  getResponseSurveyId,
  getSurveyAuthorizationScopeRow,
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
  getFeedbackDirectoryAssignmentAuthorizationScope: vi.fn(),
  getFeedbackDirectoryAuthorizationScope: vi.fn(),
  getResponseAuthorizationWorkspaceScope: vi.fn(),
  getResponseSurveyId: vi.fn(),
  getSurveyAuthorizationScopeRow: vi.fn(),
  getSurveyAuthorizationWorkspaceScope: vi.fn(),
  getTeamOrganizationId: vi.fn(),
  getWorkspaceOrganizationId: vi.fn(),
  isAuthorizationUserActive: vi.fn(),
}));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAuthorizationUserActive).mockResolvedValue(true);
  vi.mocked(isSurveyVisibilityReady).mockResolvedValue(false);
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

  test("resolves directory and exact directory-workspace assignment resources", async () => {
    vi.mocked(getFeedbackDirectoryAuthorizationScope).mockResolvedValue({
      isArchived: false,
      organizationId: "org-1",
      workspaceIds: ["workspace-1"],
    });
    vi.mocked(getFeedbackDirectoryAssignmentAuthorizationScope).mockResolvedValue({
      assignmentId: "fdwa-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
    });

    await expect(
      resolveAuthorizationScope(
        { type: "user", id: "user-1" },
        { type: "feedbackDirectory", id: "directory-1" }
      )
    ).resolves.toEqual({
      actorValid: true,
      organizationId: "org-1",
      permissionResource: { type: "feedbackDirectory", id: "directory-1" },
    });
    await expect(
      resolveAuthorizationScope(
        { type: "user", id: "user-1" },
        {
          type: "feedbackDirectoryAssignment",
          feedbackDirectoryId: "directory-1",
          workspaceId: "workspace-1",
        }
      )
    ).resolves.toEqual({
      actorValid: true,
      organizationId: "org-1",
      permissionResource: {
        type: "feedbackDirectoryAssignment",
        id: "fdwa-1",
      },
    });
    expect(getFeedbackDirectoryAssignmentAuthorizationScope).toHaveBeenCalledWith(
      "directory-1",
      "workspace-1"
    );
  });

  test("denies archived directories and invalid exact assignments", async () => {
    vi.mocked(getFeedbackDirectoryAuthorizationScope).mockResolvedValue({
      isArchived: true,
      organizationId: "org-1",
      workspaceIds: ["workspace-1"],
    });
    vi.mocked(getFeedbackDirectoryAssignmentAuthorizationScope).mockResolvedValue(null);

    await expect(
      resolveAuthorizationScope(
        { type: "user", id: "user-1" },
        { type: "feedbackDirectory", id: "directory-1" }
      )
    ).resolves.toBeNull();
    await expect(
      resolveAuthorizationScope(
        { type: "user", id: "user-1" },
        {
          type: "feedbackDirectoryAssignment",
          feedbackDirectoryId: "directory-1",
          workspaceId: "workspace-1",
        }
      )
    ).resolves.toBeNull();
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

describe("survey and response scopes once survey visibility is enforced (ENG-3282)", () => {
  const row = (overrides: Partial<Awaited<ReturnType<typeof getSurveyAuthorizationScopeRow>>> = {}) => ({
    id: "survey-1",
    organizationId: "org-1",
    ownerId: "owner-1",
    visibility: "restricted" as const,
    visibilityProjectedVersion: 2,
    visibilityVersion: 2,
    workspaceId: "workspace-1",
    ...overrides,
  });

  beforeEach(() => {
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(true);
  });

  test("decides a settled survey on its own node", async () => {
    vi.mocked(getSurveyAuthorizationScopeRow).mockResolvedValue(row());

    await expect(
      resolveAuthorizationScope({ type: "user", id: "user-1" }, { type: "survey", id: "survey-1" })
    ).resolves.toEqual({
      actorValid: true,
      organizationId: "org-1",
      permissionResource: { type: "survey", id: "survey-1" },
    });
    expect(getSurveyAuthorizationWorkspaceScope).not.toHaveBeenCalled();
  });

  test("falls back to the workspace node with a pending-restricted policy while a change is in flight", async () => {
    vi.mocked(getSurveyAuthorizationScopeRow).mockResolvedValue(
      row({ visibility: "workspace", visibilityVersion: 3 })
    );

    await expect(
      resolveAuthorizationScope({ type: "user", id: "user-1" }, { type: "survey", id: "survey-1" })
    ).resolves.toEqual({
      actorValid: true,
      organizationId: "org-1",
      permissionResource: { type: "workspace", id: "workspace-1" },
      policy: { kind: "pendingPrivate", ownerId: "owner-1", surveyId: "survey-1" },
    });
  });

  test("decides a never-projected workspace survey on the workspace ladder, without a pending policy", async () => {
    vi.mocked(getSurveyAuthorizationScopeRow).mockResolvedValue(
      row({ visibility: "workspace", visibilityProjectedVersion: 0, visibilityVersion: 1 })
    );

    await expect(
      resolveAuthorizationScope({ type: "user", id: "user-1" }, { type: "survey", id: "survey-1" })
    ).resolves.toEqual({
      actorValid: true,
      organizationId: "org-1",
      permissionResource: { type: "workspace", id: "workspace-1" },
    });
  });

  test("keeps a never-projected restricted survey on the pending-restricted policy", async () => {
    vi.mocked(getSurveyAuthorizationScopeRow).mockResolvedValue(
      row({ visibility: "restricted", visibilityProjectedVersion: 0, visibilityVersion: 1 })
    );

    await expect(
      resolveAuthorizationScope({ type: "user", id: "user-1" }, { type: "survey", id: "survey-1" })
    ).resolves.toMatchObject({
      permissionResource: { type: "workspace", id: "workspace-1" },
      policy: { kind: "pendingPrivate", ownerId: "owner-1", surveyId: "survey-1" },
    });
  });

  test("resolves a response through its survey", async () => {
    vi.mocked(getResponseSurveyId).mockResolvedValue("survey-1");
    vi.mocked(getSurveyAuthorizationScopeRow).mockResolvedValue(row());

    await expect(
      resolveAuthorizationScope({ type: "apiKey", id: "key-1" }, { type: "response", id: "response-1" })
    ).resolves.toMatchObject({ permissionResource: { type: "survey", id: "survey-1" } });
    expect(getResponseAuthorizationWorkspaceScope).not.toHaveBeenCalled();
  });

  test("denies an unknown survey or response", async () => {
    vi.mocked(getSurveyAuthorizationScopeRow).mockResolvedValue(null);
    vi.mocked(getResponseSurveyId).mockResolvedValue(null);

    await expect(
      resolveAuthorizationScope({ type: "user", id: "user-1" }, { type: "survey", id: "gone" })
    ).resolves.toBeNull();
    await expect(
      resolveAuthorizationScope({ type: "user", id: "user-1" }, { type: "response", id: "gone" })
    ).resolves.toBeNull();
  });
});
