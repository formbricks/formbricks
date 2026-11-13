import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { listMcpGrantAccessOptions } from "./access-options";

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
