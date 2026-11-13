import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import {
  keepOfferedMcpGrantSelection,
  listMcpGrantAccessOptions,
  resolveMcpGrantSelection,
} from "./access-options";

vi.mock("@/lib/authorization/resource-list", () => ({ lookupAuthorizedWorkspaceIds: vi.fn() }));

const USER_ID = "user-1";

describe("listMcpGrantAccessOptions", () => {
  beforeEach(() => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockReset();
  });

  test("offers the user's non-billing organizations and the readable workspaces in them, sorted by name", async () => {
    prisma.membership.findMany.mockResolvedValue([
      { organization: { id: "org-b", name: "Beta" } },
      { organization: { id: "org-a2", name: "Alpha" } },
      { organization: { id: "org-a1", name: "Alpha" } },
    ] as never);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws-1", "ws-2", "ws-3", "ws-4"]);
    prisma.workspace.findMany.mockResolvedValue([
      { id: "ws-1", name: "Zed", organizationId: "org-a1" },
      { id: "ws-2", name: "Main", organizationId: "org-b" },
      { id: "ws-4", name: "Main", organizationId: "org-a1" },
      { id: "ws-3", name: "Main", organizationId: "org-a1" },
    ] as never);

    const options = await listMcpGrantAccessOptions(USER_ID);

    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, role: { not: "billing" } } })
    );
    // `dashboard_read` so a Dashboard viewer is offered their dashboard workspaces.
    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledWith(
      { type: "user", id: USER_ID },
      "dashboard_read"
    );
    // Never a workspace outside the user's (non-billing) organizations.
    expect(prisma.workspace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["ws-1", "ws-2", "ws-3", "ws-4"] },
          organizationId: { in: ["org-a1", "org-a2", "org-b"] },
        },
      })
    );
    expect(options.organizations.map(({ id }) => id)).toEqual(["org-a1", "org-a2", "org-b"]);
    expect(options.workspaces).toEqual([
      { id: "ws-3", name: "Main", organizationId: "org-a1", organizationName: "Alpha" },
      { id: "ws-4", name: "Main", organizationId: "org-a1", organizationName: "Alpha" },
      { id: "ws-1", name: "Zed", organizationId: "org-a1", organizationName: "Alpha" },
      { id: "ws-2", name: "Main", organizationId: "org-b", organizationName: "Beta" },
    ]);
  });

  test("skips the workspace read when SpiceDB grants none", async () => {
    prisma.membership.findMany.mockResolvedValue([{ organization: { id: "org-a", name: "Alpha" } }] as never);
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue([]);

    await expect(listMcpGrantAccessOptions(USER_ID)).resolves.toEqual({
      organizations: [{ id: "org-a", name: "Alpha" }],
      workspaces: [],
    });
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });
});

describe("keepOfferedMcpGrantSelection", () => {
  beforeEach(() => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockReset();
  });

  test("keeps the organizations the user holds other than as a billing member, reading ids only", async () => {
    prisma.membership.findMany.mockResolvedValue([{ organizationId: "org-1" }] as never);

    await expect(
      keepOfferedMcpGrantSelection(prisma, USER_ID, {
        access: "organizations",
        organizationIds: ["org-1", "org-billing", "org-foreign"],
      })
    ).resolves.toEqual({ access: "organizations", organizationIds: ["org-1"] });
    expect(prisma.membership.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        role: { not: "billing" },
        organizationId: { in: ["org-1", "org-billing", "org-foreign"] },
      },
      select: { organizationId: true },
    });
  });

  test("keeps the workspaces SpiceDB lets the user read, in organizations they hold other than as billing", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws-1", "ws-billing-org", "ws-elsewhere"]);
    prisma.workspace.findMany.mockResolvedValue([{ id: "ws-1" }] as never);

    await expect(
      keepOfferedMcpGrantSelection(prisma, USER_ID, {
        access: "workspaces",
        workspaceIds: ["ws-1", "ws-billing-org", "ws-unreadable"],
      })
    ).resolves.toEqual({ access: "workspaces", workspaceIds: ["ws-1"] });
    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledWith(
      { type: "user", id: USER_ID },
      "dashboard_read"
    );
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["ws-1", "ws-billing-org"] },
        organization: { memberships: { some: { userId: USER_ID, role: { not: "billing" } } } },
      },
      select: { id: true },
    });
  });

  test("reads no workspace when SpiceDB lets the user read none of them, and nothing for All access", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws-other"]);

    await expect(
      keepOfferedMcpGrantSelection(prisma, USER_ID, { access: "workspaces", workspaceIds: ["ws-1"] })
    ).resolves.toEqual({ access: "workspaces", workspaceIds: [] });
    await expect(keepOfferedMcpGrantSelection(prisma, USER_ID, { access: "all" })).resolves.toEqual({
      access: "all",
    });
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });
});

describe("resolveMcpGrantSelection", () => {
  beforeEach(() => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockReset().mockResolvedValue(["ws-1", "ws-2"]);
    prisma.workspace.findMany.mockResolvedValue([{ id: "ws-1" }, { id: "ws-2" }] as never);
  });

  test("saves a selection the user may make", async () => {
    await expect(
      resolveMcpGrantSelection(
        prisma,
        USER_ID,
        { access: "workspaces", workspaceIds: ["ws-1", "ws-2"] },
        null
      )
    ).resolves.toEqual({ status: "ok", access: { access: "workspaces", workspaceIds: ["ws-1", "ws-2"] } });
  });

  test("refuses an id the request adds that the user can't select, naming the field", async () => {
    await expect(
      resolveMcpGrantSelection(
        prisma,
        USER_ID,
        { access: "workspaces", workspaceIds: ["ws-1", "ws-foreign"] },
        { access: "workspaces", workspaceIds: ["ws-1"] }
      )
    ).resolves.toEqual({ status: "unavailable", field: "workspaceIds" });
  });

  // Spec story 36: a stored id the user has since lost goes without a refusal.
  test("drops an id the grant already selected and the user lost, without refusing", async () => {
    await expect(
      resolveMcpGrantSelection(
        prisma,
        USER_ID,
        { access: "workspaces", workspaceIds: ["ws-1", "ws-lost"] },
        { access: "workspaces", workspaceIds: ["ws-1", "ws-lost"] }
      )
    ).resolves.toEqual({ status: "ok", access: { access: "workspaces", workspaceIds: ["ws-1"] } });
  });

  test("checks every id as added when the stored grant selects the other kind", async () => {
    prisma.membership.findMany.mockResolvedValue([] as never);

    await expect(
      resolveMcpGrantSelection(
        prisma,
        USER_ID,
        { access: "organizations", organizationIds: ["ws-lost"] },
        { access: "workspaces", workspaceIds: ["ws-lost"] }
      )
    ).resolves.toEqual({ status: "unavailable", field: "organizationIds" });
  });

  test("saves All access without reading anything", async () => {
    await expect(resolveMcpGrantSelection(prisma, USER_ID, { access: "all" }, null)).resolves.toEqual({
      status: "ok",
      access: { access: "all" },
    });
    expect(lookupAuthorizedWorkspaceIds).not.toHaveBeenCalled();
  });
});
