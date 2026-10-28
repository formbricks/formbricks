import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  lookupAuthorizedOrganizationIds,
  lookupAuthorizedWorkspaceIds,
} from "@/lib/authorization/resource-list";
import { resolveSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { getOrganizationWorkspacesLimit } from "@/modules/ee/license-check/lib/utils";
import { getV3AccountContext } from "./context";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn() },
    organization: { findUnique: vi.fn() },
    workspace: { findMany: vi.fn() },
    survey: { groupBy: vi.fn() },
    invite: { count: vi.fn() },
  },
}));
vi.mock("@/lib/authorization/resource-list", () => ({
  lookupAuthorizedOrganizationIds: vi.fn(),
  lookupAuthorizedWorkspaceIds: vi.fn(),
}));
vi.mock("@/lib/survey/visibility/actor-context", () => ({ resolveSurveyActorContext: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getOrganizationWorkspacesLimit: vi.fn() }));

const requestId = "req_1";
const instance = "/api/mcp";
const session = { user: { id: "user_1" }, expires: "2099-01-01" } as never;
const apiKey = { apiKeyId: "key_1", organizationId: "org_1", workspacePermissions: [] } as never;

const run = async (authentication: unknown = session) => {
  const response = await getV3AccountContext({
    authentication: authentication as never,
    requestId,
    instance,
  });
  return { response, body: await response.json() };
};

describe("getV3AccountContext", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(lookupAuthorizedOrganizationIds).mockResolvedValue(["org_1"]);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue([]);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
    } as never);
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { role: "owner", organization: { id: "org_1", name: "Acme" } },
    ] as never);
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);
    vi.mocked(prisma.survey.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.invite.count).mockResolvedValue(2);
    vi.mocked(resolveSurveyActorContext).mockResolvedValue({ enforced: true, kind: "apiKey" });
    vi.mocked(getOrganizationWorkspacesLimit).mockResolvedValue(3);
  });

  test("an organization with no workspace is listed with an empty workspace list and can create one", async () => {
    const { response, body } = await run();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      principal: "user",
      user: { id: "user_1", name: "Ada", email: "ada@example.com" },
      organizations: [
        {
          id: "org_1",
          name: "Acme",
          role: "owner",
          joinedAs: "owner",
          canManage: true,
          canCreateWorkspace: true,
          pendingInviteCount: 2,
          workspaces: [],
        },
      ],
      setup: { organizationCount: 1, workspaceCount: 0, surveyCount: 0, brandingSet: false },
    });
    // Nothing to count surveys in, so no survey query is made.
    expect(prisma.survey.groupBy).not.toHaveBeenCalled();
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });

  test("derives survey counts, branding and workspace limit from existing data", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws_1", "ws_2", "ws_foreign"]);
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      {
        id: "ws_1",
        name: "Alpha",
        organizationId: "org_1",
        appSetupCompleted: true,
        logo: { url: "/storage/ws_1/public/logo.png" },
        styling: { brandColor: { light: "#112233" } },
      },
      {
        id: "ws_2",
        name: "Beta",
        organizationId: "org_1",
        appSetupCompleted: false,
        logo: null,
        styling: { allowStyleOverwrite: true },
      },
    ] as never);
    vi.mocked(prisma.survey.groupBy).mockResolvedValue([
      { workspaceId: "ws_1", _count: { _all: 4 } },
    ] as never);
    vi.mocked(getOrganizationWorkspacesLimit).mockResolvedValue(2);

    const { body } = await run();

    expect(body.data.organizations[0].workspaces).toEqual([
      {
        id: "ws_1",
        name: "Alpha",
        surveyCount: 4,
        appSetupCompleted: true,
        branding: { logoSet: true, brandColor: "#112233" },
      },
      {
        id: "ws_2",
        name: "Beta",
        surveyCount: 0,
        appSetupCompleted: false,
        branding: { logoSet: false, brandColor: null },
      },
    ]);
    // At the plan's limit: the person may not create another.
    expect(body.data.organizations[0].canCreateWorkspace).toBe(false);
    expect(body.data.setup).toEqual({
      organizationCount: 1,
      workspaceCount: 2,
      surveyCount: 4,
      brandingSet: true,
    });
    // Workspaces are fetched only inside the caller's own organizations, and counted through visibility.
    expect(prisma.workspace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["ws_1", "ws_2", "ws_foreign"] }, organizationId: { in: ["org_1"] } },
      })
    );
    expect(resolveSurveyActorContext).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "org_1");
  });

  test("an invited member is told so, and neither pending invites nor the create right are exposed", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { role: "member", organization: { id: "org_1", name: "Acme" } },
    ] as never);

    const { body } = await run();

    expect(body.data.organizations[0]).toMatchObject({
      role: "member",
      joinedAs: "invited",
      canManage: false,
      canCreateWorkspace: false,
      pendingInviteCount: null,
    });
    expect(prisma.invite.count).not.toHaveBeenCalled();
    expect(getOrganizationWorkspacesLimit).not.toHaveBeenCalled();
  });

  test("only organizations the graph lets the caller read are queried, and only accepted memberships count", async () => {
    vi.mocked(lookupAuthorizedOrganizationIds).mockResolvedValue(["org_1", "org_2"]);
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { role: "manager", organization: { id: "org_2", name: "Zeta" } },
      { role: "owner", organization: { id: "org_1", name: "Acme" } },
    ] as never);

    const { body } = await run();

    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1", accepted: true, organizationId: { in: ["org_1", "org_2"] } },
      })
    );
    expect(body.data.organizations.map((organization: { id: string }) => organization.id)).toEqual([
      "org_1",
      "org_2",
    ]);
    expect(body.data.setup.organizationCount).toBe(2);
  });

  test("a person with no organization gets an empty, valid context", async () => {
    vi.mocked(lookupAuthorizedOrganizationIds).mockResolvedValue([]);
    vi.mocked(prisma.membership.findMany).mockResolvedValue([]);

    const { response, body } = await run();

    expect(response.status).toBe(200);
    expect(body.data.organizations).toEqual([]);
    expect(lookupAuthorizedWorkspaceIds).not.toHaveBeenCalled();
  });

  test("an API key sees its own organization, no user and no role", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "org_1", name: "Acme" } as never);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws_1"]);
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      {
        id: "ws_1",
        name: "Alpha",
        organizationId: "org_1",
        appSetupCompleted: false,
        logo: null,
        styling: null,
      },
    ] as never);

    const { body } = await run(apiKey);

    expect(body.data.principal).toBe("apiKey");
    expect(body.data.user).toBeNull();
    expect(body.data.organizations[0]).toMatchObject({
      id: "org_1",
      role: null,
      joinedAs: null,
      canManage: false,
      canCreateWorkspace: false,
      pendingInviteCount: null,
    });
    expect(lookupAuthorizedOrganizationIds).not.toHaveBeenCalled();
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
  });

  test("no authentication is 401", async () => {
    expect((await run(null)).response.status).toBe(401);
  });
});
