import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import {
  keepOfferedMcpGrantSelection,
  listMcpGrantAccessOptions,
  readMcpGrantReadableWorkspaceIds,
  resolveMcpGrantSelection,
} from "./access-options";
import type { TMcpGrantAccessSelection } from "./grant";

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

describe("readMcpGrantReadableWorkspaceIds", () => {
  beforeEach(() => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockReset();
  });

  test("asks SpiceDB for the workspaces the user can read when the selection names workspaces", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["ws-1", "ws-2"]);

    await expect(
      readMcpGrantReadableWorkspaceIds(USER_ID, { access: "workspaces", workspaceIds: ["ws-1"] })
    ).resolves.toEqual(new Set(["ws-1", "ws-2"]));
    // `dashboard_read` so a Dashboard viewer may pick their dashboard workspaces.
    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledWith(
      { type: "user", id: USER_ID },
      "dashboard_read"
    );
  });

  test("makes no SpiceDB call for any other selection, or none", async () => {
    const selections: (TMcpGrantAccessSelection | null | undefined)[] = [
      { access: "all" },
      { access: "organizations", organizationIds: ["org-1"] },
      undefined,
      null,
    ];
    for (const selection of selections) {
      await expect(readMcpGrantReadableWorkspaceIds(USER_ID, selection)).resolves.toEqual(new Set());
    }
    expect(lookupAuthorizedWorkspaceIds).not.toHaveBeenCalled();
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
  });
});

describe("keepOfferedMcpGrantSelection", () => {
  beforeEach(() => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockReset();
  });

  test("keeps the organizations the user holds other than as a billing member, reading ids only", async () => {
    prisma.membership.findMany.mockResolvedValue([{ organizationId: "org-1" }] as never);

    await expect(
      keepOfferedMcpGrantSelection(
        prisma,
        USER_ID,
        { access: "organizations", organizationIds: ["org-1", "org-billing", "org-foreign"] },
        new Set()
      )
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

  // The SpiceDB half is read before the caller locks anything; this half reads PostgreSQL alone.
  test("keeps the readable workspaces in organizations the user holds other than as billing, without SpiceDB", async () => {
    prisma.workspace.findMany.mockResolvedValue([{ id: "ws-1" }] as never);

    await expect(
      keepOfferedMcpGrantSelection(
        prisma,
        USER_ID,
        { access: "workspaces", workspaceIds: ["ws-1", "ws-billing-org", "ws-unreadable"] },
        new Set(["ws-1", "ws-billing-org", "ws-elsewhere"])
      )
    ).resolves.toEqual({ access: "workspaces", workspaceIds: ["ws-1"] });
    expect(lookupAuthorizedWorkspaceIds).not.toHaveBeenCalled();
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["ws-1", "ws-billing-org"] },
        organization: { memberships: { some: { userId: USER_ID, role: { not: "billing" } } } },
      },
      select: { id: true },
    });
  });

  test("reads no workspace when the user can read none of them, and nothing for All access", async () => {
    await expect(
      keepOfferedMcpGrantSelection(
        prisma,
        USER_ID,
        { access: "workspaces", workspaceIds: ["ws-1"] },
        new Set(["ws-other"])
      )
    ).resolves.toEqual({ access: "workspaces", workspaceIds: [] });
    await expect(
      keepOfferedMcpGrantSelection(prisma, USER_ID, { access: "all" }, new Set())
    ).resolves.toEqual({ access: "all" });
    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });
});

describe("resolveMcpGrantSelection", () => {
  const READABLE: ReadonlySet<string> = new Set(["ws-1", "ws-2"]);

  beforeEach(() => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockReset();
    prisma.workspace.findMany.mockResolvedValue([{ id: "ws-1" }, { id: "ws-2" }] as never);
  });

  test("saves a selection the user may make", async () => {
    await expect(
      resolveMcpGrantSelection(
        prisma,
        USER_ID,
        { access: "workspaces", workspaceIds: ["ws-1", "ws-2"] },
        null,
        READABLE
      )
    ).resolves.toEqual({ status: "ok", access: { access: "workspaces", workspaceIds: ["ws-1", "ws-2"] } });
  });

  test("refuses an id the request adds that the user can't select, naming the field", async () => {
    await expect(
      resolveMcpGrantSelection(
        prisma,
        USER_ID,
        { access: "workspaces", workspaceIds: ["ws-1", "ws-foreign"] },
        { access: "workspaces", workspaceIds: ["ws-1"] },
        READABLE
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
        { access: "workspaces", workspaceIds: ["ws-1", "ws-lost"] },
        READABLE
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
        { access: "workspaces", workspaceIds: ["ws-lost"] },
        READABLE
      )
    ).resolves.toEqual({ status: "unavailable", field: "organizationIds" });
  });

  test("saves All access without reading anything", async () => {
    await expect(
      resolveMcpGrantSelection(prisma, USER_ID, { access: "all" }, null, READABLE)
    ).resolves.toEqual({
      status: "ok",
      access: { access: "all" },
    });
    expect(lookupAuthorizedWorkspaceIds).not.toHaveBeenCalled();
    expect(prisma.membership.findMany).not.toHaveBeenCalled();
  });
});
