import { createId } from "@paralleldrive/cuid2";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma, WidgetPlacement, Workspace } from "@formbricks/database/prisma";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import {
  lookupAuthorizedOrganizationIds,
  lookupAuthorizedWorkspaceIds,
} from "@/lib/authorization/resource-list";
import { ITEMS_PER_PAGE } from "../constants";
import {
  getOrganizationScopedWorkspacesByIdsForUser,
  getUserWorkspaces,
  getUserWorkspacesByOrganizationIds,
  getWorkspace,
  getWorkspaceLegacyStoragePrefixes,
  getWorkspaceMemberEmails,
  getWorkspaceMembers,
  getWorkspaces,
  getWorkspacesByIds,
} from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    membership: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/authorization/resource-list", () => ({
  lookupAuthorizedOrganizationIds: vi.fn(),
  lookupAuthorizedWorkspaceIds: vi.fn(),
}));

describe("Workspace Service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("getWorkspace should return a workspace when it exists", async () => {
    const mockWorkspace = {
      id: createId(),
      name: "Test Workspace",
      organizationId: createId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      languages: ["en"],
      recontactDays: 0,
      linkSurveyBranding: true,
      inAppSurveyBranding: true,
      config: {
        channel: null,
        industry: null,
      },
      placement: WidgetPlacement.bottomRight,
      clickOutsideClose: true,
      overlay: "none",
      styling: {
        allowStyleOverwrite: true,
      },
      logo: null,
      brandColor: null,
      highlightBorderColor: null,
    };

    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspace as unknown as Workspace);

    const result = await getWorkspace(mockWorkspace.id);

    expect(result).toEqual(mockWorkspace);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: {
        id: mockWorkspace.id,
      },
      select: expect.any(Object),
    });
  });

  test("getWorkspace should return null when workspace does not exist", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    const result = await getWorkspace(createId());

    expect(result).toBeNull();
  });

  test("getWorkspace should throw DatabaseError when prisma throws", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(prismaError);

    await expect(getWorkspace(createId())).rejects.toThrow(DatabaseError);
  });

  test("getUserWorkspaces should return workspaces for admin user", async () => {
    const userId = createId();
    const organizationId = createId();
    const mockWorkspaces = [
      {
        id: createId(),
        name: "Test Workspace 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
      {
        id: createId(),
        name: "Test Workspace 2",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
    ];

    vi.mocked(lookupAuthorizedOrganizationIds).mockResolvedValue([organizationId]);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(mockWorkspaces.map(({ id }) => id));

    vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as unknown as Workspace[]);

    const result = await getUserWorkspaces(userId, organizationId);

    expect(result).toEqual(mockWorkspaces);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: mockWorkspaces.map(({ id }) => id) },
        organizationId,
      },
      select: expect.any(Object),
      take: undefined,
      skip: undefined,
    });
  });

  test("getUserWorkspaces should return workspaces for member user", async () => {
    const userId = createId();
    const organizationId = createId();
    const mockWorkspaces = [
      {
        id: createId(),
        name: "Test Workspace 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
    ];

    vi.mocked(lookupAuthorizedOrganizationIds).mockResolvedValue([organizationId]);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(mockWorkspaces.map(({ id }) => id));

    vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as unknown as Workspace[]);

    const result = await getUserWorkspaces(userId, organizationId);

    expect(result).toEqual(mockWorkspaces);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: mockWorkspaces.map(({ id }) => id) },
        organizationId,
      },
      select: expect.any(Object),
      take: undefined,
      skip: undefined,
    });
  });

  test("getUserWorkspacesByOrganizationIds resolves only authoritative workspace ids in the organizations", async () => {
    const userId = createId();
    const orgManager = createId();
    const orgBilling = createId();

    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["workspace-1"]);
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);

    await getUserWorkspacesByOrganizationIds([orgManager, orgBilling], userId);

    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["workspace-1"] },
        organizationId: { in: [orgManager, orgBilling] },
      },
      select: { id: true },
    });
  });

  test("getUserWorkspaces does not widen a billing user's empty SpiceDB workspace list", async () => {
    const userId = createId();
    const organizationId = createId();

    vi.mocked(lookupAuthorizedOrganizationIds).mockResolvedValue([organizationId]);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue([]);
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);

    await getUserWorkspaces(userId, organizationId);

    // SpiceDB's workspace.read excludes billing, so no role-name SQL branch can accidentally widen it.
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [] },
        organizationId,
      },
      select: expect.any(Object),
      take: undefined,
      skip: undefined,
    });
  });

  test("getUserWorkspaces should throw ValidationError when user is not a member of organization", async () => {
    const userId = createId();
    const organizationId = createId();

    vi.mocked(lookupAuthorizedOrganizationIds).mockResolvedValue([]);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue([]);

    await expect(getUserWorkspaces(userId, organizationId)).rejects.toThrow(ValidationError);
  });

  test("getUserWorkspaces should handle pagination", async () => {
    const userId = createId();
    const organizationId = createId();
    const mockWorkspaces = [
      {
        id: createId(),
        name: "Test Workspace 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
    ];

    vi.mocked(lookupAuthorizedOrganizationIds).mockResolvedValue([organizationId]);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(mockWorkspaces.map(({ id }) => id));

    vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as unknown as Workspace[]);

    const page = 2;
    const result = await getUserWorkspaces(userId, organizationId, page);

    expect(result).toEqual(mockWorkspaces);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: mockWorkspaces.map(({ id }) => id) },
        organizationId,
      },
      select: expect.any(Object),
      take: ITEMS_PER_PAGE,
      skip: ITEMS_PER_PAGE * (page - 1),
    });
  });

  test("getWorkspaces should return all workspaces for an organization", async () => {
    const organizationId = createId();
    const mockWorkspaces = [
      {
        id: createId(),
        name: "Test Workspace 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
      {
        id: createId(),
        name: "Test Workspace 2",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
    ];

    vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as unknown as Workspace[]);

    const result = await getWorkspaces(organizationId);

    expect(result).toEqual(mockWorkspaces);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
      },
      select: expect.any(Object),
      take: undefined,
      skip: undefined,
    });
  });

  test("getWorkspaces should handle pagination", async () => {
    const organizationId = createId();
    const mockWorkspaces = [
      {
        id: createId(),
        name: "Test Workspace 1",
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        languages: ["en"],
        recontactDays: 0,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {
          channel: null,
          industry: null,
        },
        placement: WidgetPlacement.bottomRight,
        clickOutsideClose: true,
        overlay: "none",
        styling: {
          allowStyleOverwrite: true,
        },
        logo: null,
        brandColor: null,
        highlightBorderColor: null,
      },
    ];

    vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as unknown as Workspace[]);

    const page = 2;
    const result = await getWorkspaces(organizationId, page);

    expect(result).toEqual(mockWorkspaces);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        organizationId,
      },
      select: expect.any(Object),
      take: ITEMS_PER_PAGE,
      skip: ITEMS_PER_PAGE * (page - 1),
    });
  });

  test("getWorkspaces should throw DatabaseError when prisma throws", async () => {
    const organizationId = createId();
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.workspace.findMany).mockRejectedValue(prismaError);

    await expect(getWorkspaces(organizationId)).rejects.toThrow(DatabaseError);
  });

  test("getWorkspacesByIds scopes the workspace read to the organization", async () => {
    const organizationId = createId();
    const workspaceIds = [createId(), createId()];
    const mockWorkspaces = workspaceIds.map((id) => ({ id, organizationId }));
    vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as unknown as Workspace[]);

    await expect(getWorkspacesByIds(organizationId, workspaceIds)).resolves.toEqual(mockWorkspaces);
    expect(prisma.workspace.findMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: { in: workspaceIds },
        organizationId,
      },
      select: expect.any(Object),
    });
  });

  test("getWorkspacesByIds skips the database for an empty workspace list", async () => {
    await expect(getWorkspacesByIds(createId(), [])).resolves.toEqual([]);
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });

  test("getOrganizationScopedWorkspacesByIdsForUser verifies lookup results against current tenant membership", async () => {
    const userId = createId();
    const workspaceIds = [createId(), createId()];
    const mockWorkspaces = workspaceIds.map((id) => ({ id, organizationId: createId() }));
    vi.mocked(prisma.workspace.findMany).mockResolvedValue(mockWorkspaces as unknown as Workspace[]);

    await expect(getOrganizationScopedWorkspacesByIdsForUser(userId, workspaceIds)).resolves.toEqual(
      mockWorkspaces
    );
    expect(prisma.workspace.findMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: { in: workspaceIds },
        organization: { memberships: { some: { userId } } },
      },
      select: expect.any(Object),
    });
  });

  test("getOrganizationScopedWorkspacesByIdsForUser skips PostgreSQL for an empty authoritative list", async () => {
    await expect(getOrganizationScopedWorkspacesByIdsForUser(createId(), [])).resolves.toEqual([]);
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });

  describe("getWorkspaceLegacyStoragePrefixes", () => {
    test("returns both the workspace id and its legacyEnvironmentId when set", async () => {
      const workspaceId = createId();
      const legacyEnvironmentId = createId();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        id: workspaceId,
        legacyEnvironmentId,
      } as unknown as Workspace);

      await expect(getWorkspaceLegacyStoragePrefixes(workspaceId)).resolves.toEqual([
        workspaceId,
        legacyEnvironmentId,
      ]);
    });

    test("returns only the workspace id when legacyEnvironmentId is null", async () => {
      const workspaceId = createId();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        id: workspaceId,
        legacyEnvironmentId: null,
      } as unknown as Workspace);

      await expect(getWorkspaceLegacyStoragePrefixes(workspaceId)).resolves.toEqual([workspaceId]);
    });

    test("returns an empty array when the workspace does not exist", async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(getWorkspaceLegacyStoragePrefixes(createId())).resolves.toEqual([]);
    });

    test("throws ValidationError for an invalid workspace id", async () => {
      await expect(getWorkspaceLegacyStoragePrefixes("not-a-cuid")).rejects.toThrow(ValidationError);
    });

    test("throws DatabaseError when prisma throws", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.workspace.findUnique).mockRejectedValue(prismaError);

      await expect(getWorkspaceLegacyStoragePrefixes(createId())).rejects.toThrow(DatabaseError);
    });
  });

  // Fresh cuid per test: both functions are `reactCache`d, so reusing a workspace id would replay a
  // previous test's result instead of the mock set up here.
  describe("getWorkspaceMembers / getWorkspaceMemberEmails (send_email recipient allowlist)", () => {
    const member = (name: string, email: string) => ({ user: { name, email } });

    test("selects the members who can access the workspace: org owner/manager, or a team linked to it", async () => {
      // The filter is the behavior here — it decides who may receive a workspace's response data, so
      // it is asserted directly. It mirrors the central `workspace.read` permission: an
      // owner/manager reaches every workspace in the org, everyone else only through a linked team
      // (any `WorkspaceTeam` permission, since `read` already grants access). The organization comes
      // from the workspace itself, never from a caller-supplied id.
      const workspaceId = createId();
      vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

      await getWorkspaceMembers(workspaceId);

      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: {
          organization: { workspaces: { some: { id: workspaceId } } },
          user: { isActive: true },
          OR: [
            { role: { in: ["owner", "manager"] } },
            { user: { teamUsers: { some: { team: { workspaceTeams: { some: { workspaceId } } } } } } },
          ],
        },
        select: { user: { select: { name: true, email: true } } },
      });
    });

    test("returns the name and email of each member with workspace access", async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        member("Owner", "owner@corp.example"),
        member("Team Member", "member@corp.example"),
      ] as never);

      await expect(getWorkspaceMembers(createId())).resolves.toEqual([
        { name: "Owner", email: "owner@corp.example" },
        { name: "Team Member", email: "member@corp.example" },
      ]);
    });

    test("drops a member with an empty email so a blank recipient can never match", async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        member("Kept", "kept@corp.example"),
        member("No Email", ""),
      ] as never);

      await expect(getWorkspaceMembers(createId())).resolves.toEqual([
        { name: "Kept", email: "kept@corp.example" },
      ]);
    });

    test("normalizes the allowlist emails so recipient matching stays case-insensitive", async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        member("Mixed Case", "  Member@Corp.Example "),
        member("Second", "second@corp.example"),
      ] as never);

      await expect(getWorkspaceMemberEmails(createId())).resolves.toEqual(
        new Set(["member@corp.example", "second@corp.example"])
      );
    });

    test("returns an empty allowlist when nobody can access the workspace (fails closed)", async () => {
      // A revoked team, a deleted workspace or a foreign id all land here; the callers treat an empty
      // set as "reject every literal recipient" rather than "skip the check".
      vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

      await expect(getWorkspaceMemberEmails(createId())).resolves.toEqual(new Set());
    });

    test("throws ValidationError for an invalid workspace id", async () => {
      await expect(getWorkspaceMemberEmails("not-a-cuid")).rejects.toThrow(ValidationError);
    });

    test("throws DatabaseError when prisma throws", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.membership.findMany).mockRejectedValue(prismaError);

      await expect(getWorkspaceMemberEmails(createId())).rejects.toThrow(DatabaseError);
    });
  });
});
