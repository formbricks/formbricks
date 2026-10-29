import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getOrganizationCreationPolicy } from "@/app/api/v3/organizations/lib/creation-policy";
import {
  lookupAuthorizedOrganizationIds,
  lookupAuthorizedWorkspaceIds,
} from "@/lib/authorization/resource-list";
import { getOrganizationWorkspacesLimit } from "@/modules/ee/license-check/lib/utils";
import { getV3AccountContext } from "./context";
import { ZV3AccountContext } from "./schemas";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn() },
    organization: { findUnique: vi.fn(), findMany: vi.fn() },
    survey: { groupBy: vi.fn() },
    invite: { groupBy: vi.fn() },
  },
}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/app/api/v3/organizations/lib/creation-policy", () => ({
  getOrganizationCreationPolicy: vi.fn(),
}));
vi.mock("@/lib/authorization/resource-list", () => ({
  lookupAuthorizedOrganizationIds: vi.fn(),
  lookupAuthorizedWorkspaceIds: vi.fn(),
}));
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

const workspaceRow = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name,
  appSetupCompleted: false,
  logo: null,
  styling: null,
  ...overrides,
});

const organizationRow = (id: string, workspaces: unknown[], count = workspaces.length) => ({
  id,
  _count: { workspaces: count },
  workspaces,
});

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
    vi.mocked(prisma.organization.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.survey.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.invite.groupBy).mockResolvedValue([
      { organizationId: "org_1", _count: { _all: 2 } },
    ] as never);
    vi.mocked(getOrganizationWorkspacesLimit).mockResolvedValue(3);
    vi.mocked(getOrganizationCreationPolicy).mockResolvedValue({
      allowed: true,
      hasNoOrganizations: false,
      isMultiOrgEnabled: true,
    });
  });

  test("an organization with no workspace is listed with an empty workspace list and can create one", async () => {
    const { response, body } = await run();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      principal: "user",
      canCreateOrganization: true,
      user: { id: "user_1", name: "Ada", email: "ada@example.com" },
      organizations: [
        {
          id: "org_1",
          name: "Acme",
          role: "owner",
          canManage: true,
          canCreateWorkspace: true,
          pendingInviteCount: 2,
          workspaceCount: 0,
          workspacesTruncated: false,
          workspaces: [],
        },
      ],
      setup: { organizationCount: 1, workspaceCount: 0, surveyCount: 0 },
    });
    expect(ZV3AccountContext.safeParse(body.data).success).toBe(true);
    // Nothing to count surveys in, so no survey or workspace query is made.
    expect(prisma.survey.groupBy).not.toHaveBeenCalled();
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  test("no field says how the person joined: that is not stored, so it is not reported", async () => {
    const { body } = await run();

    expect(body.data.organizations[0]).not.toHaveProperty("joinedAs");
  });

  test("derives survey counts, branding per workspace and the workspace limit from existing data", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws_1", "ws_2", "ws_foreign"]);
    vi.mocked(prisma.organization.findMany).mockResolvedValue([
      organizationRow("org_1", [
        workspaceRow("ws_1", "Alpha", {
          appSetupCompleted: true,
          logo: { url: "/storage/ws_1/public/logo.png" },
          styling: { brandColor: { light: "#112233" } },
        }),
        workspaceRow("ws_2", "Beta", { styling: { allowStyleOverwrite: true } }),
      ]),
    ] as never);
    vi.mocked(prisma.survey.groupBy).mockResolvedValue([
      { workspaceId: "ws_1", _count: { _all: 4 } },
    ] as never);
    vi.mocked(getOrganizationWorkspacesLimit).mockResolvedValue(2);

    const { body } = await run();

    // Branding is per workspace: one branded and one plain workspace are told apart.
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
    expect(body.data.setup).toEqual({ organizationCount: 1, workspaceCount: 2, surveyCount: 4 });
    expect(body.data.setup).not.toHaveProperty("brandingSet");
  });

  test("makes one query of each kind for any number of organizations (no per-organization N+1)", async () => {
    const orgs = ["org_1", "org_2", "org_3"];
    vi.mocked(lookupAuthorizedOrganizationIds).mockResolvedValue(orgs);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws_1", "ws_2", "ws_3"]);
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { role: "owner", organization: { id: "org_1", name: "A" } },
      { role: "manager", organization: { id: "org_2", name: "B" } },
      { role: "member", organization: { id: "org_3", name: "C" } },
    ] as never);
    vi.mocked(prisma.organization.findMany).mockResolvedValue(
      orgs.map((id, index) =>
        organizationRow(id, [workspaceRow(`ws_${index + 1}`, `W${index + 1}`)])
      ) as never
    );
    vi.mocked(prisma.survey.groupBy).mockResolvedValue([
      { workspaceId: "ws_1", _count: { _all: 1 } },
      { workspaceId: "ws_2", _count: { _all: 2 } },
      { workspaceId: "ws_3", _count: { _all: 3 } },
    ] as never);
    vi.mocked(prisma.invite.groupBy).mockResolvedValue([
      { organizationId: "org_1", _count: { _all: 1 } },
      { organizationId: "org_2", _count: { _all: 5 } },
    ] as never);

    const { body } = await run();

    expect(prisma.organization.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.survey.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.invite.groupBy).toHaveBeenCalledTimes(1);
    // The limit is read once per organization the caller manages, never for a plain member's.
    expect(getOrganizationWorkspacesLimit).toHaveBeenCalledTimes(2);
    expect(vi.mocked(prisma.invite.groupBy).mock.calls[0][0]).toMatchObject({
      where: { organizationId: { in: ["org_1", "org_2"] } },
    });
    expect(
      body.data.organizations.map((o: { pendingInviteCount: number | null }) => o.pendingInviteCount)
    ).toEqual([1, 5, null]);
    expect(body.data.setup).toEqual({ organizationCount: 3, workspaceCount: 3, surveyCount: 6 });
  });

  test("the survey count runs through the visibility predicate, with managers and plain members in their own clause", async () => {
    vi.mocked(lookupAuthorizedOrganizationIds).mockResolvedValue(["org_1", "org_2"]);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws_1", "ws_2"]);
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { role: "manager", organization: { id: "org_1", name: "A" } },
      { role: "member", organization: { id: "org_2", name: "B" } },
    ] as never);

    await run();

    const [{ where }] = vi.mocked(prisma.survey.groupBy).mock.calls[0] as unknown as [
      { where: { workspaceId: unknown; OR: Array<Record<string, unknown>> } },
    ];
    expect(where.workspaceId).toEqual({ in: ["ws_1", "ws_2"] });
    expect(where.OR).toHaveLength(2);
    // A manager sees every survey (no extra clause); a member only shared ones and their own.
    expect(where.OR[0]).toEqual({ workspace: { organizationId: { in: ["org_1"] } } });
    expect(where.OR[1]).toMatchObject({ workspace: { organizationId: { in: ["org_2"] } } });
    expect(JSON.stringify(where.OR[1])).toContain("user_1");
  });

  test("workspaces are capped per organization, flagged as truncated, and counted from their real number", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws_1", "ws_2"]);
    vi.mocked(prisma.organization.findMany).mockResolvedValue([
      organizationRow("org_1", [workspaceRow("ws_1", "A"), workspaceRow("ws_2", "B")], 750),
    ] as never);
    vi.mocked(getOrganizationWorkspacesLimit).mockResolvedValue(1000);

    const { body } = await run();

    // The cap is a take on the nested relation, which Prisma applies per organization.
    expect(vi.mocked(prisma.organization.findMany).mock.calls[0][0]).toMatchObject({
      select: { workspaces: { take: 500 } },
    });
    const [organization] = body.data.organizations;
    expect(organization.workspaces).toHaveLength(2);
    expect(organization.workspaceCount).toBe(750);
    expect(organization.workspacesTruncated).toBe(true);
    expect(body.data.setup.workspaceCount).toBe(750);
    // 750 of 1000: from the real count, not from the two listed.
    expect(organization.canCreateWorkspace).toBe(true);
  });

  test("canCreateWorkspace uses the real count, not the capped list", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws_1"]);
    vi.mocked(prisma.organization.findMany).mockResolvedValue([
      organizationRow("org_1", [workspaceRow("ws_1", "A")], 600),
    ] as never);
    vi.mocked(getOrganizationWorkspacesLimit).mockResolvedValue(600);

    const { body } = await run();

    expect(body.data.organizations[0].canCreateWorkspace).toBe(false);
  });

  test("one organization's size does not starve another's list", async () => {
    vi.mocked(lookupAuthorizedOrganizationIds).mockResolvedValue(["org_1", "org_2"]);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws_1", "ws_2"]);
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { role: "owner", organization: { id: "org_1", name: "A" } },
      { role: "owner", organization: { id: "org_2", name: "B" } },
    ] as never);
    vi.mocked(prisma.organization.findMany).mockResolvedValue([
      organizationRow("org_1", [workspaceRow("ws_1", "Big")], 900),
      organizationRow("org_2", [workspaceRow("ws_2", "Small")]),
    ] as never);

    const { body } = await run();

    const [big, small] = body.data.organizations;
    expect(big.workspacesTruncated).toBe(true);
    expect(small.workspacesTruncated).toBe(false);
    expect(small.workspaces.map((w: { id: string }) => w.id)).toEqual(["ws_2"]);
  });

  test("an invited member does not get pending invites or the create right, and no limit is looked up", async () => {
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { role: "member", organization: { id: "org_1", name: "Acme" } },
    ] as never);

    const { body } = await run();

    expect(body.data.organizations[0]).toMatchObject({
      role: "member",
      canManage: false,
      canCreateWorkspace: false,
      pendingInviteCount: null,
    });
    expect(prisma.invite.groupBy).not.toHaveBeenCalled();
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
    expect(prisma.survey.groupBy).not.toHaveBeenCalled();
  });

  test("an API key sees its own organization, no user and no role, and only shared surveys count", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "org_1", name: "Acme" } as never);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws_1"]);
    vi.mocked(prisma.organization.findMany).mockResolvedValue([
      organizationRow("org_1", [workspaceRow("ws_1", "Alpha")]),
    ] as never);

    const { body } = await run(apiKey);

    expect(body.data.principal).toBe("apiKey");
    expect(body.data.user).toBeNull();
    expect(body.data.organizations[0]).toMatchObject({
      id: "org_1",
      role: null,
      canManage: false,
      canCreateWorkspace: false,
      pendingInviteCount: null,
      workspaceCount: 1,
    });
    expect(lookupAuthorizedOrganizationIds).not.toHaveBeenCalled();
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
    const [{ where }] = vi.mocked(prisma.survey.groupBy).mock.calls[0] as unknown as [
      { where: { OR: Array<Record<string, unknown>> } },
    ];
    expect(JSON.stringify(where.OR)).toContain("visibility");
    expect(JSON.stringify(where.OR)).not.toContain("ownerId");
  });

  test("canCreateOrganization follows the creation policy for a signed-in person", async () => {
    for (const allowed of [true, false]) {
      vi.mocked(getOrganizationCreationPolicy).mockResolvedValue({
        allowed,
        hasNoOrganizations: false,
        isMultiOrgEnabled: allowed,
      });

      expect((await run()).body.data.canCreateOrganization).toBe(allowed);
    }
  });

  test("an API key never can create an organization, and the policy is not even read", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ id: "org_1", name: "Acme" } as never);

    const { body } = await run(apiKey);

    expect(body.data.canCreateOrganization).toBe(false);
    expect(getOrganizationCreationPolicy).not.toHaveBeenCalled();
  });

  test("no authentication is 401", async () => {
    expect((await run(null)).response.status).toBe(401);
  });
});
