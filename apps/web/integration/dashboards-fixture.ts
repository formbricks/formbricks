import { prisma } from "@formbricks/database";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";

/**
 * One tenant layout for every chart and dashboard integration suite (ENG-6581 to ENG-6596), against real
 * PostgreSQL and SpiceDB, so each suite asserts the same access rules rather than re-deriving them.
 *
 * - `workspace` is where the charts and dashboards live; `otherWorkspace` is a second workspace in the same
 *   organization that only the owner can reach; `foreignWorkspace` belongs to another organization.
 * - `dataset` is assigned to `workspace`; `unassignedDataset` belongs to the organization but is not
 *   assigned to it; `foreignDataset` belongs to the other organization.
 * - Users cover every role the rules distinguish: `owner` (organization owner), `editor` (read & write on
 *   `workspace` through a team), `viewer` (read only) and `outsider` (a member with no workspace access).
 * - API keys cover the three workspace permissions: `readKey`, `writeKey` and `manageKey`.
 */
export type TDashboardsFixture = {
  organizationId: string;
  workspaceId: string;
  otherWorkspaceId: string;
  foreignWorkspaceId: string;
  datasetId: string;
  unassignedDatasetId: string;
  foreignDatasetId: string;
  users: { owner: string; editor: string; viewer: string; outsider: string };
  apiKeys: { readKey: string; writeKey: string; manageKey: string };
};

export const sessionOf = (userId: string): TV3Authentication =>
  ({ expires: "2099-01-01", user: { id: userId } }) as never;

export const apiKeyOf = (
  fixture: TDashboardsFixture,
  key: keyof TDashboardsFixture["apiKeys"]
): TV3Authentication =>
  ({
    apiKeyId: fixture.apiKeys[key],
    organizationAccess: { accessControl: { read: false, write: false } },
    organizationId: fixture.organizationId,
    type: "apiKey",
    workspacePermissions: [
      {
        permission: { readKey: "read", writeKey: "write", manageKey: "manage" }[key],
        workspaceId: fixture.workspaceId,
        workspaceName: "Dashboards",
      },
    ],
  }) as never;

export const seedDashboardsFixture = async (): Promise<TDashboardsFixture> => {
  await resetDb();

  const organization = await prisma.organization.create({ data: { name: "Dashboards Org" } });
  const foreignOrganization = await prisma.organization.create({ data: { name: "Foreign Org" } });
  const [workspace, otherWorkspace, foreignWorkspace] = await Promise.all([
    prisma.workspace.create({ data: { name: "Dashboards", organizationId: organization.id } }),
    prisma.workspace.create({ data: { name: "Other", organizationId: organization.id } }),
    prisma.workspace.create({ data: { name: "Foreign", organizationId: foreignOrganization.id } }),
  ]);

  const [dataset, unassignedDataset, foreignDataset] = await Promise.all([
    prisma.feedbackDirectory.create({
      data: {
        name: "Main dataset",
        organizationId: organization.id,
        workspaces: { create: { workspaceId: workspace.id } },
      },
    }),
    prisma.feedbackDirectory.create({ data: { name: "Unassigned", organizationId: organization.id } }),
    prisma.feedbackDirectory.create({
      data: {
        name: "Foreign dataset",
        organizationId: foreignOrganization.id,
        workspaces: { create: { workspaceId: foreignWorkspace.id } },
      },
    }),
  ]);

  const makeUser = async (label: string, role: "owner" | "member", permission?: "read" | "readWrite") => {
    const user = await prisma.user.create({ data: { email: `${label}@dashboards.test`, name: label } });
    await prisma.membership.create({
      data: { accepted: true, organizationId: organization.id, role, userId: user.id },
    });
    if (permission) {
      const team = await prisma.team.create({ data: { name: label, organizationId: organization.id } });
      await prisma.teamUser.create({ data: { role: "contributor", teamId: team.id, userId: user.id } });
      await prisma.workspaceTeam.create({ data: { permission, teamId: team.id, workspaceId: workspace.id } });
    }
    return user.id;
  };

  const users = {
    owner: await makeUser("owner", "owner"),
    editor: await makeUser("editor", "member", "readWrite"),
    viewer: await makeUser("viewer", "member", "read"),
    outsider: await makeUser("outsider", "member"),
  };

  const makeKey = async (label: string, permission: "read" | "write" | "manage") => {
    const apiKey = await prisma.apiKey.create({
      data: { hashedKey: `${label}-hash`, label, organizationId: organization.id },
    });
    await prisma.apiKeyWorkspace.create({
      data: { apiKeyId: apiKey.id, permission, workspaceId: workspace.id },
    });
    return apiKey.id;
  };

  const apiKeys = {
    readKey: await makeKey("read-key", "read"),
    writeKey: await makeKey("write-key", "write"),
    manageKey: await makeKey("manage-key", "manage"),
  };

  await synchronizeAuthzedIntegrationFixture();

  return {
    organizationId: organization.id,
    workspaceId: workspace.id,
    otherWorkspaceId: otherWorkspace.id,
    foreignWorkspaceId: foreignWorkspace.id,
    datasetId: dataset.id,
    unassignedDatasetId: unassignedDataset.id,
    foreignDatasetId: foreignDataset.id,
    users,
    apiKeys,
  };
};

/** The problem `code` and status of a refused operation, or the status alone for a success. */
export const outcomeOf = async (response: Response): Promise<{ status: number; code?: string }> => {
  if (response.ok) return { status: response.status };
  const body = (await response.clone().json()) as { code?: string };
  return { status: response.status, code: body.code };
};
