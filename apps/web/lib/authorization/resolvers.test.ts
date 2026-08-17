import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import {
  getApiKeyAuthById,
  getApiKeyOrganizationId,
  getAuthorizationOrganizationId,
  getDashboardAuthorizationWorkspaceScope,
  getDashboardWorkspaceId,
  getFeedbackDirectoryAssignmentAuthorizationScope,
  getFeedbackDirectoryAuthorizationScope,
  getResponseAuthorizationWorkspaceScope,
  getResponseSurveyId,
  getSurveyAuthorizationWorkspaceScope,
  getSurveyWorkspaceId,
  getTeamOrganizationId,
  getWorkspaceOrganizationId,
  getWorkspaceOrganizationReferences,
  isAuthorizationUserActive,
} from "./resolvers";

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: { findUnique: vi.fn() },
    dashboard: { findUnique: vi.fn() },
    response: { findUnique: vi.fn() },
    feedbackDirectory: { findUnique: vi.fn() },
    feedbackDirectoryWorkspace: { findUnique: vi.fn() },
    team: { findUnique: vi.fn() },
    apiKey: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    workspace: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));

const prismaKnownError = new Prisma.PrismaClientKnownRequestError("boom", {
  code: "P2025",
  clientVersion: "0.0.0",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parent-id resolvers", () => {
  // Distinct ids per assertion avoid React.cache reuse across calls in one test.
  const cases = [
    { fn: getSurveyWorkspaceId, model: prisma.survey.findUnique, row: { workspaceId: "ws1" }, value: "ws1" },
    {
      fn: getDashboardWorkspaceId,
      model: prisma.dashboard.findUnique,
      row: { workspaceId: "ws2" },
      value: "ws2",
    },
    { fn: getResponseSurveyId, model: prisma.response.findUnique, row: { surveyId: "sv1" }, value: "sv1" },
    { fn: getTeamOrganizationId, model: prisma.team.findUnique, row: { organizationId: "o1" }, value: "o1" },
    {
      fn: getApiKeyOrganizationId,
      model: prisma.apiKey.findUnique,
      row: { organizationId: "o2" },
      value: "o2",
    },
    {
      fn: getAuthorizationOrganizationId,
      model: prisma.organization.findUnique,
      row: { id: "o3" },
      value: "o3",
    },
    {
      fn: getWorkspaceOrganizationId,
      model: prisma.workspace.findUnique,
      row: { organizationId: "o4" },
      value: "o4",
    },
  ];

  test.each(cases)(
    "returns the id when found, null when missing, and rethrows Prisma errors as DatabaseError",
    async ({ fn, model, row, value }) => {
      vi.mocked(model).mockResolvedValueOnce(row);
      await expect(fn("found-id")).resolves.toBe(value);

      vi.mocked(model).mockResolvedValueOnce(null);
      await expect(fn("missing-id")).resolves.toBeNull();

      vi.mocked(model).mockRejectedValueOnce(prismaKnownError);
      await expect(fn("error-id")).rejects.toBeInstanceOf(DatabaseError);
    }
  );
});

