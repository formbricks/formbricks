import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { loadOrganizationWorkspaces } from "@/app/api/v3/account/lib/context";
import { resetDb } from "@/integration/reset-db";

/**
 * The per-organization workspace cap of `get_account_context` against real Postgres.
 *
 * The cap is a nested `take` on one `organization.findMany`, and the claim that matters is Prisma's: a
 * nested `take` limits each parent's list, not the whole result. A unit test mocks the client and can only
 * assert the arguments it was called with. If `take` limited the combined list instead, one large
 * organization would starve every other one in the answer, and `workspaceCount` would still look right.
 */
const CAP = 3;

const seedOrganization = async (name: string, workspaceNames: string[]) => {
  const organization = await prisma.organization.create({ data: { name } });
  const workspaces = [];
  for (const workspaceName of workspaceNames) {
    workspaces.push(
      await prisma.workspace.create({ data: { name: workspaceName, organizationId: organization.id } })
    );
  }
  return { organization, workspaces };
};

describe("loadOrganizationWorkspaces", () => {
  beforeEach(async () => {
    await resetDb();
  });

  test("caps each organization's list separately, so a large organization cannot starve a small one", async () => {
    const large = await seedOrganization("Large", ["e", "a", "c", "b", "d"]);
    const small = await seedOrganization("Small", ["x", "y"]);
    const everyWorkspaceId = [...large.workspaces, ...small.workspaces].map((workspace) => workspace.id);

    const rows = await loadOrganizationWorkspaces(
      [large.organization.id, small.organization.id],
      everyWorkspaceId,
      CAP
    );

    const largeRow = rows.get(large.organization.id)!;
    const smallRow = rows.get(small.organization.id)!;

    // The large organization is cut to the cap, in name order, and still reports its real size.
    expect(largeRow.workspaces.map((workspace) => workspace.name)).toEqual(["a", "b", "c"]);
    expect(largeRow._count.workspaces).toBe(5);
    // The small one is untouched by the large one's cap.
    expect(smallRow.workspaces.map((workspace) => workspace.name)).toEqual(["x", "y"]);
    expect(smallRow._count.workspaces).toBe(2);
  });

  test("counts and lists only the workspaces the caller is authorized for", async () => {
    const organization = await seedOrganization("Acme", ["a", "b", "c", "d"]);
    const authorized = organization.workspaces.filter((workspace) =>
      ["a", "c", "d"].includes(workspace.name)
    );

    const rows = await loadOrganizationWorkspaces(
      [organization.organization.id],
      authorized.map((workspace) => workspace.id),
      CAP
    );

    const row = rows.get(organization.organization.id)!;
    expect(row.workspaces.map((workspace) => workspace.name)).toEqual(["a", "c", "d"]);
    expect(row._count.workspaces).toBe(3);
  });

  test("answers nothing for an organization with no authorized workspace, without querying", async () => {
    const organization = await seedOrganization("Empty", []);

    expect(await loadOrganizationWorkspaces([organization.organization.id], [], CAP)).toEqual(new Map());
  });
});