describe("authorization workspace scope resolvers", () => {
  test("resolves survey scope in one query", async () => {
    vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce({
      workspaceId: "ws-survey",
      workspace: { organizationId: "org-1" },
    } as never);

    await expect(getSurveyAuthorizationWorkspaceScope("survey-scope")).resolves.toEqual({
      organizationId: "org-1",
      workspaceId: "ws-survey",
    });
    expect(prisma.survey.findUnique).toHaveBeenCalledWith({
      where: { id: "survey-scope" },
      select: {
        workspaceId: true,
        workspace: { select: { organizationId: true } },
      },
    });
  });

  test("resolves dashboard scope in one query", async () => {
    vi.mocked(prisma.dashboard.findUnique).mockResolvedValueOnce({
      workspaceId: "ws-dashboard",
      workspace: { organizationId: "org-2" },
    } as never);

    await expect(getDashboardAuthorizationWorkspaceScope("dashboard-scope")).resolves.toEqual({
      organizationId: "org-2",
      workspaceId: "ws-dashboard",
    });
  });

  test("resolves response scope in one query", async () => {
    vi.mocked(prisma.response.findUnique).mockResolvedValueOnce({
      survey: {
        workspaceId: "ws-response",
        workspace: { organizationId: "org-3" },
      },
    } as never);

    await expect(getResponseAuthorizationWorkspaceScope("response-scope")).resolves.toEqual({
      organizationId: "org-3",
      workspaceId: "ws-response",
    });
    expect(prisma.response.findUnique).toHaveBeenCalledWith({
      where: { id: "response-scope" },
      select: {
        survey: {
          select: {
            workspaceId: true,
            workspace: { select: { organizationId: true } },
          },
        },
      },
    });
  });

  test.each([
    [getSurveyAuthorizationWorkspaceScope, prisma.survey.findUnique],
    [getDashboardAuthorizationWorkspaceScope, prisma.dashboard.findUnique],
    [getResponseAuthorizationWorkspaceScope, prisma.response.findUnique],
  ] as const)("returns null when missing and maps Prisma errors", async (resolver, model) => {
    vi.mocked(model).mockResolvedValueOnce(null);
    await expect(resolver(`missing-${model.name}`)).resolves.toBeNull();

    vi.mocked(model).mockRejectedValueOnce(prismaKnownError);
    await expect(resolver(`error-${model.name}`)).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe("getWorkspaceOrganizationReferences", () => {
  test("deduplicates a small input into one batch query", async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValueOnce([
      { id: "workspace-1", organizationId: "org-1" },
      { id: "workspace-2", organizationId: "org-2" },
    ] as never);

    await expect(
      getWorkspaceOrganizationReferences(["workspace-1", "workspace-2", "workspace-1"])
    ).resolves.toEqual([
      { id: "workspace-1", organizationId: "org-1" },
      { id: "workspace-2", organizationId: "org-2" },
    ]);
    expect(prisma.workspace.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: { in: ["workspace-1", "workspace-2"] } },
      select: { id: true, organizationId: true },
    });
  });

  test("uses bounded batches and maps Prisma failures to DatabaseError", async () => {
    const workspaceIds = Array.from({ length: 501 }, (_unused, index) => `workspace-${index}`);
    vi.mocked(prisma.workspace.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(prismaKnownError);

    await expect(getWorkspaceOrganizationReferences(workspaceIds)).resolves.toEqual([]);
    expect(prisma.workspace.findMany).toHaveBeenCalledTimes(2);
    expect(vi.mocked(prisma.workspace.findMany).mock.calls[0][0].where.id.in).toHaveLength(500);
    expect(vi.mocked(prisma.workspace.findMany).mock.calls[1][0].where.id.in).toHaveLength(1);

    await expect(getWorkspaceOrganizationReferences(["workspace-error"])).rejects.toBeInstanceOf(
      DatabaseError
    );
  });

  test("does not query PostgreSQL for an empty set", async () => {
    await expect(getWorkspaceOrganizationReferences([])).resolves.toEqual([]);
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });
});

describe("isAuthorizationUserActive", () => {
  test("requires an existing active user and preserves operational failures", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isActive: true } as never);
    await expect(isAuthorizationUserActive("active-user")).resolves.toBe(true);

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ isActive: false } as never);
    await expect(isAuthorizationUserActive("inactive-user")).resolves.toBe(false);

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    await expect(isAuthorizationUserActive("missing-user")).resolves.toBe(false);

    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(prismaKnownError);
    await expect(isAuthorizationUserActive("error-user")).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe("feedback dataset scope resolvers", () => {
  test("resolves an active directory and its assigned workspace IDs", async () => {
    vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce({
      isArchived: false,
      organizationId: "org-1",
      workspaces: [{ workspaceId: "workspace-a" }, { workspaceId: "workspace-b" }],
    } as never);

    await expect(getFeedbackDirectoryAuthorizationScope("directory-1")).resolves.toEqual({
      isArchived: false,
      organizationId: "org-1",
      workspaceIds: ["workspace-a", "workspace-b"],
    });
  });

  test("resolves only active same-organization assignment pairs", async () => {
    vi.mocked(prisma.feedbackDirectoryWorkspace.findUnique).mockResolvedValueOnce({
      feedbackDirectory: { isArchived: false, organizationId: "org-1" },
      workspace: { organizationId: "org-1" },
    } as never);

    await expect(
      getFeedbackDirectoryAssignmentAuthorizationScope("directory-1", "workspace-1")
    ).resolves.toMatchObject({
      assignmentId: expect.stringMatching(/^fdwa_/),
      organizationId: "org-1",
      workspaceId: "workspace-1",
    });

    vi.mocked(prisma.feedbackDirectoryWorkspace.findUnique).mockResolvedValueOnce({
      feedbackDirectory: { isArchived: true, organizationId: "org-1" },
      workspace: { organizationId: "org-1" },
    } as never);
    await expect(
      getFeedbackDirectoryAssignmentAuthorizationScope("directory-archived", "workspace-1")
    ).resolves.toBeNull();

    vi.mocked(prisma.feedbackDirectoryWorkspace.findUnique).mockResolvedValueOnce({
      feedbackDirectory: { isArchived: false, organizationId: "org-1" },
      workspace: { organizationId: "org-2" },
    } as never);
    await expect(
      getFeedbackDirectoryAssignmentAuthorizationScope("directory-cross-org", "workspace-2")
    ).resolves.toBeNull();
  });

  test("preserves missing rows as denials and database failures as operational errors", async () => {
    vi.mocked(prisma.feedbackDirectory.findUnique).mockResolvedValueOnce(null);
    await expect(getFeedbackDirectoryAuthorizationScope("directory-missing")).resolves.toBeNull();

    vi.mocked(prisma.feedbackDirectoryWorkspace.findUnique).mockRejectedValueOnce(prismaKnownError);
    await expect(
      getFeedbackDirectoryAssignmentAuthorizationScope("directory-error", "workspace-error")
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe("getApiKeyAuthById", () => {
  test("maps the key's workspace grants and organization access", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce({
      id: "key1",
      organizationId: "org1",
      organizationAccess: { accessControl: { read: true, write: false } },
      apiKeyWorkspaces: [
        {
          permission: "read",
          workspaceId: "ws1",
          workspace: { name: "Growth", organizationId: "org1" },
        },
      ],
    } as never);

    await expect(getApiKeyAuthById("key1")).resolves.toEqual({
      type: "apiKey",
      apiKeyId: "key1",
      organizationId: "org1",
      organizationAccess: { accessControl: { read: true, write: false } },
      workspacePermissions: [{ permission: "read", workspaceId: "ws1", workspaceName: "Growth" }],
    });
  });

  test("drops workspace grants outside the API key's organization", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce({
      id: "key-with-foreign-grant",
      organizationId: "org1",
      organizationAccess: {},
      apiKeyWorkspaces: [
        {
          permission: "manage",
          workspaceId: "ws-legitimate",
          workspace: { name: "Legitimate", organizationId: "org1" },
        },
        {
          permission: "manage",
          workspaceId: "ws-foreign",
          workspace: { name: "Foreign", organizationId: "org2" },
        },
      ],
    } as never);

    await expect(getApiKeyAuthById("key-with-foreign-grant")).resolves.toEqual({
      type: "apiKey",
      apiKeyId: "key-with-foreign-grant",
      organizationId: "org1",
      organizationAccess: {},
      workspacePermissions: [
        { permission: "manage", workspaceId: "ws-legitimate", workspaceName: "Legitimate" },
      ],
    });
  });

  test("returns null when the key no longer exists", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce(null);
    await expect(getApiKeyAuthById("gone")).resolves.toBeNull();
  });

  test("rethrows Prisma errors as DatabaseError", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockRejectedValueOnce(prismaKnownError);
    await expect(getApiKeyAuthById("boom")).rejects.toBeInstanceOf(DatabaseError);
  });
});
